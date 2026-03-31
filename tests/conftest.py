from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.models import KeyEntities, MemoryEntry, Metadata
import pytest


@pytest.fixture
def sample_memory() -> MemoryEntry:
    return MemoryEntry(
        metadata=Metadata(
            model_used="test-model",
            topic_tags=["python", "testing"],
            priority="High",
        ),
        summary="Testing memory persistence.",
        key_entities=KeyEntities(
            concepts=["pytest"],
            tools=["fastapi"],
            decisions=["add tests"],
            pending_actions=["run suite"],
        ),
        context_reference="test-context",
    )
