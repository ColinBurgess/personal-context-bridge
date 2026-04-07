import json
from pathlib import Path

from backend import memory
from backend.models import MemoryEntry


class FakeCollection:
    def __init__(self):
        self.add_calls = []
        self.deleted_ids = []
        self._ids = ["mem_1"]

    def add(self, **kwargs):
        self.add_calls.append(kwargs)

    def query(self, **kwargs):
        return {
            "ids": [["mem_1"]],
            "documents": [["Stored summary"]],
            "metadatas": [[{"priority": "High"}]],
            "distances": [[0.1234]],
        }

    def get(self, **kwargs):
        ids = kwargs.get("ids")
        if ids:
            matched = [item for item in self._ids if item in ids]
            return {
                "ids": matched,
                "documents": ["Stored summary" for _ in matched],
                "metadatas": [{"priority": "High"} for _ in matched],
            }
        return {
            "ids": list(self._ids),
            "documents": ["Stored summary"],
            "metadatas": [{
                "timestamp": "2026-04-01T00:00:00Z",
                "model_used": "gpt-5.3-codex",
                "priority": "High",
                "topic_tags": json.dumps(["Testing"]),
                "context_reference": "Test Context",
                "key_entities": json.dumps({
                    "concepts": ["Vector DB"],
                    "tools": ["pytest"],
                    "decisions": ["Keep backup support"],
                    "pending_actions": ["Run release"],
                }),
            }],
        }

    def delete(self, ids):
        self.deleted_ids.extend(ids)
        self._ids = [item for item in self._ids if item not in ids]


def test_save_memory_serializes_tags(monkeypatch, sample_memory):
    fake_collection = FakeCollection()

    monkeypatch.setattr(memory, "_get_collection", lambda: fake_collection)
    monkeypatch.setattr(memory, "_get_embedding", lambda text: [0.1, 0.2, 0.3])

    result = memory.save_memory(sample_memory)

    assert result["status"] == "success"
    add_call = fake_collection.add_calls[0]
    assert add_call["documents"] == [sample_memory.summary]
    assert json.loads(add_call["metadatas"][0]["topic_tags"]) == sample_memory.metadata.topic_tags


def test_search_memories_formats_results(monkeypatch):
    fake_collection = FakeCollection()

    monkeypatch.setattr(memory, "_get_collection", lambda: fake_collection)
    monkeypatch.setattr(memory, "_get_embedding", lambda text: [0.5, 0.6])

    results = memory.search_memories("stored", 1)

    assert results == [{
        "id": "mem_1",
        "summary": "Stored summary",
        "metadata": {"priority": "High"},
        "distance": 0.1234,
    }]


def test_get_all_memories_returns_flat_entries(monkeypatch):
    fake_collection = FakeCollection()
    monkeypatch.setattr(memory, "_get_collection", lambda: fake_collection)

    results = memory.get_all_memories()

    assert results == [{
        "id": "mem_1",
        "metadata": {
            "timestamp": "2026-04-01T00:00:00Z",
            "model_used": "gpt-5.3-codex",
            "topic_tags": ["Testing"],
            "priority": "High",
        },
        "summary": "Stored summary",
        "key_entities": {
            "concepts": ["Vector DB"],
            "tools": ["pytest"],
            "decisions": ["Keep backup support"],
            "pending_actions": ["Run release"],
        },
        "context_reference": "Test Context",
    }]


def test_delete_memory_removes_existing_id(monkeypatch):
    fake_collection = FakeCollection()
    monkeypatch.setattr(memory, "_get_collection", lambda: fake_collection)

    result = memory.delete_memory("mem_1")

    assert result == {"status": "success", "id": "mem_1"}
    assert fake_collection.deleted_ids == ["mem_1"]


def test_backup_and_restore_roundtrip(monkeypatch, tmp_path: Path):
    backup_file = tmp_path / "backup.json"

    monkeypatch.setattr(memory, "get_all_memories", lambda: [{
        "id": "mem_1",
        "metadata": {
            "timestamp": "2026-04-01T00:00:00Z",
            "model_used": "gpt-5.3-codex",
            "topic_tags": ["Testing"],
            "priority": "High",
        },
        "summary": "Stored summary",
        "key_entities": {
            "concepts": ["Vector DB"],
            "tools": ["pytest"],
            "decisions": ["Keep backup support"],
            "pending_actions": ["Run release"],
        },
        "context_reference": "Test Context",
    }])

    backup_result = memory.backup_memories_to_file(str(backup_file))
    assert backup_result["status"] == "success"
    assert backup_file.exists()

    imported_items = []

    def fake_save(entry: MemoryEntry, memory_id=None):
        imported_items.append((entry.summary, memory_id))
        return {"status": "success", "id": memory_id or "new_id"}

    monkeypatch.setattr(memory, "_clear_collection", lambda: None)
    monkeypatch.setattr(memory, "_all_ids", lambda: [])
    monkeypatch.setattr(memory, "save_memory", fake_save)

    restore_result = memory.restore_memories_from_file(str(backup_file), mode="append")

    assert restore_result["status"] == "success"
    assert restore_result["imported"] == 1
    assert imported_items == [("Stored summary", "mem_1")]


def test_restore_memories_from_payload(monkeypatch):
    imported_items = []

    def fake_save(entry: MemoryEntry, memory_id=None):
        imported_items.append((entry.summary, memory_id))
        return {"status": "success", "id": memory_id or "new_id"}

    monkeypatch.setattr(memory, "_clear_collection", lambda: None)
    monkeypatch.setattr(memory, "_all_ids", lambda: [])
    monkeypatch.setattr(memory, "save_memory", fake_save)

    payload = {
        "version": 1,
        "memories": [{
            "id": "mem_payload_1",
            "metadata": {
                "timestamp": "2026-04-01T00:00:00Z",
                "model_used": "gpt-5.3-codex",
                "topic_tags": ["Testing"],
                "priority": "High",
            },
            "summary": "payload memory",
            "key_entities": {
                "concepts": ["Vector DB"],
                "tools": ["pytest"],
                "decisions": ["Add payload import"],
                "pending_actions": ["Run tests"],
            },
            "context_reference": "Payload Context",
        }],
    }

    result = memory.restore_memories_from_payload(payload, mode="append")

    assert result["status"] == "success"
    assert result["imported"] == 1
    assert result["source"] == "payload"
    assert imported_items == [("payload memory", "mem_payload_1")]
