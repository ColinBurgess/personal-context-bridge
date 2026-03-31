# Entry point — actual implementation lives in backend/mcp_server.py
import asyncio
from backend.mcp_server import main

if __name__ == "__main__":
    asyncio.run(main())
