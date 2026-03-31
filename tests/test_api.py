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
