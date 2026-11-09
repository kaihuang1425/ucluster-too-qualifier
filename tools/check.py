"""Check the deck before changes are merged.

Run from the repository root:
    pip install playwright
    python -m playwright install chromium webkit
    python tools/check.py

The same script runs on every pull request through .github/workflows/check.yml.

Errors (the check fails):
  * a JavaScript error in Chromium or WebKit (Safari's engine)
  * a slide whose content no longer fits the 1920 x 1080 frame
  * sideways scrolling or an element wider than the screen on a 390 px iPhone
  * the iPad layout losing its two-column panels
  * a number whose visible text no longer matches its animation value
    (data-to on counters, --v on bars, --a on the noise plot dots)
  * the page editor (?edit) failing to start, usually because a tag in index.html is not closed
    (tools/test_editor.py tests the editor itself in more depth)

Warnings (shown, but the check still passes):
  * house writing rules in visible text and speaker notes
    (no colons, semicolons or em dashes in prose, and not the words gap, bridges or shifts)
"""
import functools
import http.server
import os
import re
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IN_CI = os.environ.get("GITHUB_ACTIONS") == "true"
errors, warnings = [], []


def error(msg):
    errors.append(msg)
    print(("::error::" if IN_CI else "ERROR   ") + msg)


def warn(msg):
    warnings.append(msg)
    print(("::warning::" if IN_CI else "warning ") + msg)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    handler = functools.partial(QuietHandler, directory=ROOT)
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, "http://127.0.0.1:%d/" % httpd.server_address[1]


def launch_chromium(p):
    for kwargs in ({}, {"channel": "msedge"}, {"channel": "chrome"}):
        try:
            return p.chromium.launch(**kwargs)
        except Exception:
            continue
    raise SystemExit("Could not start Chromium. Run: python -m playwright install chromium")


IPHONE_UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 "
             "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")
IPAD_UA = IPHONE_UA.replace("iPhone; CPU iPhone OS", "iPad; CPU OS")

FIT_JS = r"""() => {
  const out = [];
  document.querySelectorAll('.dk').forEach((dk, i) => {
    let top = 1e9, bottom = 0, src = null;
    [...dk.children].forEach(c => {
      if (c.matches('.notes, .rnotes, .halo')) return;
      const r = c.getBoundingClientRect();
      if (!r.height) return;
      if (c.matches('.srcl, .foot')) { src = Math.min(src ?? 1e9, r.top); return; }
      top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom);
    });
    const h = dk.querySelector('h1, h2');
    out.push({ n: i + 1, title: h ? h.textContent.trim().slice(0, 60) : '', top, bottom, src });
  });
  return out;
}"""

NUMBERS_JS = r"""() => {
  const slideOf = el => [...document.querySelectorAll('.dk')].indexOf(el.closest('.dk')) + 1;
  const num = t => parseFloat(String(t).replace(/[^0-9.\-]/g, ''));
  const out = [];
  document.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.getAttribute('data-to'), dec = +(el.getAttribute('data-dec') || 0);
    if (Math.abs(num(el.textContent) - to) > Math.pow(10, -dec) / 2 + 1e-9)
      out.push(`slide ${slideOf(el)}: counter shows "${el.textContent.trim()}" but data-to="${el.getAttribute('data-to')}"`);
  });
  const bar = (rows, sel, tol) => document.querySelectorAll(rows).forEach(row => {
    const i = row.querySelector(sel); const b = row.querySelector('b');
    if (!i || !b) return;
    const v = parseFloat(getComputedStyle(i).getPropertyValue('--v')), shown = num(b.textContent);
    if (Math.abs(v - shown) > tol) out.push(`slide ${slideOf(row)}: bar length --v:${v} but the label says "${b.textContent.trim()}"`);
  });
  bar('.lv', '.lv-t i', 0.5); bar('.cl', '.cl-t i', 0.5);
  document.querySelectorAll('.agebars > div').forEach(d => {
    const v = parseFloat(getComputedStyle(d).getPropertyValue('--v')), shown = num(d.querySelector('b').textContent);
    if (Math.abs(v - shown) > 0.5) out.push(`slide ${slideOf(d)}: age bar --v:${v} but the label says "${shown}%"`);
  });
  document.querySelectorAll('.nz-row').forEach(r => {
    const a = parseFloat(getComputedStyle(r).getPropertyValue('--a')), shown = num(r.querySelector('b').textContent);
    if (Math.abs(a - shown) > 0.006) out.push(`slide ${slideOf(r)}: dot position --a:${a} but the label says "${shown}"`);
  });
  return out;
}"""

TEXT_JS = r"""() => {
  const out = [];
  document.querySelectorAll('.dk').forEach((dk, i) => {
    const walker = document.createTreeWalker(dk, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement.closest('code, .term, svg, script, style, .rnotes') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let t = '', n; while ((n = walker.nextNode())) t += n.textContent + ' ';
    out.push({ n: i + 1, text: t.replace(/\s+/g, ' ') });
  });
  return out;
}"""

OVERFLOW_JS = r"""() => {
  const W = document.documentElement.clientWidth, bad = [];
  document.querySelectorAll('.stage *').forEach(e => {
    if (e.closest('.term, svg, .notes')) return;
    const r = e.getBoundingClientRect();
    if (r.width && (r.right > W + 1 || r.left < -1)) {
      const dk = e.closest('.dk'); const n = [...document.querySelectorAll('.dk')].indexOf(dk) + 1;
      bad.push(`slide ${n}: <${e.tagName.toLowerCase()} class="${e.getAttribute('class') || ''}"> runs from ${Math.round(r.left)} to ${Math.round(r.right)} px on a ${W} px screen`);
    }
  });
  return { mode: document.documentElement.className, scrollW: document.documentElement.scrollWidth, W, bad };
}"""


def watch(page, label):
    page.on("pageerror", lambda e: error(f"{label}: JavaScript error: {e}"))
    page.on("console", lambda m: error(f"{label}: console error: {m.text}") if m.type == "error" and "favicon" not in m.text else None)


def main():
    httpd, base = serve()
    with sync_playwright() as p:
        # Desktop, Chromium: slides fit, numbers match, writing rules
        b = launch_chromium(p)
        page = b.new_page(viewport={"width": 1920, "height": 1080})
        watch(page, "desktop")
        page.goto(base + "?static#1")
        page.wait_for_function("document.fonts.status === 'loaded'")
        page.add_style_tag(content=".dk > * { flex-shrink: 0 !important; }")
        page.wait_for_timeout(500)
        for s in page.evaluate(FIT_JS):
            limit = (s["src"] - 14) if s["src"] else 1060
            if s["top"] < 100 or s["bottom"] > limit:
                error(f"slide {s['n']} ({s['title']}): content runs from {s['top']:.0f} to {s['bottom']:.0f} px, "
                      f"but must stay between 100 and {limit:.0f}. Shorten the text or remove a line.")
        for msg in page.evaluate(NUMBERS_JS):
            error(msg + ". Update both so they agree.")
        notes = page.evaluate("[...document.querySelectorAll('.dk')].map((d, i) => ({ n: i + 1, text: (d.querySelector('.notes') || {}).textContent || '' }))")
        for block in page.evaluate(TEXT_JS) + [dict(n=x["n"], text=x["text"], notes=True) for x in notes]:
            where = f"slide {block['n']}" + (" speaker notes" if block.get("notes") else "")
            text = re.sub(r"\b\d{1,2}:\d{2}\b", "", block["text"])        # clock times are fine
            text = re.sub(r"https?://\S+", "", text)
            for ch, name in ((":", "colon"), (";", "semicolon"), ("—", "em dash")):
                for m in re.finditer(re.escape(ch), text):
                    warn(f"{where}: {name} in \"...{text[max(0, m.start() - 40):m.start() + 20].strip()}...\"")
            for m in re.finditer(r"\b(gaps?|bridges?|shifts?)\b", text, re.I):
                warn(f"{where}: the word \"{m.group(0)}\" in \"...{text[max(0, m.start() - 40):m.end() + 20].strip()}...\"")

        # The page editor has to be able to follow index.html. Publishing needs the live site, so only start-up is tested here.
        ed = b.new_page(viewport={"width": 1600, "height": 1000})
        ed_errors = []
        ed.on("pageerror", lambda e: ed_errors.append(str(e)))
        ed.goto(base + "?edit#1")
        try:
            ed.wait_for_function("() => { const s = document.querySelector('.ed-sum'); return (s && !/Loading/.test(s.textContent)) || document.querySelector('.ed-fail'); }", timeout=15000)
            stuck = ed.evaluate("(document.querySelector('.ed-fail') || {}).textContent || ''")
            if stuck:
                error("page editor: " + stuck)
            elif ed.evaluate("document.querySelectorAll('[data-ed]').length") < 100:
                error("page editor: almost no slide text can be edited on the page")
        except Exception as e:
            error("page editor: it did not start (" + str(e).splitlines()[0] + ")")
        for msg in ed_errors:
            error("page editor: JavaScript error: " + msg)
        ed.close()
        b.close()

        # iPhone in WebKit: reading layout, nothing wider than the screen
        wk = p.webkit.launch()
        for w, h, label in ((390, 844, "iPhone portrait"), (844, 390, "iPhone landscape")):
            ctx = wk.new_context(viewport={"width": w, "height": h}, is_mobile=True, has_touch=True, user_agent=IPHONE_UA)
            page = ctx.new_page(); watch(page, label)
            page.goto(base + "?static")
            page.wait_for_function("document.fonts.status === 'loaded'")
            page.wait_for_timeout(600)
            r = page.evaluate(OVERFLOW_JS)
            if "read" not in r["mode"]:
                error(f"{label}: expected the phone reading layout, got \"{r['mode'].strip()}\"")
            if r["scrollW"] > r["W"]:
                error(f"{label}: the page scrolls sideways ({r['scrollW']} px wide on a {r['W']} px screen)")
            for msg in r["bad"][:10]:
                error(f"{label}: {msg}")
            ctx.close()
        # iPad in WebKit: slide layout with two-column panels
        ctx = wk.new_context(viewport={"width": 820, "height": 1180}, is_mobile=True, has_touch=True, user_agent=IPAD_UA)
        page = ctx.new_page(); watch(page, "iPad portrait")
        page.goto(base + "#6"); page.wait_for_timeout(1500)
        mode = page.evaluate("document.documentElement.className")
        cols = page.evaluate("getComputedStyle(document.querySelectorAll('.dk')[5].querySelector('.duo')).gridTemplateColumns.split(' ').length")
        if "slides" not in mode or cols != 2:
            error(f"iPad portrait: expected slides with two-column panels, got \"{mode.strip()}\" with {cols} column(s)")
        ctx.close(); wk.close()
    httpd.shutdown()

    print(f"\n{len(errors)} error(s), {len(warnings)} warning(s)")
    if errors:
        print("Fix the errors above before merging.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
