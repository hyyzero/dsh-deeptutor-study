#!/usr/bin/env python3
"""Turn one Harness conversation into a detailed study note and index it.

Run by the plugin's host route when the composer button asks for a digest:

    python digest.py --session <id> --kb <name> --title <file stem>
                     [--home <DEEPTUTOR_HOME>] [--chunk-chars 24000]

It reads the session transcript, summarises it with the DeepSeek credential the
plugin already wrote into model_catalog.json (map-reduce, so long conversations
still produce a detailed document), writes the markdown into the knowledge
base's raw/ folder and finally runs `deeptutor kb add` so it becomes searchable.

Progress goes to stdout line by line; the host streams it back as a job log.
"""

from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_session_tool():
    """Import the sibling session-tool.py (its name is not a valid module name)."""
    spec = importlib.util.spec_from_file_location("dsh_session_tool", HERE / "session-tool.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def log(message: str) -> None:
    print(message, flush=True)


def read_catalog(home: Path) -> dict:
    path = home / "data" / "user" / "settings" / "model_catalog.json"
    return json.loads(path.read_text(encoding="utf-8"))


def pick_llm(catalog: dict) -> tuple[str, str, str]:
    """Return (base_url, api_key, model) for the active LLM profile."""
    service = catalog.get("services", {}).get("llm", {})
    profiles = service.get("profiles") or []
    profile = next((row for row in profiles if row.get("id") == service.get("active_profile_id")), None) or (profiles[0] if profiles else None)
    if not profile:
        raise SystemExit("model_catalog.json 里没有可用的 LLM 配置")
    models = profile.get("models") or []
    model = next((row for row in models if row.get("id") == service.get("active_model_id")), None) or (models[0] if models else None)
    if not model:
        raise SystemExit("model_catalog.json 里没有可用的模型")
    base = str(profile.get("base_url") or "https://api.deepseek.com").rstrip("/")
    return base, str(profile.get("api_key") or ""), str(model.get("model") or model.get("id"))


def chat(base: str, key: str, model: str, messages: list[dict], *, temperature: float = 0.3, timeout: int = 600) -> str:
    url = f"{base}/chat/completions"
    body = json.dumps({"model": model, "messages": messages, "temperature": temperature, "stream": False}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"content-type": "application/json", "authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:400]
        raise SystemExit(f"模型调用失败 HTTP {error.code}: {detail}")
    choices = payload.get("choices") or []
    if not choices:
        raise SystemExit(f"模型没有返回内容: {json.dumps(payload)[:400]}")
    content = choices[0].get("message", {}).get("content")
    if not isinstance(content, str) or not content.strip():
        raise SystemExit("模型返回了空内容")
    return content.strip()


SYSTEM = (
    "你是学习内容整理专家。用户会把一段编程/学习对话记录交给你，"
    "你要把它整理成一份能长期查阅的知识文档。不许编造：对话里没验证的东西要标明「未验证」。"
)

STRUCTURE = """请把下面这段对话整理成一份**详细**的中文学习文档，用 markdown，必须包含：

1. 一句话结论：这段对话最终解决了什么 / 得出了什么
2. 背景与目标：用户一开始要做什么、约束是什么（环境、版本、权限）
3. 过程与关键决策：按阶段写，每步做了什么、为什么这么选、失败过什么
4. 关键结论与原理：机制层面的解释，不要只写「改成 X 就好了」
5. 可复现的步骤 / 命令 / 代码：原样抄录关键命令、路径、版本号
6. 坑与修复：用表格写「现象 → 原因 → 处理」
7. 未解决 / 待验证 / 风险：区分「已验证」与「只是推测」
8. 速查表：关键路径、端口、命令、配置项一张表收尾

硬性要求：
- 至少 1 张 mermaid 图（flowchart / sequenceDiagram / graph 任选），凡是多步骤、多组件、前后对比的地方都要画图
- 数据、选项、排障条目用表格，不要堆成一段段文字
- 不要写「根据对话内容」这类空话，直接给结论
- 篇幅可以长，宁可详细"""

MERGE = """下面是对同一段长对话分段整理出的多份笔记。请把它们合并成一份完整、连贯、
不重复的中文学习文档，保留所有关键细节、命令、表格和 mermaid 图（可以重新组织），
并保证结构完整。不要丢掉任何一段里独有的信息。"""


def chunk_text(text: str, limit: int) -> list[str]:
    if len(text) <= limit:
        return [text]
    parts: list[str] = []
    current: list[str] = []
    size = 0
    for block in text.split("\n\n"):
        if size + len(block) > limit and current:
            parts.append("\n\n".join(current))
            current, size = [], 0
        current.append(block)
        size += len(block) + 2
    if current:
        parts.append("\n\n".join(current))
    return parts


def main() -> int:
    parser = argparse.ArgumentParser(description="Digest one Harness session into a knowledge base")
    parser.add_argument("--session", required=True, help="session id or transcript file")
    parser.add_argument("--kb", required=True)
    parser.add_argument("--title", default="")
    parser.add_argument("--home", required=True, help="DeepTutor home (holds model_catalog.json and knowledge_bases)")
    parser.add_argument("--chunk-chars", type=int, default=24000)
    parser.add_argument("--no-reasoning", action="store_true")
    args = parser.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    home = Path(args.home)
    tool = load_session_tool()

    started = time.time()
    log(f"[1/4] 读取会话 {args.session}")
    files = tool.session_files()
    target = None
    if Path(args.session).is_file():
        target = Path(args.session)
    else:
        for path in files:
            if args.session in path.parent.name or args.session in str(path):
                target = path
                break
    if target is None:
        raise SystemExit(f"找不到会话：{args.session}")
    meta = tool.describe(target)
    records = tool.read_records(target)
    transcript = tool.render(records, meta, reasoning=not args.no_reasoning, max_chars=10_000_000)
    log(f"    会话「{meta['title']}」 {len(transcript)} 字符 / {meta['userTurns']} 轮")

    catalog = read_catalog(home)
    base, key, model = pick_llm(catalog)
    log(f"[2/4] 调用模型 {model} 生成知识文档")

    chunks = chunk_text(transcript, args.chunk_chars)
    if len(chunks) == 1:
        document = chat(base, key, model, [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"{STRUCTURE}\n\n---\n\n{chunks[0]}"},
        ])
    else:
        notes: list[str] = []
        for index, chunk in enumerate(chunks, start=1):
            log(f"    分段 {index}/{len(chunks)}（{len(chunk)} 字符）")
            note = chat(base, key, model, [
                {"role": "system", "content": SYSTEM},
                {
                    "role": "user",
                    "content": (
                        "这是长对话的第 "
                        f"{index}/{len(chunks)} 段。请提取这一段里所有值得长期保留的知识点："
                        "概念、命令、路径、配置、失败与修复、结论，写成分条笔记，"
                        "保留关键原文（命令/路径/版本号）。不要总结成空话。\n\n---\n\n" + chunk
                    ),
                },
            ])
            notes.append(f"## 第 {index} 段\n\n{note}")
        log("    合并分段笔记")
        document = chat(base, key, model, [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"{MERGE}\n\n{STRUCTURE}\n\n---\n\n" + "\n\n".join(notes)},
        ])

    stamp = dt.datetime.now().strftime("%Y-%m-%d")
    stem = args.title.strip() or f"{stamp}-{meta['title'][:40]}"
    for bad in '\\/:*?"<>|':
        stem = stem.replace(bad, "-")
    stem = stem.strip() or f"{stamp}-digest"

    kb_root = home / "data" / "knowledge_bases" / args.kb
    raw = kb_root / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    target_file = raw / f"{stem}.md"
    header = (
        f"---\n"
        f"source_session: {meta['id']}\n"
        f"source_title: {json.dumps(meta['title'], ensure_ascii=False)}\n"
        f"digested_at: {dt.datetime.now().isoformat(timespec='seconds')}\n"
        f"---\n\n"
    )
    target_file.write_text(header + document.strip() + "\n", encoding="utf-8")
    log(f"[3/4] 已写入 {target_file}（{len(document)} 字符）")

    log("[4/4] 建索引（deeptutor kb add）")
    deeptutor = Path(sys.executable).with_name("deeptutor.exe")
    command = [str(deeptutor), "kb", "add", args.kb, "--docs-dir", str(raw)]
    env = {**os.environ, "DEEPTUTOR_HOME": str(home), "PYTHONIOENCODING": "utf-8",
           "NO_PROXY": "127.0.0.1,localhost,::1", "no_proxy": "127.0.0.1,localhost,::1"}
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env, cwd=str(HERE.parent))
    tail = (result.stdout or "").strip().splitlines()[-3:]
    for line in tail:
        log("    " + line)
    if result.returncode != 0:
        for line in (result.stderr or "").strip().splitlines()[-6:]:
            log("    " + line)
        log(f"!! 建索引失败（退出码 {result.returncode}），文档已写好但还不能被检索")
        return 1
    log(f"完成 · {args.kb} · {target_file.name} · {len(document)} 字符 · {int(time.time() - started)}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
