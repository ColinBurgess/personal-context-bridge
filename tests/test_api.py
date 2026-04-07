import httpx
import pytest

import backend.api as api
from backend.api import app


async def _get_client() -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.anyio
async def test_save_memory_endpoint_returns_success(monkeypatch, sample_memory):
    monkeypatch.setattr(api, "save_memory", lambda memory: {"status": "success", "id": "mem_123"})

    async with await _get_client() as client:
        response = await client.post("/save_memory", json=sample_memory.model_dump())

    assert response.status_code == 200
    assert response.json() == {"status": "success", "id": "mem_123"}


@pytest.mark.anyio
async def test_search_memory_endpoint_returns_results(monkeypatch):
    monkeypatch.setattr(api, "search_memories", lambda query: [{"id": "mem_1", "summary": "Found"}])

    async with await _get_client() as client:
        response = await client.get("/search_memory", params={"query": "found"})

    assert response.status_code == 200
    assert response.json() == [{"id": "mem_1", "summary": "Found"}]


@pytest.mark.anyio
async def test_get_all_memories_endpoint_returns_results(monkeypatch):
    monkeypatch.setattr(api, "get_all_memories", lambda: [{"id": "mem_1", "summary": "All"}])

    async with await _get_client() as client:
        response = await client.get("/get_all_memories")

    assert response.status_code == 200
    assert response.json() == [{"id": "mem_1", "summary": "All"}]


@pytest.mark.anyio
async def test_save_memory_endpoint_maps_errors_to_http_500(monkeypatch, sample_memory):
    def raise_error(_memory):
        raise RuntimeError("boom")

    monkeypatch.setattr(api, "save_memory", raise_error)

    async with await _get_client() as client:
        response = await client.post("/save_memory", json=sample_memory.model_dump())

    assert response.status_code == 500
    assert response.json()["detail"] == "boom"


@pytest.mark.anyio
async def test_delete_memory_endpoint_returns_success(monkeypatch):
    monkeypatch.setattr(api, "delete_memory", lambda memory_id: {"status": "success", "id": memory_id})

    async with await _get_client() as client:
        response = await client.delete("/delete_memory/mem_1")

    assert response.status_code == 200
    assert response.json() == {"status": "success", "id": "mem_1"}


@pytest.mark.anyio
async def test_delete_memory_endpoint_returns_404_for_missing_memory(monkeypatch):
    def raise_not_found(_memory_id):
        raise ValueError("missing")

    monkeypatch.setattr(api, "delete_memory", raise_not_found)

    async with await _get_client() as client:
        response = await client.delete("/delete_memory/mem_404")

    assert response.status_code == 404
    assert response.json()["detail"] == "missing"


@pytest.mark.anyio
async def test_backup_restore_endpoints(monkeypatch):
    monkeypatch.setattr(api, "backup_memories_to_file", lambda path: {"status": "success", "file": path, "count": 1})
    monkeypatch.setattr(api, "restore_memories_from_file", lambda path, mode: {"status": "success", "source_file": path, "mode": mode, "imported": 1})

    async with await _get_client() as client:
        backup_response = await client.post("/backup_memories", json={"file_path": "backups/test.json"})
        restore_response = await client.post("/restore_memories", json={"file_path": "backups/test.json", "mode": "append"})

    assert backup_response.status_code == 200
    assert backup_response.json()["status"] == "success"
    assert restore_response.status_code == 200
    assert restore_response.json()["imported"] == 1


@pytest.mark.anyio
async def test_restore_memories_payload_endpoint(monkeypatch):
    monkeypatch.setattr(
        api,
        "restore_memories_from_payload",
        lambda payload, mode: {"status": "success", "mode": mode, "imported": len(payload.get("memories", []))},
    )

    async with await _get_client() as client:
        response = await client.post(
            "/restore_memories_payload",
            json={
                "mode": "append",
                "payload": {
                    "version": 1,
                    "memories": [{
                        "metadata": {
                            "timestamp": "2026-04-01T00:00:00Z",
                            "model_used": "gpt-5.3-codex",
                            "topic_tags": ["Testing"],
                            "priority": "High",
                        },
                        "summary": "memory",
                        "key_entities": {
                            "concepts": ["concept"],
                            "tools": ["tool"],
                            "decisions": ["decision"],
                            "pending_actions": ["pending"],
                        },
                        "context_reference": "ctx",
                    }],
                },
            },
        )

    assert response.status_code == 200
    assert response.json() == {"status": "success", "mode": "append", "imported": 1}
