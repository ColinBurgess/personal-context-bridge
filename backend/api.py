from fastapi import FastAPI, HTTPException

from backend.models import MemoryEntry
from backend.memory import save_memory, search_memories, get_all_memories

app = FastAPI(title="Personal Context Bridge API")


@app.post("/save_memory")
async def api_save_memory(memory: MemoryEntry):
    try:
        return save_memory(memory)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search_memory")
async def api_search_memory(query: str):
    try:
        return search_memories(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/get_all_memories")
async def api_get_all_memories():
    try:
        return get_all_memories()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
