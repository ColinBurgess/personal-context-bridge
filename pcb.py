import subprocess
import sys
import os
import time
import threading
import psutil
from datetime import datetime
from typing import List

# --- Constants ---
PID_FILE = ".pcb_pids"
LOG_DIR = ".pcb_logs"
BACKEND_LOG = os.path.join(LOG_DIR, "backend.log")
FRONTEND_LOG = os.path.join(LOG_DIR, "frontend.log")
BACKEND_CMD = [sys.executable, "main.py"]
UI_MODE = os.getenv("PCB_UI_MODE", "react").strip().lower()
STREAMLIT_CMD = [
    "streamlit",
    "run",
    "backend/ui.py",
    "--server.port",
    "8501",
    "--server.headless",
    "true",
    "--browser.gatherUsageStats",
    "false",
]
REACT_CMD = ["npm", "--prefix", "frontend", "run", "dev"]
STARTUP_WAIT_SECONDS = 2
LOG_ROTATE_MAX_BYTES = 2 * 1024 * 1024
LOG_ROTATE_KEEP = 3


# --- PID file helpers ---
def read_pids() -> List[int]:
    if not os.path.exists(PID_FILE):
        return []
    with open(PID_FILE) as f:
        return [int(line.strip()) for line in f if line.strip()]


def write_pids(pids: List[int]):
    with open(PID_FILE, "w") as f:
        f.writelines(f"{pid}\n" for pid in pids)


def _is_running(pid: int) -> bool:
    try:
        return psutil.Process(pid).is_running()
    except psutil.NoSuchProcess:
        return False


def _ensure_log_dir():
    os.makedirs(LOG_DIR, exist_ok=True)


def _rotate_log_file(path: str):
    if not os.path.exists(path):
        return

    if os.path.getsize(path) < LOG_ROTATE_MAX_BYTES:
        return

    oldest = f"{path}.{LOG_ROTATE_KEEP}"
    if os.path.exists(oldest):
        os.remove(oldest)

    for index in range(LOG_ROTATE_KEEP - 1, 0, -1):
        src = f"{path}.{index}"
        dst = f"{path}.{index + 1}"
        if os.path.exists(src):
            os.replace(src, dst)

    os.replace(path, f"{path}.1")


def _frontend_cmd_and_url() -> tuple[list, str]:
    if UI_MODE == "streamlit":
        return STREAMLIT_CMD, "http://localhost:8501"
    return REACT_CMD, "http://localhost:3000"


def _tail_log(path: str, lines: int = 20) -> str:
    if not os.path.exists(path):
        return "(no log found)"
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        content = f.readlines()
    return "".join(content[-lines:]).strip() or "(log is empty)"


def _stream_process_output(process: subprocess.Popen, log_path: str, channel_label: str):
    if process.stdout is None:
        return

    with open(log_path, "a", encoding="utf-8") as log_file:
        log_file.write(f"\n--- session started {datetime.now().isoformat()} [{channel_label}] ---\n")
        for line in process.stdout:
            timestamp = datetime.now().isoformat(timespec="seconds")
            message = line.rstrip("\n")
            log_file.write(f"{timestamp} [{channel_label}] {message}\n")
        log_file.write(f"--- session ended {datetime.now().isoformat()} [{channel_label}] ---\n")


# --- Process helpers ---
def _spawn(cmd: list, label: str) -> subprocess.Popen:
    _ensure_log_dir()
    log_path = BACKEND_LOG if "Backend" in label else FRONTEND_LOG
    _rotate_log_file(log_path)

    process = subprocess.Popen(
        cmd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    channel_label = "backend" if "Backend" in label else "frontend"
    stream_thread = threading.Thread(
        target=_stream_process_output,
        args=(process, log_path, channel_label),
        daemon=True,
    )
    stream_thread.start()

    print(f"  {label} started (PID: {process.pid})")
    return process


# --- Commands ---
def start_system():
    existing = read_pids()
    alive_existing = [pid for pid in existing if _is_running(pid)]
    if alive_existing:
        print("⚠️  System already running. Use 'status' or 'stop' first.")
        show_status()
        return
    if existing and not alive_existing and os.path.exists(PID_FILE):
        os.remove(PID_FILE)

    print("🚀 Launching Personal Context Bridge...")
    try:
        frontend_cmd, frontend_url = _frontend_cmd_and_url()

        backend = _spawn(BACKEND_CMD, "📡 Backend")
        time.sleep(STARTUP_WAIT_SECONDS)
        if backend.poll() is not None:
            print("❌ Backend exited during startup.")
            print("Backend log tail:")
            print(_tail_log(BACKEND_LOG))
            return

        frontend = _spawn(frontend_cmd, "🎨 Frontend")
        time.sleep(STARTUP_WAIT_SECONDS)
        if frontend.poll() is not None:
            print("❌ Frontend exited during startup.")
            print("Frontend log tail:")
            print(_tail_log(FRONTEND_LOG))
            try:
                psutil.Process(backend.pid).terminate()
            except Exception:
                pass
            return

        write_pids([backend.pid, frontend.pid])
        print("\n✅ PCB ready!")
        print("   API → http://localhost:8000")
        print(f"   Web → {frontend_url}")
        print(f"   UI mode → {UI_MODE}")
        print("\nRun 'python pcb.py stop' to shut down.")
    except Exception as e:
        print(f"❌ Startup failed: {e}")
        stop_system()


def stop_system():
    pids = read_pids()
    if not pids:
        print("⚠️  No PCB processes running.")
        return

    print("🛑 Stopping PCB...")
    for pid in pids:
        try:
            proc = psutil.Process(pid)
            for child in proc.children(recursive=True):
                child.terminate()
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except psutil.TimeoutExpired:
                proc.kill()
            print(f"   PID {pid} terminated.")
        except psutil.NoSuchProcess:
            print(f"   PID {pid} already gone.")
        except Exception as e:
            print(f"   PID {pid} error: {e}")

    if os.path.exists(PID_FILE):
        os.remove(PID_FILE)
    print("✨ PCB shut down.")


def show_status():
    pids = read_pids()
    if not pids:
        print("🌑 PCB is OFF.")
        return

    alive_count = 0
    missing_count = 0
    for pid in pids:
        try:
            proc = psutil.Process(pid)
            print(f"   PID {pid}: {proc.name()} ({proc.status()})")
            alive_count += 1
        except psutil.NoSuchProcess:
            print(f"   PID {pid}: NOT FOUND")
            missing_count += 1

    if alive_count == len(pids):
        print("🟢 PCB is ON.")
    elif alive_count == 0:
        print("🌑 PCB is OFF (stale PID file).")
        if os.path.exists(PID_FILE):
            os.remove(PID_FILE)
    else:
        print("🟡 PCB is DEGRADED (some processes are down).")
        print(f"   Alive: {alive_count}, Missing: {missing_count}")


# --- CLI dispatch ---
COMMANDS = {
    "start": start_system,
    "stop": stop_system,
    "status": show_status,
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1].lower() not in COMMANDS:
        print(f"Usage: python pcb.py [{' | '.join(COMMANDS)}]")
        sys.exit(1)
    COMMANDS[sys.argv[1].lower()]()
