import asyncio
from mcp.server.models import InitializationOptions
from mcp.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server
import mcp.types as types

from backend.models import MemoryEntry
from backend.memory import save_memory, search_memories
from backend.version import APP_VERSION

server = Server("Personal Context Bridge")

# --- Tool schemas ---
_SAVE_MEMORY_SCHEMA = {
    "type": "object",
    "properties": {
        "metadata": {
            "type": "object",
            "properties": {
                "timestamp": {"type": "string"},
                "model_used": {"type": "string"},
                "topic_tags": {"type": "array", "items": {"type": "string"}},
                "priority": {"type": "string"},
            },
            "required": ["model_used", "topic_tags", "priority"],
        },
        "summary": {"type": "string"},
        "key_entities": {
            "type": "object",
            "properties": {
                "concepts": {"type": "array", "items": {"type": "string"}},
                "tools": {"type": "array", "items": {"type": "string"}},
                "decisions": {"type": "array", "items": {"type": "string"}},
                "pending_actions": {"type": "array", "items": {"type": "string"}},
            },
        },
        "context_reference": {"type": "string"},
    },
    "required": ["metadata", "summary", "key_entities", "context_reference"],
}

_SEARCH_MEMORY_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {"type": "string", "description": "The semantic search query."},
        "n_results": {"type": "integer", "default": 3, "description": "Number of results to return."},
    },
    "required": ["query"],
}

_AVAILABLE_TOOLS = [
    types.Tool(
        name="save_memory",
        description="Saves a memory entry into the ChromaDB vector database.",
        inputSchema=_SAVE_MEMORY_SCHEMA,
    ),
    types.Tool(
        name="search_memory",
        description="Searches for similar memories in ChromaDB based on a text query.",
        inputSchema=_SEARCH_MEMORY_SCHEMA,
    ),
]


# --- Private helpers ---
def _as_text(content: str) -> list:
    return [types.TextContent(type="text", text=content)]


def _format_search_results(results: list) -> str:
    lines = ["Memory Search Results:\n"]
    for res in results:
        lines += [
            f"- ID: {res['id']}",
            f"  Summary: {res['summary']}",
            f"  Metadata: {res['metadata']}",
            f"  Distance: {res['distance']:.4f}\n",
        ]
    return "\n".join(lines)


# --- MCP handlers ---
@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return _AVAILABLE_TOOLS


@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict | None
) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    if not arguments:
        raise ValueError("Missing tool arguments.")

    if name == "save_memory":
        try:
            result = save_memory(MemoryEntry(**arguments))
            return _as_text(f"Memory saved successfully. ID: {result['id']}")
        except Exception as e:
            return _as_text(f"Error saving memory: {e}")

    if name == "search_memory":
        try:
            results = search_memories(arguments["query"], arguments.get("n_results", 3))
            return _as_text(_format_search_results(results))
        except Exception as e:
            return _as_text(f"Error searching memory: {e}")

    raise ValueError(f"Unknown tool: {name}")


# --- Entry point ---
async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="pcb_server",
                server_version=APP_VERSION,
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
