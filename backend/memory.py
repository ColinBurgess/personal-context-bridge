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


# --- Public API ---
def save_memory(memory: MemoryEntry) -> dict:
    mem_id = f"mem_{datetime.now().timestamp()}"
    _get_collection().add(
        ids=[mem_id],
        embeddings=[_get_embedding(memory.summary)],
        metadatas=[{
            "timestamp": memory.metadata.timestamp,
            "model_used": memory.metadata.model_used,
            "priority": memory.metadata.priority,
            "topic_tags": json.dumps(memory.metadata.topic_tags),
            "context_reference": memory.context_reference,
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
        {"id": id_, "summary": doc, "metadata": meta}
        for id_, doc, meta in zip(results["ids"], results["documents"], results["metadatas"])
    ]
