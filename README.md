# 🌉 Personal Context Bridge (PCB)

Personal Context Bridge (PCB) is a local AI context management system that lets you store, retrieve, and manage AI-generated context and memories using a local, persistent vector database — no cloud required.

## ✨ Features

| Feature | Description |
|---|---|
| **Local Vector Storage** | ChromaDB persists semantic memories on disk |
| **Semantic Search** | Find context by meaning, not keywords (`sentence-transformers`) |
| **REST API** | FastAPI backend with auto-generated OpenAPI docs |
| **Web UI** | Streamlit interface for manual interaction |
| **Knowledge Graph** | Visualize relationships between topics and contexts |
| **MCP Support** | Model Context Protocol server — plug directly into Claude Desktop or any MCP-compatible agent |

---

## 🚀 Quick Start

### 1. Install
```bash
bash scripts/install.sh
```
This will:
- Verify Python 3.11+ is available
- Create an isolated virtual environment (`.venv/`)
- Install all dependencies from `requirements.txt`
- Install frontend dependencies from `frontend/package.json`

### 2. Start
```bash
bash scripts/start.sh
```

| Service | URL |
|---|---|
| Web UI (React, default) | http://localhost:3000 |
| Web UI (Streamlit, optional) | http://localhost:8501 |
| REST API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

### 3. Stop
```bash
bash scripts/stop.sh
```

### 4. Check process status
```bash
bash scripts/status.sh
```

### 5. Run the full test suite
```bash
bash scripts/test.sh
```

### 6. (Optional) Run React frontend in dev mode
```bash
bash scripts/frontend-dev.sh
```

### 7. Create a release entry (version bump + changelog)
```bash
bash scripts/release.sh patch "Fix responsive home layout"
```

### 8. (Optional) Manage services with PM2
```bash
bash scripts/pcb_pm2.sh start
bash scripts/pcb_pm2.sh status
bash scripts/pcb_pm2.sh logs
bash scripts/pcb_pm2.sh stop
```

Use Streamlit mode in PM2:

```bash
bash scripts/pcb_pm2.sh start streamlit
```

To use Streamlit instead of React as the main UI:

```bash
PCB_UI_MODE=streamlit bash scripts/start.sh
```

---

## 🕹️ Manual CLI (alternative)

If you prefer to manage the system manually:

```bash
# Activate virtual environment first
source .venv/bin/activate

python pcb.py start    # start backend + UI
python pcb.py stop     # stop all processes
python pcb.py status   # check running processes
```

Frontend manual commands:

```bash
npm --prefix frontend run dev
npm --prefix frontend run build
```

---

## 🤖 MCP Integration (Claude Desktop / AI Agents)

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "personal-context-bridge": {
      "command": "/absolute/path/to/.venv/bin/python",
      "args": ["/absolute/path/to/mcp_server.py"]
    }
  }
}
```

The MCP server exposes two tools to the agent:

| Tool | Description |
|---|---|
| `save_memory` | Save a memory entry to the vector database |
| `search_memory` | Semantically search stored memories |

---

## 📂 Project Structure

```
PersonalContextBridge/
├── scripts/
│   ├── install.sh       # one-time setup
│   ├── start.sh         # start backend + UI
│   ├── stop.sh          # stop all processes
│   ├── status.sh        # check running processes
│   ├── test.sh          # run backend + frontend tests
│   ├── release.sh       # bump version + update changelog
│   ├── pcb_pm2.sh       # optional PM2 process manager for laptop/dev setup
│   ├── frontend-dev.sh  # run React dev server
│   └── frontend-build.sh# build React app
├── backend/             # Python package (all logic)
│   ├── version.py       # backend version constant
│   ├── config.py        # constants
│   ├── models.py        # Pydantic models
│   ├── memory.py        # ChromaDB + embeddings core
│   ├── api.py           # FastAPI routes
│   ├── mcp_server.py    # MCP server implementation
│   └── ui.py            # Streamlit UI
├── frontend/            # React/Vite frontend module
│   ├── src/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── main.py              # entry point → uvicorn
├── mcp_server.py        # entry point → MCP stdio
├── app_ui.py            # entry point → Streamlit
├── pcb.py               # CLI orchestrator
├── VERSION              # single source of truth for app version
├── CHANGELOG.md         # release history
├── requirements.txt
└── local_memory/        # ChromaDB data (auto-created, git-ignored)
```

---

## 📝 Memory JSON Format

Tip: In the React home screen, use the `LLM_Instructions` button to open a copy-ready prompt that helps external LLMs generate valid memory JSON for this schema.

```json
{
  "metadata": {
    "model_used": "claude-3-5-sonnet",
    "topic_tags": ["Architecture", "Python", "AI"],
    "priority": "High"
  },
  "summary": "Design of a local vector memory system using ChromaDB and FastAPI.",
  "key_entities": {
    "concepts": ["Vector Database", "Embeddings", "Semantic Search"],
    "tools": ["FastAPI", "Streamlit", "ChromaDB"],
    "decisions": ["Use all-MiniLM-L6-v2 for local embeddings"],
    "pending_actions": ["Implement automated database backups"]
  },
  "context_reference": "PCB Project - Initial Phase"
}
```

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

---

## 🗺️ Roadmap

See [ROADMAP.md](ROADMAP.md) for the execution plan, including optional future tracks such as macOS `.pkg` packaging and other non-packaging improvements.

---

## ✅ Operational Best Practices

1. Always run `bash scripts/install.sh` after pulling changes.
2. Run `bash scripts/test.sh` before committing code changes.
3. Use `bash scripts/release.sh [major|minor|patch] "message"` for version changes instead of editing versions manually.
4. Treat `VERSION` as the single source of truth and let the release script sync the backend, frontend, and changelog.
5. Keep long-lived data (`local_memory/`) outside git.
6. Use scripts from `scripts/` instead of ad-hoc commands for consistency.
7. For local development, keep one terminal for backend/UI and another for frontend React dev server.
8. Configure MCP using the Python executable inside `.venv` to avoid dependency mismatches.

