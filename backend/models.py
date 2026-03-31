from datetime import datetime
from typing import List
from pydantic import BaseModel, Field


class Metadata(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    model_used: str
    topic_tags: List[str]
    priority: str


class KeyEntities(BaseModel):
    concepts: List[str]
    tools: List[str]
    decisions: List[str]
    pending_actions: List[str]


class MemoryEntry(BaseModel):
    metadata: Metadata
    summary: str
    key_entities: KeyEntities
    context_reference: str
