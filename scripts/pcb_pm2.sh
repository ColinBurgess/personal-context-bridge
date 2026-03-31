#!/usr/bin/env bash

set -euo pipefail

APP_PREFIX="PCB"
BACKEND_APP="${APP_PREFIX}-Backend"
FRONTEND_REACT_APP="${APP_PREFIX}-Frontend-React"
FRONTEND_STREAMLIT_APP="${APP_PREFIX}-Frontend-Streamlit"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VENV_PYTHON="${PROJECT_ROOT}/.venv/bin/python"

red()   { echo -e "\033[0;31m$*\033[0m"; }
green() { echo -e "\033[0;32m$*\033[0m"; }
info()  { echo -e "\033[0;34m➜ $*\033[0m"; }

print_help() {
    echo "Personal Context Bridge PM2 controller"
    echo ""
    echo "Usage:"
    echo "  bash scripts/pcb_pm2.sh <command> [ui_mode]"
    echo ""
    echo "Commands:"
    echo "  start [react|streamlit]    Start PCB with PM2 (default: react)"
    echo "  stop                       Stop PCB processes in PM2"
    echo "  restart                    Restart PCB processes in PM2"
    echo "  status                     Show PM2 status for PCB processes"
    echo "  logs                       Show PM2 logs for PCB processes"
    echo "  delete                     Delete PCB processes from PM2"
    echo "  help                       Show this help"
    echo ""
    echo "Examples:"
    echo "  bash scripts/pcb_pm2.sh start"
    echo "  bash scripts/pcb_pm2.sh start streamlit"
    echo "  bash scripts/pcb_pm2.sh status"
}

ensure_pm2() {
    if ! command -v pm2 >/dev/null 2>&1; then
        red "Error: pm2 is not installed or not available in PATH."
        echo "Install it with: npm install -g pm2"
        exit 1
    fi
}

ensure_venv_python() {
    if [ ! -x "${VENV_PYTHON}" ]; then
        red "Error: Python virtual environment not found."
        echo "Run: bash scripts/install.sh"
        exit 1
    fi
}

pm2_process_exists() {
    local app_name="$1"
    pm2 describe "$app_name" >/dev/null 2>&1
}

start_or_restart_backend() {
    if pm2_process_exists "${BACKEND_APP}"; then
        pm2 restart "${BACKEND_APP}" >/dev/null
    else
        pm2 start "${VENV_PYTHON}" --name "${BACKEND_APP}" --cwd "${PROJECT_ROOT}" -- main.py >/dev/null
    fi
}

start_or_restart_frontend_react() {
    if pm2_process_exists "${FRONTEND_REACT_APP}"; then
        pm2 restart "${FRONTEND_REACT_APP}" >/dev/null
    else
        pm2 start npm --name "${FRONTEND_REACT_APP}" --cwd "${PROJECT_ROOT}" -- --prefix frontend run dev >/dev/null
    fi
}

start_or_restart_frontend_streamlit() {
    if pm2_process_exists "${FRONTEND_STREAMLIT_APP}"; then
        pm2 restart "${FRONTEND_STREAMLIT_APP}" >/dev/null
    else
        pm2 start "${VENV_PYTHON}" --name "${FRONTEND_STREAMLIT_APP}" --cwd "${PROJECT_ROOT}" -- -m streamlit run backend/ui.py --server.port 8501 --server.headless true --browser.gatherUsageStats false >/dev/null
    fi
}

stop_if_exists() {
    local app_name="$1"
    if pm2_process_exists "$app_name"; then
        pm2 stop "$app_name" >/dev/null
    fi
}

delete_if_exists() {
    local app_name="$1"
    if pm2_process_exists "$app_name"; then
        pm2 delete "$app_name" >/dev/null
    fi
}

start_processes() {
    local ui_mode="${1:-react}"

    ensure_pm2
    ensure_venv_python

    case "$ui_mode" in
        react)
            info "Starting PCB with React frontend on PM2..."
            start_or_restart_backend
            delete_if_exists "${FRONTEND_STREAMLIT_APP}"
            start_or_restart_frontend_react
            green "✅ PCB started with PM2 (React mode)."
            echo "API  -> http://localhost:8000"
            echo "Web  -> http://localhost:3000"
            ;;
        streamlit)
            info "Starting PCB with Streamlit frontend on PM2..."
            start_or_restart_backend
            delete_if_exists "${FRONTEND_REACT_APP}"
            start_or_restart_frontend_streamlit
            green "✅ PCB started with PM2 (Streamlit mode)."
            echo "API  -> http://localhost:8000"
            echo "Web  -> http://localhost:8501"
            ;;
        *)
            red "Unknown UI mode: $ui_mode"
            echo "Use: react or streamlit"
            exit 1
            ;;
    esac
}

stop_processes() {
    ensure_pm2
    info "Stopping PCB PM2 processes..."
    stop_if_exists "${BACKEND_APP}"
    stop_if_exists "${FRONTEND_REACT_APP}"
    stop_if_exists "${FRONTEND_STREAMLIT_APP}"
    green "✅ PCB PM2 processes stopped."
}

restart_processes() {
    ensure_pm2
    info "Restarting PCB PM2 processes..."
    if pm2_process_exists "${BACKEND_APP}"; then
        pm2 restart "${BACKEND_APP}" >/dev/null
    else
        red "Backend process is not registered in PM2. Use 'start' first."
        exit 1
    fi

    if pm2_process_exists "${FRONTEND_REACT_APP}"; then
        pm2 restart "${FRONTEND_REACT_APP}" >/dev/null
    elif pm2_process_exists "${FRONTEND_STREAMLIT_APP}"; then
        pm2 restart "${FRONTEND_STREAMLIT_APP}" >/dev/null
    else
        red "Frontend process is not registered in PM2. Use 'start' first."
        exit 1
    fi
    green "✅ PCB PM2 processes restarted."
}

status_processes() {
    ensure_pm2
    pm2 status "${BACKEND_APP}" "${FRONTEND_REACT_APP}" "${FRONTEND_STREAMLIT_APP}"
}

logs_processes() {
    ensure_pm2
    pm2 logs "${BACKEND_APP}" "${FRONTEND_REACT_APP}" "${FRONTEND_STREAMLIT_APP}"
}

delete_processes() {
    ensure_pm2
    info "Deleting PCB PM2 process definitions..."
    delete_if_exists "${BACKEND_APP}"
    delete_if_exists "${FRONTEND_REACT_APP}"
    delete_if_exists "${FRONTEND_STREAMLIT_APP}"
    green "✅ PCB PM2 process definitions removed."
}

command="${1:-help}"
ui_mode="${2:-react}"

case "$command" in
    start)
        start_processes "$ui_mode"
        ;;
    stop)
        stop_processes
        ;;
    restart)
        restart_processes
        ;;
    status)
        status_processes
        ;;
    logs)
        logs_processes
        ;;
    delete)
        delete_processes
        ;;
    help|-h|--help)
        print_help
        ;;
    *)
        red "Unknown command: $command"
        echo ""
        print_help
        exit 1
        ;;
esac
