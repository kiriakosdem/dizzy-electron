#!/usr/bin/env python3
"""Check local HTML/CSS references and anchor targets, without network access."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.references = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.add(attrs['id'])
        if tag == 'a' and attrs.get('name'):
            self.ids.add(attrs['name'])
        for attr in ('href', 'src', 'poster', 'data-destination'):
            if attrs.get(attr):
                self.references.append((self.getpos()[0], attrs[attr]))
        if tag == 'meta' and attrs.get('http-equiv', '').lower() == 'refresh':
            target = re.search(r'url\s*=\s*(.+)', attrs.get('content', ''), re.I)
            if target:
                self.references.append((self.getpos()[0], target.group(1).strip()))

    handle_startendtag = handle_starttag


def main():
    pages = {}
    references = []
    for path in sorted(ROOT.rglob('*.html')):
        if '.git' in path.parts:
            continue
        page = Page()
        page.feed(path.read_text())
        pages[path.resolve()] = page
        references.extend((path, line, url) for line, url in page.references)
    for path in sorted((ROOT / 'assets/css').glob('*.css')):
        source = re.sub(r'/\*.*?\*/', '', path.read_text(), flags=re.S)
        for match in re.finditer(r'url\(\s*[\'"]?([^\s\)\'\"]+)', source):
            references.append((path, source.count('\n', 0, match.start()) + 1, match[1]))

    errors = []
    checked = 0
    for source, line, url in references:
        parts = urlsplit(url)
        if parts.scheme or parts.netloc or url == '#':
            continue
        checked += 1
        target = ((ROOT if parts.path.startswith('/') else source.parent) / unquote(parts.path).lstrip('/')).resolve() if parts.path else source.resolve()
        if target.is_dir():
            target /= 'index.html'
        problem = None
        if not target.is_file():
            problem = 'missing file'
        elif parts.fragment and target in pages and unquote(parts.fragment) not in pages[target].ids:
            problem = 'missing anchor'
        if problem:
            errors.append(f'{source.relative_to(ROOT)}:{line}: {problem}: {url}')
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f'Checked {checked} local references across {len(pages)} HTML files; no broken files or anchors.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
