#!/usr/bin/env python3
"""Backup and restore utilities for PCB memories."""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.memory import backup_memories_to_file, restore_memories_from_file


def _default_backup_path() -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return Path("backups") / f"pcb_memories_{timestamp}.json"


def _backup(path: Path) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    result = backup_memories_to_file(str(path))
    print(f"Backup created: {result['file']}")
    print(f"Memories exported: {result['count']}")
    return 0


def _restore(path: Path, mode: str) -> int:
    if not path.exists():
        raise FileNotFoundError(f"Backup file not found: {path}")
    result = restore_memories_from_file(str(path), mode=mode)
    print(f"Restore completed from: {result['source_file']}")
    print(f"Mode: {result['mode']}")
    print(f"Memories imported: {result['imported']}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="PCB memory backup/restore utility")
    subparsers = parser.add_subparsers(dest="command", required=True)

    backup_parser = subparsers.add_parser("backup", help="Create a backup JSON file")
    backup_parser.add_argument(
        "--output",
        type=Path,
        default=_default_backup_path(),
        help="Output backup file path (default: backups/pcb_memories_<timestamp>.json)",
    )

    restore_parser = subparsers.add_parser("restore", help="Load memories from backup JSON")
    restore_parser.add_argument("--input", type=Path, required=True, help="Backup file path")
    restore_parser.add_argument(
        "--mode",
        choices=["append", "replace"],
        default="append",
        help="append: add to existing memories, replace: clear then import",
    )

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "backup":
        return _backup(args.output)
    if args.command == "restore":
        return _restore(args.input, args.mode)

    parser.error("Unknown command")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
