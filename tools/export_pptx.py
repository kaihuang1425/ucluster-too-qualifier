"""Export the deck to PowerPoint, looking the same as the web version.

Run from the repository root:
    pip install playwright python-pptx
    python -m playwright install chromium
    python tools/export_pptx.py

It writes two files to export/.
  UCLuster-Too-qualifier.pptx           every slide's design as a picture, with the words on top as editable
                                        PowerPoint text in the same place. It matches the web deck where the
                                        fonts Google Sans Flex and Google Sans Code are installed (free from
                                        Google Fonts). Without them PowerPoint substitutes a font and lines can
                                        wrap differently.
  UCLuster-Too-qualifier-pictures.pptx  every slide as one picture. Identical on every computer, but the words
                                        cannot be edited.
Both carry the speaker notes. Charts stay pictures in both, and their numbers live in deck.js.

The web deck stays the source. Edits made in PowerPoint do not flow back to the site.
"""
import functools
import http.server
import json
import os
import re
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Pt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "export")
W, H = 1920, 1080
EMU = 6350                      # a 1920 px slide becomes 13.333 in, so 1 px = 6350 EMU and 1 px of type = 0.5 pt
SANS, MONO = "Google Sans Flex", "Google Sans Code"
TITLE = "UCLuster Too · CIUK 2026 qualifier"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, "http://127.0.0.1:%d/" % httpd.server_address[1]


def launch_chromium(p):
    for kwargs in ({}, {"channel": "msedge"}, {"channel": "chrome"}):
        try:
            return p.chromium.launch(**kwargs)
        except Exception:
            continue
    raise SystemExit("Could not start Chromium. Run: python -m playwright install chromium")


# Splits the slide's words into the boxes the browser lays out: each block, flex item or grid item is its own box,
# and an empty decoration between words (a dot, an icon) also starts a new box, so every box lands where its words
# are. Line breaks are recorded where the browser wraps. Words inside charts (SVG) and gradient-filled words are
# marked data-xskip and stay in the picture.
EXTRACT_JS = r"""(n) => {
  const dk = document.querySelectorAll('#stage .dk')[n];
  const INLINE = new Set(['inline', 'inline-block', 'inline-flex', 'inline-grid']);
  const cs = e => getComputedStyle(e);
  const gradient = e => /text/.test(cs(e).webkitBackgroundClip || cs(e).backgroundClip || '');
  const rotated = e => { const t = cs(e).transform; if (!t || t === 'none') return false; const m = t.match(/matrix\(([^)]+)\)/); return !m || Math.abs(parseFloat(m[1].split(',')[1])) > 1e-3; };
  const opacity = e => { let o = 1; for (let x = e; x && x !== document.body; x = x.parentElement) o *= parseFloat(cs(x).opacity); return o; };
  const hidden = e => e.matches('.notes, .rnotes, .cores') || cs(e).display === 'none' || cs(e).visibility === 'hidden';
  const blocky = e => !INLINE.has(cs(e).display) || [...e.querySelectorAll('*')].some(x => !INLINE.has(cs(x).display) && x.localName !== 'br');
  // a badge or padded word inside a sentence keeps its own box, so the space it takes up survives
  const boxy = e => { const s = cs(e); const side = ['marginLeft', 'marginRight', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((a, k) => a + (parseFloat(s[k]) || 0), 0);
    return side > 1 || !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor); };
  const units = [];

  function unit(nodes, container) {
    const runs = [], tops = [];
    let prev = null, maxSize = 0, firstLeft = null;
    const r = document.createRange();
    function text(tn) {
      const p = tn.parentElement, s = cs(p);
      const style = { color: s.color, size: parseFloat(s.fontSize), weight: parseInt(s.fontWeight, 10) || 400,
        italic: s.fontStyle === 'italic', mono: /code|mono/i.test(s.fontFamily), ls: s.letterSpacing === 'normal' ? 0 : parseFloat(s.letterSpacing),
        up: s.textTransform === 'uppercase', va: s.verticalAlign, strike: /line-through/.test(s.textDecorationLine), op: opacity(p),
        pre: /^pre|break-spaces/.test(s.whiteSpace) };
      const re = /\S+/g; let m, last = 0;
      while ((m = re.exec(tn.data))) {
        r.setStart(tn, m.index); r.setEnd(tn, m.index + m[0].length);
        const q = r.getClientRects()[0];
        if (!q) continue;
        maxSize = Math.max(maxSize, style.size);
        if (firstLeft === null) firstLeft = q.left;
        if (!prev) tops.push(q.top + q.height / 2);
        else if (q.top > prev.top + 0.55 * Math.max(prev.height, q.height)) {      // the browser wrapped here
          if (!style.pre) { runs.push(Object.assign({ t: tn.data.slice(last, m.index) }, style)); runs.push({ br: true }); last = m.index; }
          tops.push(q.top + q.height / 2);
        }
        prev = q;
      }
      runs.push(Object.assign({ t: tn.data.slice(last) }, style));
    }
    (function walk(list) {
      for (const c of list) {
        if (c.nodeType === 3) text(c);
        else if (c.nodeType === 1 && c.localName === 'br') { runs.push({ br: true }); prev = null; }
        else if (c.nodeType === 1) walk(c.childNodes);
      }
    })(nodes);
    if (!tops.length) return;
    const range = document.createRange();
    range.setStartBefore(nodes[0]); range.setEndAfter(nodes[nodes.length - 1]);
    const box = range.getBoundingClientRect();
    const c = cs(container), cl = c.lineHeight === 'normal' ? parseFloat(c.fontSize) * 1.2 : parseFloat(c.lineHeight);
    const lh = tops.length > 1 ? (tops[tops.length - 1] - tops[0]) / (tops.length - 1) : Math.max(cl, maxSize * 1.15);
    const y = tops[0] - lh / 2;                       // top of the first line box
    // a sentence that starts partway along a line, after a badge for example, keeps that start as a first-line indent
    units.push({ x: box.left, y, w: box.width, h: tops.length * lh, lh, size: maxSize, lines: tops.length, align: c.textAlign, runs,
      indent: firstLeft === null ? 0 : firstLeft - box.left });
  }

  (function visit(el) {
    if (el.matches('svg') || hidden(el)) return;
    if (rotated(el) || gradient(el)) { el.setAttribute('data-xskip', ''); return; }
    let group = [];
    const flush = () => { if (group.some(x => /\S/.test(x.textContent))) unit(group, el); group = []; };
    for (const c of el.childNodes) {
      if (c.nodeType === 3) { group.push(c); continue; }
      if (c.nodeType !== 1) continue;
      if (c.localName === 'br') { group.push(c); continue; }
      if (c.matches('svg') || hidden(c)) { if (c.matches('svg')) flush(); continue; }
      if (gradient(c) || rotated(c) || [...c.querySelectorAll('*')].some(gradient)) { flush(); c.setAttribute('data-xskip', ''); continue; }
      if (blocky(c)) { flush(); visit(c); continue; }
      if (!/\S/.test(c.textContent)) { if (c.getBoundingClientRect().width > 0.5) flush(); continue; }   // a dot or icon between words
      if (boxy(c)) { flush(); unit([c], c); continue; }
      group.push(c);
    }
    flush();
  })(dk);
  return units;
}"""

# Hide every word on the slide for the design picture, except the ones that stay in it.
# Gradient-filled words keep showing, because their colour comes from the background, not the text fill.
HIDE_CSS = """#stage .dk *:not(svg):not(svg *) { -webkit-text-fill-color: transparent !important; text-shadow: none !important;
  text-decoration-color: transparent !important; }
#stage .dk [data-xskip], #stage .dk [data-xskip] *:not(svg):not(svg *) { -webkit-text-fill-color: currentcolor !important;
  text-decoration-color: currentcolor !important; }"""


def parse_color(css, op):
    m = re.match(r"rgba?\(([^)]+)\)", css or "")
    if not m:
        return "E3E3E3", 1.0
    parts = [float(v) for v in re.split(r"[,\s/]+", m.group(1).strip()) if v]
    r, g, b = (int(round(v)) for v in parts[:3])
    a = parts[3] if len(parts) > 3 else 1.0
    return "%02X%02X%02X" % (r, g, b), max(0.0, min(1.0, a * op))


def clean_runs(runs):
    """Collapse whitespace the way the browser does, across run boundaries."""
    out, prev_space = [], True                      # start of the block counts as a space
    for r in runs:
        if r.get("br"):
            if out and not out[-1].get("br"):
                out[-1]["t"] = out[-1]["t"].rstrip(" ")
            out.append(r); prev_space = True
            continue
        if r.get("pre"):                            # white-space: pre keeps every space, as in the terminal
            t = r["t"].replace("\r", "").replace("\t", "    ")
            if "\n" in t:
                parts = t.split("\n")
                for k, part in enumerate(parts):
                    if k:
                        out.append({"br": True})
                    if part:
                        out.append(dict(r, t=part.upper() if r["up"] else part))
                prev_space = False
                continue
            out.append(dict(r, t=t.upper() if r["up"] else t))
            prev_space = t.endswith(" ")
            continue
        t = re.sub(r"[ \t\r\n]+", " ", r["t"])
        if prev_space:
            t = t.lstrip("  ") if not out or out[-1].get("br") else t.lstrip(" ")
        if not t:
            continue
        if r["up"]:
            t = t.upper()
        prev_space = t.endswith(" ")
        out.append(dict(r, t=t))
    while out and out[-1].get("br"):
        out.pop()
    if out:
        out[-1]["t"] = out[-1]["t"].rstrip(" ")
    return [r for r in out if r.get("br") or r["t"]]


def set_alpha(run, alpha):
    if alpha >= 0.995:
        return
    srgb = run._r.find(qn("a:rPr")).find(qn("a:solidFill")).find(qn("a:srgbClr"))
    a = srgb.makeelement(qn("a:alpha"), {"val": str(int(round(alpha * 100000)))})
    srgb.append(a)


def add_text(slide, u):
    runs = clean_runs(u["runs"])
    if not runs:
        return
    # Lines already break where the browser broke them. The extra width lets a substitute font that is up to
    # about 10% wider keep each line whole instead of wrapping it again.
    slack = 0.10 * u["w"] + 8
    x, w = u["x"], u["w"] + slack
    if u["align"] in ("center", "-webkit-center"):
        x -= slack / 2
    elif u["align"] in ("right", "end", "-webkit-right"):
        x -= slack
    # PowerPoint sets a fixed line height with the words at the bottom of the line, the browser centres them
    y = u["y"] - (u["lh"] - 1.2 * u["size"]) / 2
    tb = slide.shapes.add_textbox(Emu(int(x * EMU)), Emu(int(y * EMU)), Emu(int(w * EMU)), Emu(int((u["h"] + 4) * EMU)))
    plain = "".join(r.get("t", " ") for r in runs)
    tb.name = "Text: " + plain[:40]
    tf = tb.text_frame
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.word_wrap = u["lines"] > 1
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.vertical_anchor = MSO_ANCHOR.TOP
    p = tf.paragraphs[0]
    p.alignment = {"center": PP_ALIGN.CENTER, "-webkit-center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT, "end": PP_ALIGN.RIGHT,
                   "justify": PP_ALIGN.JUSTIFY}.get(u["align"], PP_ALIGN.LEFT)
    p.line_spacing = Pt(u["lh"] * 0.5)
    p.space_before = p.space_after = Pt(0)
    if u.get("indent", 0) > 1 and p.alignment == PP_ALIGN.LEFT:
        p._p.get_or_add_pPr().set("indent", str(int(u["indent"] * EMU)))
    for r in runs:
        if r.get("br"):
            p.add_line_break()
            continue
        hexcolor, alpha = parse_color(r["color"], r["op"])
        if alpha <= 0.01:
            continue
        run = p.add_run()
        run.text = r["t"]
        f = run.font
        f.name = MONO if r["mono"] else SANS
        f.size = Pt(round(r["size"] * 0.5, 1))
        f.bold = r["weight"] >= 600
        f.italic = r["italic"]
        f.color.rgb = RGBColor.from_string(hexcolor)
        set_alpha(run, alpha)
        rpr = run._r.get_or_add_rPr()
        # tell PowerPoint what kind of font to substitute when the Google fonts are not installed
        latin = rpr.find(qn("a:latin"))
        if latin is not None:
            latin.set("pitchFamily", "49" if r["mono"] else "34")
        if r["ls"]:
            rpr.set("spc", str(int(round(r["ls"] * 50))))
        if r["strike"]:
            rpr.set("strike", "sngStrike")
        if r["va"] in ("super", "top", "text-top"):
            rpr.set("baseline", "30000")
        elif r["va"] in ("sub", "bottom", "text-bottom"):
            rpr.set("baseline", "-25000")


def add_picture(slide, path, alt):
    pic = slide.shapes.add_picture(path, 0, 0, Emu(W * EMU), Emu(H * EMU))
    pic.name = "Slide design"
    pic._element.nvPicPr.cNvPr.set("descr", alt[:1500])
    return pic


def new_deck():
    prs = Presentation()
    prs.slide_width, prs.slide_height = Emu(W * EMU), Emu(H * EMU)
    prs.core_properties.title = TITLE
    prs.core_properties.author = "UCLuster Too"
    return prs


def main():
    os.makedirs(OUT, exist_ok=True)
    shots = os.path.join(OUT, "slides")
    os.makedirs(shots, exist_ok=True)
    httpd, base = serve()
    slides = []
    with sync_playwright() as p:
        b = launch_chromium(p)
        page = b.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        page.goto(base + "?static&mode=slides#1")
        page.wait_for_function("document.fonts.status === 'loaded' && window.DECK")
        count = page.evaluate("DECK.slides.length")
        for i in range(count):
            page.evaluate("i => DECK.go(i)", i)
            page.wait_for_timeout(350)
            full = os.path.join(shots, "slide-%02d.png" % (i + 1))
            page.screenshot(path=full)
            units = page.evaluate(EXTRACT_JS, i)
            style = page.add_style_tag(content=HIDE_CSS)
            page.wait_for_timeout(80)
            bg = os.path.join(shots, "slide-%02d-design.png" % (i + 1))
            page.screenshot(path=bg)
            style.evaluate("s => s.remove()")
            page.evaluate("document.querySelectorAll('[data-xskip]').forEach(e => e.removeAttribute('data-xskip'))")
            info = page.evaluate("""i => { const dk = DECK.slides[i]; const n = dk.querySelector('.notes'); const h = dk.querySelector('h1, h2');
              return { notes: n ? n.textContent.replace(/\\s+/g, ' ').trim() : '', title: h ? h.textContent.replace(/\\s+/g, ' ').trim() : '',
                       text: dk.innerText.replace(/\\s+/g, ' ').trim() }; }""", i)
            slides.append(dict(info, units=units, full=full, bg=bg))
            print("slide %2d  %3d text blocks  %s" % (i + 1, len(units), info["title"][:60]))
        b.close()
    httpd.shutdown()

    editable, pictures = new_deck(), new_deck()
    for s in slides:
        sl = editable.slides.add_slide(editable.slide_layouts[6])
        add_picture(sl, s["bg"], "Slide design: " + s["title"])
        for u in s["units"]:
            add_text(sl, u)
        sl.notes_slide.notes_text_frame.text = s["notes"]
        sp = pictures.slides.add_slide(pictures.slide_layouts[6])
        add_picture(sp, s["full"], s["text"])
        sp.notes_slide.notes_text_frame.text = s["notes"]
    a = os.path.join(OUT, "UCLuster-Too-qualifier.pptx")
    c = os.path.join(OUT, "UCLuster-Too-qualifier-pictures.pptx")
    editable.save(a)
    pictures.save(c)
    with open(os.path.join(OUT, "layout.json"), "w", encoding="utf-8") as fh:
        json.dump([{k: v for k, v in s.items() if k in ("title", "units")} for s in slides], fh)
    print("\nwrote %s (%.1f MB) and %s (%.1f MB)" % (a, os.path.getsize(a) / 1e6, c, os.path.getsize(c) / 1e6))
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
