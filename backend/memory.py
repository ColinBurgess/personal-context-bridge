import json
from datetime import datetime
from typing import Any
import chromadb
from sentence_transformers import SentenceTransformer

from backend.config import CHROMA_PATH, COLLECTION_NAME, EMBEDDING_MODEL, DEFAULT_SEARCH_RESULTS
from backend.models import MemoryEntry

# --- Module-level caches ---
_chroma_client: Any | None = None
_collection: Any | None = None
_embedding_model: SentenceTransformer | None = None


def _get_collection() -> Any:
    global _chroma_client, _collection
    if _collection is None:
        _chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
        _collection = _chroma_client.get_or_create_collection(name=COLLECTION_NAME)
    return _collection


def _get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL)
    return _embedding_model


# --- Private helpers ---
def _get_embedding(text: str) -> list:
    return _get_embedding_model().encode(text).tolist()


def _generate_memory_id() -> str:
    return f"mem_{datetime.now().timestamp()}"


def _topic_tags_from_meta(meta: dict) -> list[str]:
    topic_tags = meta.get("topic_tags", [])
    if isinstance(topic_tags, str):
        try:
            return json.loads(topic_tags)
        except json.JSONDecodeError:
            return [topic_tags]
    if isinstance(topic_tags, list):
        return topic_tags
    return []


def _key_entities_from_meta(meta: dict) -> dict:
    key_entities = meta.get("key_entities", "{}")
    if isinstance(key_entities, str):
        try:
            parsed = json.loads(key_entities)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
    if isinstance(key_entities, dict):
        return key_entities
    return {
        "concepts": [],
        "tools": [],
        "decisions": [],
        "pending_actions": [],
    }


def _format_query_results(results: dict) -> list:
    return [
        {
            "id": id_,
            "summary": doc,
            "metadata": meta,
            "distance": dist,
        }
        for id_, doc, meta, dist in zip(
            results["ids"][0],
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        )
    ]


def _memory_from_stored_entry(memory_id: str, summary: str, metadata: dict) -> dict:
    full_memory = metadata.get("full_memory")
    if isinstance(full_memory, str):
        try:
            parsed = json.loads(full_memory)
            if isinstance(parsed, dict):
                parsed["id"] = memory_id
                return parsed
        except json.JSONDecodeError:
            pass

    return {
        "id": memory_id,
        "metadata": {
            "timestamp": metadata.get("timestamp", datetime.now().isoformat()),
            "model_used": metadata.get("model_used", "unknown"),
            "topic_tags": _topic_tags_from_meta(metadata),
            "priority": metadata.get("priority", "Medium"),
        },
        "summary": summary,
        "key_entities": _key_entities_from_meta(metadata),
        "context_reference": metadata.get("context_reference", "Legacy Memory"),
    }


def _all_ids() -> list[str]:
    data = _get_collection().get()
    return data.get("ids", [])


def _clear_collection() -> None:
    ids = _all_ids()
    if ids:
        _get_collection().delete(ids=ids)


# --- Public API ---
def save_memory(memory: MemoryEntry, memory_id: str | None = None) -> dict:
    mem_id = memory_id or _generate_memory_id()
    full_payload = memory.model_dump(mode="json")

    _get_collection().add(
        ids=[mem_id],
        embeddings=[_get_embedding(memory.summary)],
        metadatas=[{
            "timestamp": memory.metadata.timestamp,
            "model_used": memory.metadata.model_used,
            "priority": memory.metadata.priority,
            "topic_tags": json.dumps(memory.metadata.topic_tags),
            "context_reference": memory.context_reference,
            "key_entities": json.dumps(memory.key_entities.model_dump(mode="json")),
            "full_memory": json.dumps(full_payload),
        }],
        documents=[memory.summary],
    )
    return {"status": "success", "id": mem_id}


def search_memories(query: str, n_results: int = DEFAULT_SEARCH_RESULTS) -> list:
    results = _get_collection().query(
        query_embeddings=[_get_embedding(query)],
        n_results=n_results,
    )
    return _format_query_results(results)


def get_all_memories() -> list:
    results = _get_collection().get()
    return [
        _memory_from_stored_entry(id_, doc, meta)
        for id_, doc, meta in zip(results["ids"], results["documents"], results["metadatas"])
    ]


def delete_memory(memory_id: str) -> dict:
    ids = _all_ids()
    if memory_id not in ids:
        raise ValueError(f"Memory '{memory_id}' not found")
    _get_collection().delete(ids=[memory_id])
    return {"status": "success", "id": memory_id}


def backup_memories_to_file(file_path: str) -> dict:
    memories = get_all_memories()
    payload = {
        "version": 1,
        "created_at": datetime.now().isoformat(),
        "count": len(memories),
        "memories": memories,
    }
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return {"status": "success", "count": len(memories), "file": file_path}


def _restore_memories_payload(payload: dict, mode: str, source_label: str) -> dict:
    if mode not in {"append", "replace"}:
        raise ValueError("mode must be 'append' or 'replace'")

    if not isinstance(payload, dict):
        raise ValueError("Backup payload must be a JSON object")

    memories = payload.get("memories")
    if not isinstance(memories, list):
        raise ValueError("Backup payload is invalid: 'memories' must be a list")

    if mode == "replace":
        _clear_collection()

    existing_ids = set(_all_ids())
    imported = 0
    for item in memories:
        memory = MemoryEntry.model_validate(item)
        incoming_id = item.get("id")
        memory_id = incoming_id if isinstance(incoming_id, str) and incoming_id not in existing_ids else None
        result = save_memory(memory, memory_id=memory_id)
        existing_ids.add(result["id"])
        imported += 1

    return {
        "status": "success",
        "mode": mode,
        "imported": imported,
        "source": source_label,
    }


def restore_memories_from_file(file_path: str, mode: str = "append") -> dict:
    with open(file_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    result = _restore_memories_payload(payload, mode, source_label=file_path)
    result["source_file"] = file_path
    return result


def restore_memories_from_payload(payload: dict, mode: str = "append") -> dict:
    return _restore_memories_payload(payload, mode, source_label="payload")
