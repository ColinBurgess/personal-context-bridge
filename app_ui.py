"""Compatibility entry point for the Streamlit UI.

This keeps existing commands working:
- streamlit run app_ui.py
- python pcb.py start
"""

from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).parent / "backend" / "ui.py"))

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
