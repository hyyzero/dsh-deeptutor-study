#!/usr/bin/env python
"""bookctl - drive DeepTutor BookEngine to generate a whole book.

The `deeptutor book` CLI only exposes list/health/refresh-fingerprints;
authoring lives behind FastAPI routes, but BookEngine itself does not
import fastapi. This script calls BookEngine directly and chains
create -> proposal -> spine -> compile -> export.

stdout carries exactly one JSON line (for the agent); progress goes to stderr.

  python bookctl.py list
  python bookctl.py create  --intent "..." [--kb demo-note] [--depth brief] [--lang zh]
  python bookctl.py spine   --book bk_xxx
  python bookctl.py compile --book bk_xxx [--page pg_xxx] [--max 3]
  python bookctl.py export  --book bk_xxx [--out path.md]
  python bookctl.py status  --book bk_xxx
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def emit(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False, default=str), flush=True)


def _engine():
    from deeptutor.book import get_book_engine

    return get_book_engine()


def _find_book(book_id):
    engine = _engine()
    books = engine.list_books()
    if not books:
        raise SystemExit("No books yet. Run `bookctl.py create` first.")
    if book_id is None:
        return engine, books[0]
    for b in books:
        if b.id == book_id:
            return engine, b
    raise SystemExit(f"Book {book_id} not found. Existing: {[b.id for b in books]}")


def cmd_list(_args) -> None:
    engine = _engine()
    books = engine.list_books()
    emit({
        "ok": True,
        "count": len(books),
        "books": [{
            "id": b.id,
            "title": b.title,
            "status": b.status.value,
            "chapters": b.chapter_count,
            "pages": b.page_count,
            "depth": b.depth,
            "language": b.language,
            "knowledge_bases": b.knowledge_bases,
            "stale_pages": len(b.stale_page_ids or []),
        } for b in books],
    })


def cmd_create(args) -> None:
    engine = _engine()

    async def run():
        log(f"Ideating: {args.intent}")
        t0 = time.time()
        book, proposal = await engine.create_book(
            user_intent=args.intent,
            knowledge_bases=[args.kb] if args.kb else None,
            language=args.lang,
            fallback_language=args.lang,
            depth=args.depth,
        )
        log(f"Proposal done in {time.time() - t0:.1f}s")
        return book, proposal

    book, proposal = asyncio.run(run())
    emit({
        "ok": True,
        "book_id": book.id,
        "status": book.status.value,
        "title": proposal.title,
        "description": proposal.description,
        "scope": getattr(proposal, "scope", ""),
        "target_level": getattr(proposal, "target_level", ""),
        "estimated_chapters": proposal.estimated_chapters,
        "rationale": proposal.rationale,
        "next": f"python bookctl.py spine --book {book.id}",
    })


def cmd_spine(args) -> None:
    engine, book = _find_book(args.book)

    async def run():
        log(f"Confirming proposal for: {book.title}")
        _, spine = await engine.confirm_proposal(book_id=book.id)
        return spine

    spine = asyncio.run(run())
    reloaded = engine.load_book(book.id)
    emit({
        "ok": True,
        "book_id": book.id,
        "status": reloaded.status.value if reloaded else "unknown",
        "chapters": [{
            "order": c.order,
            "id": c.id,
            "title": c.title,
            "content_type": getattr(c.content_type, "value", str(c.content_type)),
            "objectives": list(c.learning_objectives),
        } for c in spine.chapters],
        "next": f"python bookctl.py compile --book {book.id}",
    })


def cmd_compile(args) -> None:
    engine, book = _find_book(args.book)

    async def run():
        if engine.load_spine(book.id) is None:
            raise SystemExit("No spine yet. Run `spine` first.")
        pages = engine.list_pages(book.id)
        if not pages:
            log("Creating page shells...")
            pages = await engine.confirm_spine(book_id=book.id, auto_compile=False)

        if args.page:
            todo = [p for p in pages if p.id == args.page]
            if not todo:
                raise SystemExit(f"Page {args.page} not found")
        else:
            todo = [p for p in pages if p.status.value != "ready"]
        if args.max:
            todo = todo[: args.max]
        if not todo:
            log("Every page is already compiled.")
            return []

        results = []
        for p in todo:
            t0 = time.time()
            log(f"Compiling [{p.order}] {p.title} ...")
            try:
                page = await engine.compile_page(book_id=book.id, page_id=p.id)
                results.append({
                    "page_id": page.id,
                    "order": page.order,
                    "title": page.title,
                    "status": page.status.value,
                    "blocks": len(page.blocks),
                    "seconds": round(time.time() - t0, 1),
                    "error": page.error,
                })
                log(f"  -> {page.status.value}, {len(page.blocks)} blocks, {time.time() - t0:.1f}s")
            except Exception as exc:
                results.append({
                    "page_id": p.id,
                    "order": p.order,
                    "title": p.title,
                    "status": "error",
                    "error": f"{type(exc).__name__}: {exc}",
                })
                log(f"  -> failed: {exc}")
        return results

    results = asyncio.run(run())
    pages = engine.list_pages(book.id)
    remaining = [p.id for p in pages if p.status.value != "ready"]
    emit({
        "ok": all(r.get("status") == "ready" for r in results) if results else True,
        "book_id": book.id,
        "compiled": results,
        "remaining_pages": remaining,
        "next": (
            f"python bookctl.py compile --book {book.id}"
            if remaining
            else f"python bookctl.py export --book {book.id}"
        ),
    })


def cmd_export(args) -> None:
    from deeptutor.book.export import export_filename, render_book_markdown

    engine, book = _find_book(args.book)
    spine = engine.load_spine(book.id)
    pages = engine.list_pages(book.id)
    md = render_book_markdown(book, spine, pages)

    name = args.out or export_filename(book)
    out = Path(name)
    if not out.is_absolute():
        out = Path.cwd() / out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(md, encoding="utf-8")
    log(f"Wrote {out} ({len(md)} chars)")
    emit({
        "ok": True,
        "book_id": book.id,
        "title": book.title,
        "path": str(out),
        "chars": len(md),
        "pages": len(pages),
        "pages_ready": sum(1 for p in pages if p.status.value == "ready"),
    })


def cmd_status(args) -> None:
    engine, book = _find_book(args.book)
    pages = engine.list_pages(book.id)
    spine = engine.load_spine(book.id)
    emit({
        "ok": True,
        "book_id": book.id,
        "title": book.title,
        "description": book.description,
        "status": book.status.value,
        "depth": book.depth,
        "language": book.language,
        "knowledge_bases": book.knowledge_bases,
        "chapters": [
            {"order": c.order, "title": c.title} for c in spine.chapters
        ] if spine else [],
        "pages": [{
            "order": p.order,
            "id": p.id,
            "title": p.title,
            "status": p.status.value,
            "blocks": len(p.blocks),
        } for p in pages],
        "stale_pages": len(book.stale_page_ids or []),
    })


def cmd_reorder(args) -> None:
    """Sort chapters topologically by their prerequisites and re-save the spine."""
    engine, book = _find_book(args.book)
    spine = engine.load_spine(book.id)
    if spine is None:
        raise SystemExit("No spine yet. Run `spine` first.")

    chapters = list(spine.chapters)
    by_title = {}
    for c in chapters:
        by_title[c.title] = c
        if getattr(c, "id", None):
            by_title[c.id] = c

    # Khan-style topological sort: a chapter comes after everything it lists
    # as a prerequisite. Cycles fall back to the original order.
    indeg = {c.id: 0 for c in chapters}
    edges = {c.id: [] for c in chapters}
    for c in chapters:
        for pre in (c.prerequisites or []):
            target = by_title.get(pre)
            if target is None or target.id == c.id:
                continue
            edges[target.id].append(c.id)
            indeg[c.id] += 1

    ordered_ids, queue = [], [c.id for c in chapters if indeg[c.id] == 0]
    while queue:
        cid = queue.pop(0)
        ordered_ids.append(cid)
        for nxt in edges[cid]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                queue.append(nxt)
    if len(ordered_ids) != len(chapters):
        log("Cycle detected in prerequisites; keeping the original order.")
        ordered_ids = [c.id for c in chapters]

    lookup = {c.id: c for c in chapters}
    ordered = [lookup[cid] for cid in ordered_ids]
    changed = [c.id for c, o in zip(ordered, chapters) if c.id != o.id]
    if not changed and not args.force:
        emit({"ok": True, "book_id": book.id, "changed": False,
              "chapters": [{"order": c.order, "title": c.title} for c in chapters]})
        return

    for i, c in enumerate(ordered):
        c.order = i
    spine.chapters = ordered
    engine.storage.save_spine(spine)
    log(f"Reordered {len(ordered)} chapters.")
    emit({
        "ok": True,
        "book_id": book.id,
        "changed": True,
        "chapters": [{"order": c.order, "title": c.title,
                      "prerequisites": list(c.prerequisites or [])} for c in ordered],
        "next": f"python bookctl.py compile --book {book.id}",
    })


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(prog="bookctl", description="Drive DeepTutor BookEngine.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="List all books").set_defaults(fn=cmd_list)

    p = sub.add_parser("create", help="Create a book from one intent line (DRAFT + proposal)")
    p.add_argument("--intent", required=True)
    p.add_argument("--kb", default=None, help="Knowledge base name, e.g. demo-note")
    p.add_argument("--depth", default="brief", choices=["brief", "standard", "deep"])
    p.add_argument("--lang", default="zh")
    p.set_defaults(fn=cmd_create)

    p = sub.add_parser("spine", help="Confirm proposal and build the chapter spine")
    p.add_argument("--book", default=None)
    p.set_defaults(fn=cmd_spine)

    p = sub.add_parser("compile", help="Compile pages one by one")
    p.add_argument("--book", default=None)
    p.add_argument("--page", default=None)
    p.add_argument("--max", type=int, default=0, help="0 = all")
    p.set_defaults(fn=cmd_compile)

    p = sub.add_parser("export", help="Render the whole book to Markdown")
    p.add_argument("--book", default=None)
    p.add_argument("--out", default=None)
    p.set_defaults(fn=cmd_export)

    p = sub.add_parser("reorder", help="Topologically sort chapters by prerequisites")
    p.add_argument("--book", default=None)
    p.add_argument("--force", action="store_true")
    p.set_defaults(fn=cmd_reorder)

    p = sub.add_parser("status", help="Detailed status of one book")
    p.add_argument("--book", default=None)
    p.set_defaults(fn=cmd_status)

    args = ap.parse_args(argv)
    try:
        args.fn(args)
    except SystemExit:
        raise
    except Exception as exc:
        emit({"ok": False, "error": f"{type(exc).__name__}: {exc}"})
        sys.exit(1)


if __name__ == "__main__":
    main()
