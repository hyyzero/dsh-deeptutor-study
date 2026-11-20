#!/usr/bin/env python3
"""List and dump DeepSeek Harness session transcripts.

The harness persists each session as ``session.v4.jsonl.zstd``: a multi-frame
zstd stream of JSONL records under ``<DSH_HOME>/sessions/<workspace>/<session>/``.
This helper turns that into something a person (or an agent) can read, so a
conversation can be summarised into a knowledge base.

Usage:
    python session-tool.py list [--limit N] [--json]
    python session-tool.py dump <session-id | index> [--max-chars N] [--reasoning]
"""

from __future__ import annotations

import argparse
import datetime as dt
import io
import json
import os
import re
import sys
from pathlib import Path

REMINDER = re.compile(
    r"<(system-reminder|hindsight_knowledge|hindsight_knowledge_refresh)>.*?</\1>",
    re.DOTALL,
)
RUNTIME_BLOCK = re.compile(r"^\s*Current runtime context\..*", re.DOTALL)

try:
    import zstandard
except ImportError:  # pragma: no cover - the setup script installs it
    zstandard = None


def sessions_root() -> Path:
    home = os.environ.get("DSH_HOME")
    base = Path(home) if home else Path.home() / ".dsh"
    return base / "sessions"


def read_records(path: Path) -> list[dict]:
    if path.suffix == ".zstd":
        if zstandard is None:
            raise SystemExit("缺少 zstandard：请先运行插件脚本 setup.ps1 或 pip install zstandard")
        decompressor = zstandard.ZstdDecompressor()
        with path.open("rb") as handle:
            # read_across_frames matters: the harness appends one frame per flush.
            text = decompressor.stream_reader(handle, read_across_frames=True).read().decode("utf-8")
    else:
        text = path.read_text(encoding="utf-8")
    records = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return records


def session_files() -> list[Path]:
    root = sessions_root()
    if not root.is_dir():
        return []
    files = [*root.rglob("session.v4.jsonl.zstd"), *root.rglob("session.v4.jsonl")]
    return sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)


def message_text(content) -> str:
    if isinstance(content, str):
        return content
    parts = []
    for block in content or []:
        if not isinstance(block, dict):
            continue
        if block.get("type") in ("text", "reasoning") and isinstance(block.get("text"), str):
            parts.append(block["text"])
    return "\n".join(parts).strip()


def clean_user_text(text: str) -> str:
    """Drop harness boilerplate so the transcript reads like the conversation."""
    text = REMINDER.sub("", text or "")
    if text.startswith("Time sampled while preparing turn"):
        return ""
    if RUNTIME_BLOCK.match(text):
        return ""
    return text.strip()


def stamp(ms) -> str:
    try:
        return dt.datetime.fromtimestamp(ms / 1000).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return "?"


def describe(path: Path) -> dict:
    records = read_records(path)
    header = next((r for r in records if r.get("type") == "session"), {})
    title = next((r["data"].get("title") for r in records if r.get("type") == "session/title" and r.get("data")), None)
    users = [r for r in records if r.get("type") == "user/message"]
    assistants = [r for r in records if r.get("type") == "assistant/message"]
    if not title and users:
        first = clean_user_text(message_text(users[0].get("data", {}).get("content")))
        title = (first[:40] + "…") if len(first) > 40 else first
    last_time = max((r.get("time", 0) for r in records), default=0)
    return {
        "id": header.get("id") or path.parent.name,
        "title": title or "(无标题)",
        "cwd": header.get("cwd") or "",
        "preset": header.get("agentPreset") or "",
        "createdAt": stamp(header.get("createdAt") or 0),
        "updatedAt": stamp(last_time or int(path.stat().st_mtime * 1000)),
        "mtime": path.stat().st_mtime,
        "userTurns": len(users),
        "assistantMessages": len(assistants),
        "bytes": path.stat().st_size,
        "path": str(path),
    }


def cmd_list(args) -> int:
    rows = [describe(path) for path in session_files()]
    rows = [row for row in rows if row["userTurns"] > 0 or row["assistantMessages"] > 0]
    if args.limit:
        rows = rows[: args.limit]
    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0
    if not rows:
        print("没有找到有内容的会话。")
        return 0
    print(f"{'#':>2}  {'更新时间':<16} {'轮次':>4} {'消息':>4}  标题")
    for index, row in enumerate(rows, start=1):
        print(f"{index:>2}  {row['updatedAt']:<16} {row['userTurns']:>4} {row['assistantMessages']:>4}  {row['title']}")
        print(f"    id={row['id']}  cwd={row['cwd']}")
    return 0


def render(records: list[dict], meta: dict, *, reasoning: bool, max_chars: int) -> str:
    out = io.StringIO()
    out.write(f"# {meta['title']}\n\n")
    out.write(f"- 会话 ID：`{meta['id']}`\n")
    out.write(f"- 工作区：`{meta['cwd']}`\n")
    out.write(f"- 时间：{meta['createdAt']} → {meta['updatedAt']}\n")
    out.write(f"- 预设：{meta['preset'] or '未知'}\n")
    out.write(f"- 用户轮次：{meta['userTurns']}，助手消息：{meta['assistantMessages']}\n\n")
    for record in records:
        kind = record.get("type")
        data = record.get("data") or {}
        when = stamp(record.get("time") or 0)
        if kind == "user/message":
            text = clean_user_text(message_text(data.get("content")))
            if not text:
                continue
            out.write(f"\n## 用户 · {when}\n\n{text}\n")
        elif kind == "assistant/message":
            message = data.get("message") or {}
            blocks = message.get("content") or []
            text = message_text([b for b in blocks if isinstance(b, dict) and b.get("type") == "text"])
            if text:
                out.write(f"\n## 助手 · {when}\n\n{text}\n")
            if reasoning:
                thought = message_text([b for b in blocks if isinstance(b, dict) and b.get("type") == "reasoning"])
                if thought:
                    out.write(f"\n> 思考：{thought[:2000]}\n")
        elif kind == "tool/call":
            name = data.get("name") or "?"
            arguments = data.get("arguments")
            if not isinstance(arguments, str):
                arguments = json.dumps(arguments, ensure_ascii=False)
            arguments = arguments.replace("\n", " ")
            out.write(f"\n- 工具 `{name}`：`{arguments[:300]}`\n")
        elif kind == "tool/result":
            message = data.get("message") or {}
            text = message_text(message.get("content"))
            if text:
                snippet = text.replace("\n", " ")[:300]
                out.write(f"  - 结果：`{snippet}`\n")
    text = out.getvalue()
    if len(text) > max_chars:
        text = text[:max_chars] + f"\n\n…（已截断，原文 {len(text)} 字符）\n"
    return text


def cmd_dump(args) -> int:
    files = session_files()
    target = None
    if args.session.isdigit():
        index = int(args.session)
        if not 1 <= index <= len(files):
            print(f"序号超出范围（共 {len(files)} 个会话）", file=sys.stderr)
            return 2
        target = files[index - 1]
    else:
        for path in files:
            if args.session in path.parent.name or args.session in str(path):
                target = path
                break
    if target is None:
        print(f"找不到会话：{args.session}", file=sys.stderr)
        return 2
    meta = describe(target)
    text = render(read_records(target), meta, reasoning=args.reasoning, max_chars=args.max_chars)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"已写入 {args.out}（{len(text)} 字符）")
    else:
        print(text)
    return 0


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    parser = argparse.ArgumentParser(description="List and dump Harness session transcripts")
    sub = parser.add_subparsers(dest="command", required=True)

    listing = sub.add_parser("list", help="list sessions with content")
    listing.add_argument("--limit", type=int, default=20)
    listing.add_argument("--json", action="store_true")
    listing.set_defaults(func=cmd_list)

    dump = sub.add_parser("dump", help="dump one session as readable markdown")
    dump.add_argument("session", help="session id, path fragment, or the index printed by list")
    dump.add_argument("--max-chars", type=int, default=600000)
    dump.add_argument("--reasoning", action="store_true", help="include assistant reasoning blocks")
    dump.add_argument("--out", help="write to this file instead of stdout")
    dump.set_defaults(func=cmd_dump)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
