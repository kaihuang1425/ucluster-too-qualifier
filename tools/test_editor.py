"""End-to-end test of the page editor (?edit) against a stand-in GitHub.

Run from the repository root:
    python tools/test_editor.py
It needs Node 20 or later and Playwright with Chromium and WebKit. Set MOCK_RUN_CHECK=1 to run the real
tools/check.py on each published pull request as well (adds about a minute).

What it does
  * edits a bar label, a headline, a count-up number, speaker notes and a chart value on the page
  * checks that bars and count-up values follow their labels, and that the live checks catch a slide that
    no longer fits and a house-style slip
  * reloads to confirm unpublished edits survive, then signs in, publishes, waits for the check and makes
    the change live, and compares the result with the original files line by line
  * publishes again from an out-of-date page to test both a clash and an edit that lands cleanly
  * tests a failing check, an update to the same pull request, and closing it
  * types in WebKit (Safari's engine) on an iPad-size screen and on a phone
"""
import difflib
import json
import os
import secrets
import socket
import subprocess
import sys
import time
import urllib.parse
import urllib.request

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUN_CHECK = os.environ.get("MOCK_RUN_CHECK") == "1"
failures = []


def check(cond, msg):
    print(("  ok    " if cond else "  FAIL  ") + msg)
    if not cond:
        failures.append(msg)


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close(); return port


def start(cmd, env, url):
    proc = subprocess.Popen(cmd, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for _ in range(200):
        try:
            urllib.request.urlopen(url, timeout=1); return proc
        except urllib.error.HTTPError:
            return proc
        except Exception:
            time.sleep(0.05)
    proc.terminate(); raise SystemExit("could not start: " + " ".join(cmd) + "\n" + proc.stdout.read())


def mock_get(mock, path):
    with urllib.request.urlopen(mock + path) as r:
        return json.loads(r.read())


def mock_post(mock, path, data):
    req = urllib.request.Request(mock + path, data=json.dumps(data).encode(), headers={"content-type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def launch_chromium(p):
    for kw in ({}, {"channel": "msedge"}, {"channel": "chrome"}):
        try:
            return p.chromium.launch(**kw)
        except Exception:
            continue
    raise SystemExit("Could not start Chromium. Run: python -m playwright install chromium")


def watch(page, errors):
    page.on("pageerror", lambda e: errors.append("page error: " + str(e)))
    # the clash test gets a 409 on purpose, which the browser logs as a failed request
    page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" and "favicon" not in m.text and "status of 409" not in m.text else None)
    page.on("dialog", lambda d: d.accept())


READY = "() => { const s = document.querySelector('.ed-sum'); return (s && !/Loading/.test(s.textContent)) || document.querySelector('.ed-fail'); }"
JS_SLIDE = "const slide = n => document.querySelectorAll('#stage .dk')[n - 1];"


def slide_with(marker):
    """The number of the first slide whose HTML holds marker. Slides get reordered, so the tests never hard-code a number."""
    with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as fh:
        parts = fh.read().split('<section class="dk"')[1:]
    for i, part in enumerate(parts):
        if marker in part.split("</section>")[0]:
            return i + 1
    raise SystemExit("No slide holds " + marker)


LEV = slide_with('class="levers')            # HPL tuning bars
DUO = slide_with('class="duo compact')       # two big numbers side by side
HALF = slide_with('class="nodes2')           # core maps
RES = slide_with('class="tiles')             # round 1 results
ROOF = slide_with('id="roofline"')


def ready(page):
    page.wait_for_function(READY, timeout=15000)
    page.wait_for_function("document.fonts.status === 'loaded'")
    page.wait_for_timeout(200)


def go(page, n):
    page.evaluate("n => DECK.read() ? document.querySelectorAll('#stage .dk')[n - 1].scrollIntoView() : DECK.go(n - 1)", n)
    page.wait_for_timeout(150)


def handle(page, expr):
    return page.evaluate_handle("() => { " + JS_SLIDE + " return " + expr + "; }")


def replace(page, expr, text):
    """Select all the text in one editable block and type over it, like a person would."""
    h = handle(page, expr)
    h.click()
    h.evaluate("e => { const r = document.createRange(); r.selectNodeContents(e); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }")
    page.keyboard.type(text, delay=2)
    page.wait_for_timeout(250)
    return h


def append(page, expr, text):
    h = handle(page, expr)
    h.click()
    h.evaluate("e => { const r = document.createRange(); r.selectNodeContents(e); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }")
    page.keyboard.type(text, delay=2)
    page.wait_for_timeout(250)
    return h


def summary(page):
    return page.inner_text(".ed-sum")


def changed_lines(a, b):
    return [l for l in difflib.unified_diff(a.splitlines(), b.splitlines(), lineterm="", n=0) if l.startswith(("+", "-")) and not l.startswith(("+++", "---"))]


def main():
    orig = {p: open(os.path.join(ROOT, p), encoding="utf-8").read() for p in ("index.html", "deck.js")}
    mport, dport = free_port(), free_port()
    mock, base = "http://127.0.0.1:%d" % mport, "http://127.0.0.1:%d" % dport
    secret = secrets.token_hex(16)                      # a throwaway value shared by the two local servers
    env = dict(os.environ, GITHUB_CLIENT_SECRET=secret)
    m = start(["node", "tools/mock_github.mjs"], dict(env, MOCK_PORT=str(mport)), mock + "/__mock/main")
    d = start(["node", "tools/dev.mjs"], dict(env, PORT=str(dport), GITHUB_CLIENT_ID="local-test", GITHUB_API=mock, GITHUB_WEB=mock, DECK_SITE=base), base + "/index.html")
    errors = []
    try:
        with sync_playwright() as p:
            b = launch_chromium(p)
            ctx = b.new_context(viewport={"width": 1600, "height": 1000})
            pg = ctx.new_page(); watch(pg, errors)

            print("Editing on the page (Chromium)")
            pg.goto(base + "/?edit#%d" % LEV); ready(pg)
            check(pg.query_selector(".ed-fail") is None, "the editor starts without errors")
            check(pg.evaluate("document.querySelectorAll('[data-ed]').length") > 300, "slide text is editable")
            check("Click any text" in summary(pg), "the dock invites a first edit")

            replace(pg, "slide(%d).querySelector('.lv b')" % LEV, "+50%")
            check(pg.evaluate("() => { " + JS_SLIDE + " return getComputedStyle(slide(%d).querySelector('.lv .lv-t i')).getPropertyValue('--v').trim(); }" % LEV) == "50", "the bar grows to match a new label of +50%")

            replace(pg, "slide(%d).querySelector('h2')" % LEV, " ".join(["This headline is now far too long for the slide"] * 20))   # long enough to overflow however little else the slide holds
            pg.wait_for_selector(".ed-chk.bad", timeout=5000)
            check("outside its frame" in pg.evaluate("JSON.stringify(__deckEditor.issues().bad)"), "a slide that no longer fits is flagged while typing")
            pg.click('[data-a="publish"]')
            check(pg.is_disabled('.ed-modal [data-a="signin"]'), "publishing is blocked while a slide does not fit")
            pg.click('.ed-modal [data-a="close"]')
            replace(pg, "slide(%d).querySelector('h2')" % LEV, "Problem size gave most of the gain; flags gave none")
            pg.wait_for_selector(".ed-chk.warn", timeout=5000)
            check(pg.query_selector(".ed-chk.bad") is None and "semicolon" in pg.evaluate("JSON.stringify(__deckEditor.issues().warn)"), "a semicolon gives a style note, not a problem")
            new_h2 = "On one node, problem size gave most of the HPL gain and compiler flags gave none"
            replace(pg, "slide(%d).querySelector('h2')" % LEV, new_h2)
            pg.wait_for_function("!document.querySelector('.ed-chk.on')", timeout=5000)
            check(True, "checks clear once the headline is fixed")

            go(pg, DUO)
            replace(pg, "slide(%d).querySelector('[data-count]')" % DUO, "7.52")
            check(pg.evaluate("() => { " + JS_SLIDE + " return slide(%d).querySelector('[data-count]').getAttribute('data-to'); }" % DUO) == "7.52", "the count-up value follows a new big number")
            append(pg, "document.querySelector('.ed-host .notes')", " We repeated this run twice.")
            check("repeated this run" in pg.inner_text(".ed-host .notes"), "speaker notes for the current slide are editable in the dock")

            pg.click('[data-a="chart"]')
            pg.fill('input[aria-label="Roofline · slide %d · DINE · Peak GFLOP/s"]' % ROOF, "3350")
            pg.wait_for_timeout(300)
            check(pg.evaluate("DECK_DATA.roofline[0].P") == 3350, "a chart number changes and the chart redraws")
            pg.click('.ed-modal [data-a="close"]')

            pg.wait_for_timeout(300)
            check(summary(pg).startswith("5 changes"), "the dock counts 5 changes (" + summary(pg) + ")")
            ops = pg.evaluate("__deckEditor.ops()")
            check(sorted(o["kind"] for o in ops) == ["data", "inner", "inner", "inner", "inner", "tag", "tag"], "edits become 4 text edits, 2 tag edits and 1 chart edit")

            print("Unpublished edits survive a reload")
            pg.reload(); ready(pg)
            check(summary(pg).startswith("5 changes"), "all 5 changes are back after a reload")
            check(pg.evaluate("DECK_DATA.roofline[0].P") == 3350, "the chart edit is back too")

            print("Sign in, publish, check, make it live")
            pg.click('[data-a="publish"]')
            check("Sign in with GitHub" in pg.inner_text(".ed-modal"), "the review asks the teammate to sign in")
            pg.click('.ed-modal [data-a="signin"]')
            pg.wait_for_selector(".ed-acct:has-text('@teammate')", timeout=15000); ready(pg)
            pg.wait_for_selector('.ed-modal:not([hidden]) [data-a="send"]', timeout=10000)
            check(pg.url.startswith(base + "/?edit"), "the teammate is signed in and back on the deck after GitHub")
            review = pg.text_content(".ed-modal")
            check("Slide %d" % LEV in review and "Slide %d" % DUO in review and "Peak GFLOP/s" in review, "the review lists every change by slide")
            pg.click('.ed-modal [data-a="send"]')
            pg.wait_for_selector(".ed-modal h3:has-text('Pull request #1')", timeout=20000)
            pg.wait_for_selector(".ed-steps li.ok:has-text('The automatic check passed')", timeout=240000 if RUN_CHECK else 40000)
            check(True, "the automatic check passed" + (" (real tools/check.py)" if RUN_CHECK else " (stand-in)"))
            pg.wait_for_selector(".ed-steps a:has-text('Open the preview')", timeout=20000)
            check("vercel.app" in pg.get_attribute(".ed-steps a:has-text('Open the preview')", "href"), "the Vercel preview link appears")
            pg.click('.ed-modal [data-a="live"]')
            pg.wait_for_selector(".ed-steps li.ok:has-text('Live now')", timeout=30000)
            check(True, "make it live merges the pull request")

            main_files = mock_get(mock, "/__mock/main")["files"]
            html_diff, js_diff = changed_lines(orig["index.html"], main_files["index.html"]), changed_lines(orig["deck.js"], main_files["deck.js"])
            check(len(html_diff) == 8, "index.html changes on exactly 4 lines (" + str(len(html_diff) // 2) + ")")
            check(len(js_diff) == 2 and "P: 3350" in js_diff[1], "deck.js changes on exactly 1 line, the chart value")
            h = main_files["index.html"]
            check('<i style="--v:50"></i></span><b>+50%</b>' in h, "the bar and its label are saved together")
            check('data-to="7.52" data-dec="2">7.52<' in h, "the big number and its count-up value are saved together")
            check("<h2 class=\"t-h2\">" + new_h2 + "</h2>" in h or new_h2 in h, "the new headline is saved")
            # typing at the very end of a note lands in its background block when the note has one
            check("We repeated this run twice.</aside>" in h or "We repeated this run twice.</span></aside>" in h, "the speaker notes are saved")
            check("data-si" not in h and "contenteditable" not in h and "data-ed" not in h, "no editor markers leak into the file")
            if RUN_CHECK:
                log = mock_get(mock, "/__mock/log")["log"] or ""
                check("0 error(s)" in log, "tools/check.py passed on the published files")

            print("Publishing from a page that is out of date")
            pg.reload(); ready(pg)
            check(summary(pg).startswith("Click any text"), "the draft is cleared once the edits are live")
            go(pg, LEV)
            replace(pg, "slide(%d).querySelector('h2')" % LEV, "A clashing headline")
            pg.click('[data-a="publish"]'); pg.click('.ed-modal [data-a="send"]')
            pg.wait_for_selector(".ed-modal h3:has-text('Someone changed the same text')", timeout=15000)
            check("Slide %d" % LEV in pg.text_content(".ed-modal"), "a clash with a newer edit is caught and named")
            pg.click('.ed-modal [data-a="close"]')
            pg.click('[data-a="discard"]'); ready(pg)
            go(pg, RES)
            replace(pg, "slide(%d).querySelector('h2')" % RES, "Round 1 results on Cirrus, by efficiency and by speed")
            pg.click('[data-a="publish"]'); pg.click('.ed-modal [data-a="send"]')
            pg.wait_for_selector(".ed-modal h3:has-text('Pull request #2')", timeout=15000)
            head = [x for x in mock_get(mock, "/__mock/main")["pulls"] if x["number"] == 2][0]["head"]["ref"]
            st = mock_get(mock, "/__mock/main")
            check(head in st["refs"], "the edit lands on its own branch")
            pr2 = mock_get(mock, "/__mock/ref?name=" + urllib.parse.quote(head))["files"]["index.html"]
            check(new_h2 in pr2 and "by efficiency and by speed" in pr2, "an edit from an out-of-date page lands on the latest main and keeps the earlier headline")
            pg.click('.ed-modal [data-a="close"]')

            if not RUN_CHECK:
                print("A failing check, then an update to the same pull request")
                go(pg, RES)
                replace(pg, "slide(%d).querySelector('h2')" % RES, "Round 1 results MOCK-FAIL")
                pg.click('[data-a="publish"]')
                check("Update pull request #2" in pg.inner_text(".ed-modal"), "a second publish offers to update the open pull request")
                pg.click('.ed-modal [data-a="send"]')
                pg.wait_for_selector(".ed-steps li.bad:has-text('found problems')", timeout=40000)
                check("content runs from" in pg.inner_text(".ed-modal"), "the check's own message is shown on the page")
                check(pg.is_disabled('.ed-modal [data-a="live"]'), "make it live stays off while the check fails")
                pg.click('.ed-modal [data-a="close"]')
                replace(pg, "slide(%d).querySelector('h2')" % RES, "Round 1 results on Cirrus, by efficiency and by speed")
                pg.click('[data-a="publish"]'); pg.click('.ed-modal [data-a="send"]')
                pg.wait_for_selector(".ed-steps li.ok:has-text('The automatic check passed')", timeout=40000)
                check(len(mock_get(mock, "/__mock/main")["pulls"]) == 2, "the fix updates pull request #2 instead of opening a third")

            if not pg.is_visible(".ed-modal"):
                pg.click('[data-a="pr"]')
            pg.click('.ed-modal [data-a="closepr"]')
            pg.wait_for_function("!document.querySelector('.ed-pr.on')", timeout=10000)
            st = mock_get(mock, "/__mock/main")
            check([x for x in st["pulls"] if x["number"] == 2][0]["state"] == "closed" and head not in st["refs"], "closing the pull request also removes its branch")
            ctx.close(); b.close()

            print("Typing in WebKit (Safari's engine)")
            wk = p.webkit.launch()
            ctx = wk.new_context(viewport={"width": 1180, "height": 820}, has_touch=True)
            pg = ctx.new_page(); watch(pg, errors)
            pg.goto(base + "/?edit#%d" % HALF); ready(pg)
            check(pg.query_selector(".ed-fail") is None and pg.evaluate("document.documentElement.classList.contains('slides')"), "the editor starts in WebKit on an iPad-size screen")
            hh = replace(pg, "slide(%d).querySelector('h2')" % HALF, "Two  spaces stay single")
            pg.keyboard.press("Shift+Enter"); pg.keyboard.type("second line", delay=2); pg.wait_for_timeout(250)
            si = hh.evaluate("e => +e.getAttribute('data-si')")
            out = pg.evaluate("si => __deckEditor.ser(si)", si)
            check("<br>" in out and "<div" not in out and "&nbsp;" not in out and "second line" in out, "WebKit typing saves clean markup: " + out[:80])
            check(pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), "no sideways scrolling on an iPad-size screen")
            ctx.close()

            ctx = wk.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True,
                                 user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")
            pg = ctx.new_page(); watch(pg, errors)
            pg.goto(base + "/?edit"); ready(pg)
            check(pg.evaluate("document.documentElement.classList.contains('read')"), "phones get the reading layout in edit mode too")
            check(pg.evaluate("getComputedStyle(document.querySelectorAll('#stage .dk')[0].querySelector('.notes')).display") == "block", "speaker notes show under each slide on a phone")
            check(pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), "no sideways scrolling on a phone")
            box = pg.query_selector(".ed-dock").bounding_box()
            check(box and box["width"] <= 390 and box["y"] + box["height"] <= 845, "the editor bar fits on the phone screen")
            replace(pg, "slide(2).querySelector('h2')", "Overview of the three rounds")
            check(summary(pg).startswith("1 change"), "an edit on a phone is counted")
            ctx.close(); wk.close()
    finally:
        d.terminate(); m.terminate()

    for e in errors:
        print("  FAIL  " + e)
    failures.extend(errors)
    print("\n%d failure(s)" % len(failures))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
