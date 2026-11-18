"""OpenAI-compatible /v1/embeddings server backed by fastembed (ONNX).

Kept dependency-light on purpose: no web framework, just http.server, so the
same file works on any machine once fastembed is installed.

    python embed_server.py --port 8787 --cache <dir>

DeepTutor expects the endpoint to end with /embeddings and does not join paths
itself, so point it at http://127.0.0.1:<port>/v1/embeddings.
"""
import argparse
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

from fastembed import TextEmbedding  # noqa: E402

MODEL_NAME = "BAAI/bge-small-zh-v1.5"

_model = None
_cache = None


def get_model():
    global _model
    if _model is None:
        _model = TextEmbedding(model_name=MODEL_NAME, cache_dir=_cache)
    return _model


def to_texts(payload):
    inp = payload.get("input")
    if isinstance(inp, str):
        return [inp]
    texts = []
    if isinstance(inp, list):
        for item in inp:
            if isinstance(item, str):
                texts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                texts.append(item["text"])
    return texts


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.rstrip("/")
        if path.endswith("/models") or path == "/health" or path == "":
            self._send(200, {"object": "list", "data": [{"id": MODEL_NAME, "object": "model", "owned_by": "local"}]})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw or b"{}")
        except Exception:
            self._send(400, {"error": "invalid json"})
            return
        texts = to_texts(payload)
        if not texts:
            self._send(400, {"error": "input is required"})
            return
        try:
            vectors = list(get_model().embed(texts))
        except Exception as exc:  # noqa: BLE001
            self._send(500, {"error": str(exc)})
            return
        data = [
            {"object": "embedding", "index": i, "embedding": [float(x) for x in vec]}
            for i, vec in enumerate(vectors)
        ]
        tokens = sum(len(t) for t in texts)
        self._send(200, {
            "object": "list",
            "data": data,
            "model": payload.get("model") or MODEL_NAME,
            "usage": {"prompt_tokens": tokens, "total_tokens": tokens},
        })

    def log_message(self, *args):
        pass


def main():
    global _cache
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("DEEP_EMBED_PORT", "8787")))
    parser.add_argument("--cache", default=os.environ.get("DEEP_EMBED_CACHE", os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "bge")))
    args = parser.parse_args()
    _cache = args.cache
    dim = len(list(get_model().embed(["warmup"]))[0])
    print(f"embedding server: {MODEL_NAME} dim={dim} on http://127.0.0.1:{args.port}/v1", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    sys.exit(main())
