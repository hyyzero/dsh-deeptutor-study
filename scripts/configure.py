"""Write DeepTutor's model configuration, wired to the Harness credential.

Reads the DeepSeek API key that the Harness already stores, then writes the two
files DeepTutor insists on:

    <home>/data/user/settings/model_catalog.json   LLM + embedding profiles
    <home>/data/user/settings/agents.yaml          default agent budgets

Idempotent: an existing catalog keeps every profile that is not ours.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

DSH_CREDENTIALS = Path(os.environ.get("USERPROFILE", "~")).expanduser() / ".dsh" / ".credentials.yaml"


def find_deepseek_key() -> str | None:
    """Pull DEEPSEEK_API_KEY out of the Harness credential file, if present."""
    for candidate in (DSH_CREDENTIALS, Path.home() / ".dsh" / ".credentials.yaml"):
        if not candidate.exists():
            continue
        text = candidate.read_text(encoding="utf-8", errors="replace")
        match = re.search(r"DEEPSEEK_API_KEY\s*:\s*['\"]?(sk-[A-Za-z0-9_\-]+)", text)
        if match:
            return match.group(1)
        match = re.search(r"(sk-[A-Za-z0-9_\-]{20,})", text)
        if match:
            return match.group(1)
    return None


def llm_profile(api_key: str) -> dict:
    return {
        "id": "deepseek",
        "name": "DeepSeek",
        "binding": "deepseek",
        "base_url": "https://api.deepseek.com",
        "api_key": api_key,
        "models": [
            {"id": "deepseek-chat", "name": "DeepSeek Chat", "model": "deepseek-chat"},
            {"id": "deepseek-reasoner", "name": "DeepSeek Reasoner", "model": "deepseek-reasoner"},
        ],
        "api_version": "",
        "extra_headers": {},
        "api_format": "auto",
        "wire_api": "auto",
    }


def embedding_profile(port: int) -> dict:
    return {
        "id": "local-bge",
        "name": "Local BGE (ONNX)",
        "binding": "custom",
        "base_url": f"http://127.0.0.1:{port}/v1/embeddings",
        "api_key": "sk-local-no-key",
        "models": [
            {
                "id": "bge-small-zh",
                "name": "BGE Small ZH",
                "model": "BAAI/bge-small-zh-v1.5",
                "dimension": 512,
                "supported_dimensions": "",
            }
        ],
        "api_version": "",
        "extra_headers": {},
    }


def merge(section: dict, profile: dict) -> dict:
    profiles = [p for p in section.get("profiles", []) if p.get("id") != profile["id"]]
    profiles.insert(0, profile)
    section["profiles"] = profiles
    section["active_profile_id"] = profile["id"]
    section.setdefault("active_model_id", None)
    return section


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plugin-root", required=True)
    parser.add_argument("--home", required=True)
    parser.add_argument("--embed-port", type=int, default=8787)
    args = parser.parse_args()

    home = Path(args.home)
    settings = home / "data" / "user" / "settings"
    settings.mkdir(parents=True, exist_ok=True)

    catalog_path = settings / "model_catalog.json"
    catalog = {"version": 1, "connections": [], "services": {}}
    if catalog_path.exists():
        try:
            catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            print(f"  existing catalog is unreadable, rewriting: {exc}")
    services = catalog.setdefault("services", {})
    for name in ("llm", "task", "embedding", "search", "tts", "stt", "imagegen", "videogen"):
        services.setdefault(name, {"active_profile_id": None, "profiles": []})

    key = find_deepseek_key()
    if key:
        merge(services["llm"], llm_profile(key))
        services["llm"]["active_model_id"] = "deepseek-chat"
        print("  LLM: 已接入 Harness 里的 DeepSeek 凭据")
    else:
        current = services["llm"].get("active_profile_id")
        print(f"  LLM: 没找到 DeepSeek 凭据（保留现有配置：{current or '空'}）")

    merge(services["embedding"], embedding_profile(args.embed_port))
    services["embedding"]["active_model_id"] = "bge-small-zh"
    print(f"  Embedding: http://127.0.0.1:{args.embed_port}/v1/embeddings")

    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"  写入 {catalog_path}")

    agents = settings / "agents.yaml"
    if not agents.exists():
        try:
            from deeptutor.services.setup.init import DEFAULT_AGENTS_SETTINGS  # type: ignore
            import yaml

            agents.write_text(
                yaml.safe_dump(DEFAULT_AGENTS_SETTINGS, allow_unicode=True, sort_keys=False),
                encoding="utf-8",
            )
            print(f"  写入 {agents}")
        except Exception as exc:  # noqa: BLE001
            print(f"  agents.yaml 未能生成（{exc}）；首次运行 DeepTutor 时会补上")
    return 0


if __name__ == "__main__":
    sys.exit(main())
