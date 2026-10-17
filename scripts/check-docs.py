#!/usr/bin/env python3
"""Check generated links, fragments, images and equivalent language pages."""
import argparse
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = set()
        self.languages = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        key = "href" if tag in ("a", "link") else "src" if tag in ("img", "script") else None
        if key and attrs.get(key):
            self.links.append((tag, attrs[key]))
        if tag == "a" and attrs.get("hreflang") in ("en", "pt-BR"):
            self.languages[attrs["hreflang"]] = attrs.get("href", "")


def destination(root, source, path):
    if path.startswith("/"):
        relative = unquote(path)
        # Absolute URLs emitted by the 404 page use the configured Pages prefix.
        if relative.startswith("/OpenStudyHub/"):
            relative = relative[len("/OpenStudyHub/"):]
        result = root / relative.lstrip("/")
    else:
        result = source.parent / unquote(path) if path else source
    result = result.resolve()
    return result / "index.html" if result.is_dir() else result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("site", nargs="?", default="site")
    root = Path(parser.parse_args().site).resolve()
    required = ("index.html", "pt-BR/index.html", "search/search_index.json", "pt-BR/search/search_index.json")
    if any(not (root / name).is_file() for name in required):
        raise SystemExit("Missing bilingual build or search index; build the documentation first.")

    pages = {}
    for file in root.rglob("*.html"):
        page = Page()
        page.feed(file.read_text())
        pages[file.resolve()] = page

    errors = []
    checked = 0
    for source, page in pages.items():
        relative = source.relative_to(root)
        for tag, url in page.links:
            parts = urlsplit(url)
            if parts.scheme or parts.netloc:
                continue
            target = destination(root, source, parts.path)
            checked += 1
            if root not in target.parents and target != root:
                errors.append((str(relative), url, "outside build"))
            elif not target.exists():
                errors.append((str(relative), url, "missing target"))
            elif parts.fragment and target in pages and unquote(parts.fragment) not in pages[target].ids:
                errors.append((str(relative), url, "missing fragment"))

        if relative.name == "404.html":
            continue
        english = root / Path(*relative.parts[1:]) if relative.parts[0] == "pt-BR" else source
        expected = {"en": english, "pt-BR": root / "pt-BR" / english.relative_to(root)}
        for language, counterpart in expected.items():
            actual = page.languages.get(language)
            if actual is None or destination(root, source, urlsplit(actual).path) != counterpart:
                errors.append((str(relative), language, "incorrect language switch"))
            if not counterpart.is_file():
                errors.append((str(relative), str(counterpart.relative_to(root)), "missing translation"))

    for error in errors[:30]:
        print("ERROR", *error)
    print(f"{len(pages)} HTML pages; {checked} local references checked; {len(errors)} errors")
    raise SystemExit(bool(errors))


if __name__ == "__main__":
    main()
