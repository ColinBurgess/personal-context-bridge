# Entry point — actual implementation lives in backend/api.py
from backend.api import app  # noqa: F401 — re-exported for uvicorn

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
