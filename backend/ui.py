import streamlit as st
import requests
import json
from datetime import datetime
from streamlit_agraph import agraph, Node, Edge, Config

API_URL = "http://localhost:8000"


# --- API helpers ---
def api_get(endpoint: str, params: dict | None = None):
    return requests.get(f"{API_URL}/{endpoint}", params=params)


def api_post(endpoint: str, data: dict):
    return requests.post(f"{API_URL}/{endpoint}", json=data)


def show_api_error(response):
    st.error(f"❌ API Error: {response.text}")


# --- Graph builder ---
def build_knowledge_graph(memories: list):
    nodes, edges, seen = [], [], set()

    for mem in memories:
        meta = mem["metadata"]
        context = meta["context_reference"]
        tags = json.loads(meta["topic_tags"]) if isinstance(meta["topic_tags"], str) else meta["topic_tags"]

        if context not in seen:
            nodes.append(Node(id=context, label=context, size=25, color="#10b981"))
            seen.add(context)

        for tag in tags:
            if tag not in seen:
                nodes.append(Node(id=tag, label=tag, size=15, color="#3b82f6"))
                seen.add(tag)
            edges.append(Edge(source=context, target=tag, label="relates to"))

    config = Config(
        width=900, height=600, directed=True,
        nodeHighlightBehavior=True, highlightColor="#F7A7A6",
        staticGraph=False, collapsible=True,
    )

    if nodes:
        agraph(nodes=nodes, edges=edges, config=config)
    else:
        st.info("No memories found to build a graph.")


# --- Page setup ---
st.set_page_config(page_title="Personal Context Bridge (PCB)", layout="wide")
st.title("🌉 Personal Context Bridge (PCB)")
st.markdown("### Local AI Context & Memory Orchestrator")

with st.sidebar:
    st.header("Quick Start")
    st.info("""
    1. Ensure the backend is running (`python pcb.py start`).
    2. Paste your memory JSON in the text area.
    3. Click 'Save Memory'.
    4. Use the search section to retrieve semantic context.
    5. Check the Graph tab for entity relationships.
    """)

tab1, tab2, tab3 = st.tabs(["📥 Store Memory", "🔍 Semantic Search", "🕸️ Knowledge Graph"])

with tab1:
    st.header("Store New Memory")
    json_input = st.text_area("Paste Memory JSON here:", height=250, placeholder='''{
  "metadata": {"timestamp": "2024-03-20T10:00:00", "model_used": "GPT-4", "topic_tags": ["Python", "FastAPI"], "priority": "High"},
  "summary": "Implementation of a REST API with FastAPI for memory persistence.",
  "key_entities": {"concepts": ["FastAPI", "REST"], "tools": ["Uvicorn"], "decisions": ["Use Pydantic"], "pending_actions": ["Add tests"]},
  "context_reference": "PCB Project - Backend"
}''')

    if st.button("💾 Save Memory"):
        if not json_input:
            st.warning("⚠️ Please enter a JSON before saving.")
        else:
            try:
                response = api_post("save_memory", json.loads(json_input))
                if response.status_code == 200:
                    st.success(f"✅ Memory saved! ID: {response.json().get('id')}")
                else:
                    show_api_error(response)
            except json.JSONDecodeError:
                st.error("❌ Invalid JSON format. Please check your syntax.")
            except Exception as e:
                st.error(f"❌ Connection error: {e}")

with tab2:
    st.header("Semantic Search")
    query = st.text_input("Enter your query (e.g., 'How did I implement the API?')")

    if st.button("🔎 Search"):
        if not query:
            st.warning("⚠️ Please enter a query to search.")
        else:
            try:
                response = api_get("search_memory", {"query": query})
                if response.status_code == 200:
                    results = response.json()
                    if results:
                        st.write(f"Found {len(results)} similar result(s):")
                        for res in results:
                            with st.expander(f"{res['summary'][:60]}… (Distance: {res['distance']:.4f})"):
                                st.write(f"**Summary:** {res['summary']}")
                                st.write(f"**Metadata:** {res['metadata']}")
                                st.write(f"**ID:** {res['id']}")
                    else:
                        st.info("No similar memories found.")
                else:
                    show_api_error(response)
            except Exception as e:
                st.error(f"❌ Connection error: {e}")

with tab3:
    st.header("Knowledge Graph")
    st.markdown("Visualizing relationships between topic tags and context references.")

    if st.button("🔄 Refresh Graph"):
        try:
            response = api_get("get_all_memories")
            if response.status_code == 200:
                build_knowledge_graph(response.json())
            else:
                show_api_error(response)
        except Exception as e:
            st.error(f"❌ Connection error: {e}")

st.markdown("---")
st.caption(f"PCB v1.1 - {datetime.now().year} | Built with FastAPI, ChromaDB, and Streamlit")
