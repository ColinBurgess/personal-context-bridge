import json

from backend import memory


class FakeCollection:
    def __init__(self):
        self.add_calls = []

    def add(self, **kwargs):
        self.add_calls.append(kwargs)

    def query(self, **kwargs):
        return {
            "ids": [["mem_1"]],
            "documents": [["Stored summary"]],
            "metadatas": [[{"priority": "High"}]],
            "distances": [[0.1234]],
        }

    def get(self):
        return {
            "ids": ["mem_1"],
            "documents": ["Stored summary"],
            "metadatas": [{"priority": "High"}],
        }


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
        "summary": "Stored summary",
        "metadata": {"priority": "High"},
    }]
