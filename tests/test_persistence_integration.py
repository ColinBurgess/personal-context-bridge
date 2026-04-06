import httpx
import pytest

import backend.memory as memory
from backend.api import app


class _FakeVector(list):
    def tolist(self):
        return list(self)


class _FakeEmbeddingModel:
    def encode(self, text: str):
        base = float((len(text) % 10) + 1)
        return _FakeVector([base, base / 10, base / 100])


@pytest.mark.anyio
async def test_save_memory_persists_and_is_retrievable(tmp_path, sample_memory, monkeypatch):
    original_path = memory.CHROMA_PATH
    original_collection = memory._collection
    original_client = memory._chroma_client
    original_model = memory._embedding_model

    try:
        memory.CHROMA_PATH = str(tmp_path / "chroma_test")
        memory._collection = None
        memory._chroma_client = None
        memory._embedding_model = _FakeEmbeddingModel()

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            save_response = await client.post("/save_memory", json=sample_memory.model_dump())
            assert save_response.status_code == 200
            saved_id = save_response.json()["id"]

            all_response = await client.get("/get_all_memories")
            assert all_response.status_code == 200
            data = all_response.json()

        assert any(item["id"] == saved_id for item in data)
        saved_item = next(item for item in data if item["id"] == saved_id)
        assert saved_item["summary"] == sample_memory.summary
        assert saved_item["metadata"]["model_used"] == sample_memory.metadata.model_used
        assert saved_item["metadata"]["topic_tags"] == sample_memory.metadata.topic_tags
        assert saved_item["key_entities"]["tools"] == sample_memory.key_entities.tools
        assert saved_item["context_reference"] == sample_memory.context_reference
    finally:
        memory.CHROMA_PATH = original_path
        memory._collection = original_collection
        memory._chroma_client = original_client
        memory._embedding_model = original_model


@pytest.mark.anyio
async def test_delete_memory_removes_item_from_real_persistence(tmp_path, sample_memory):
    original_path = memory.CHROMA_PATH
    original_collection = memory._collection
    original_client = memory._chroma_client
    original_model = memory._embedding_model

    try:
        memory.CHROMA_PATH = str(tmp_path / "chroma_test_delete")
        memory._collection = None
        memory._chroma_client = None
        memory._embedding_model = _FakeEmbeddingModel()

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            save_response = await client.post("/save_memory", json=sample_memory.model_dump())
            assert save_response.status_code == 200
            saved_id = save_response.json()["id"]

            delete_response = await client.delete(f"/delete_memory/{saved_id}")
            assert delete_response.status_code == 200

            all_response = await client.get("/get_all_memories")
            assert all_response.status_code == 200
            data = all_response.json()

        assert all(item["id"] != saved_id for item in data)
    finally:
        memory.CHROMA_PATH = original_path
        memory._collection = original_collection
        memory._chroma_client = original_client
        memory._embedding_model = original_model
