from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.models import MemoryEntry
from backend.memory import (
    save_memory,
    search_memories,
    get_all_memories,
    delete_memory,
    backup_memories_to_file,
    restore_memories_from_file,
)

app = FastAPI(title="Personal Context Bridge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BackupRequest(BaseModel):
    file_path: str


class RestoreRequest(BaseModel):
    file_path: str
    mode: str = "append"


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


@app.delete("/delete_memory/{memory_id}")
async def api_delete_memory(memory_id: str):
    try:
        return delete_memory(memory_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/backup_memories")
async def api_backup_memories(request: BackupRequest):
    try:
        return backup_memories_to_file(request.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/restore_memories")
async def api_restore_memories(request: RestoreRequest):
    try:
        return restore_memories_from_file(request.file_path, request.mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
