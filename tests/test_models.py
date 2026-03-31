from backend.models import KeyEntities, MemoryEntry, Metadata


def test_metadata_generates_timestamp_when_missing():
    metadata = Metadata(model_used="model", topic_tags=["tag"], priority="High")

    assert metadata.timestamp
    assert "T" in metadata.timestamp


def test_memory_entry_accepts_nested_models():
    entry = MemoryEntry(
        metadata=Metadata(model_used="model", topic_tags=["tag"], priority="Low"),
        summary="A summary",
        key_entities=KeyEntities(
            concepts=["concept"],
            tools=["tool"],
            decisions=["decision"],
            pending_actions=["action"],
        ),
        context_reference="ctx",
    )

    assert entry.summary == "A summary"
    assert entry.key_entities.tools == ["tool"]
