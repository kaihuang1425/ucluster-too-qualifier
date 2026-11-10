"""Export the deck to PowerPoint.

Run from the repository root:
    pip install playwright python-pptx
    python -m playwright install chromium
    python tools/export_pptx.py

It writes two files to export/.
  UCLuster-Too-qualifier.pptx           every slide rebuilt from PowerPoint's own parts. Panels, bars, dots and lines
                                        are shapes, each chart is a group of lines, circles, boxes and labels, and the
                                        words are text boxes. Nothing is a picture, so every piece can be selected,
                                        moved, recoloured, ungrouped and edited. It matches the web deck where the
                                        fonts Google Sans Flex and Google Sans Code are installed (free from Google
                                        Fonts). Without them PowerPoint substitutes a similar font.
  UCLuster-Too-qualifier-pictures.pptx  every slide as one picture. Identical on every computer, but nothing can be
                                        edited.
Both carry the speaker notes.

The exporter reads the finished layout from the browser, so it follows whatever the slides contain. The web deck stays
the source. Edits made in PowerPoint do not flow back to the site.
"""
import functools
import http.server
import json
import math
import os
import re
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.oxml import parse_xml
from pptx.oxml.ns import qn
from pptx.util import Emu, Pt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "export")
W, H = 1920, 1080
EMU = 6350                      # a 1920 px slide becomes 13.333 in, so 1 px = 6350 EMU and 1 px of type = 0.5 pt
SANS, MONO = "Google Sans Flex", "Google Sans Code"
TITLE = "UCLuster Too · CIUK 2026 qualifier"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"


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


# Reads one slide as the browser lays it out and returns
#   bg     the slide's background colour
#   items  every painted box (backgrounds, borders, box shadows, ::before and ::after decorations) and every SVG
#          shape, in painting order, with their positions in slide pixels
#   texts  the words, split into the boxes the browser lays out. Each block, flex item or grid item is its own box,
#          and an empty decoration between words (a dot, an icon) also starts a new box, so every box lands where
#          its words are. Line breaks are recorded where the browser wraps.
# Each SVG becomes a group, and so does a grid of many empty marks such as the core map, so they move as one piece.
EXTRACT_JS = r"""(n) => {
  const stage = document.querySelector('#stage');
  const dk = stage.querySelectorAll('.dk')[n];
  const roots = [dk, ...[...stage.children].filter(e => !e.matches('.dk'))];
  const INLINE = new Set(['inline', 'inline-block', 'inline-flex', 'inline-grid']);
  const CLEAR = /^(transparent|rgba\(0, 0, 0, 0\))$/;
  const cs = e => getComputedStyle(e);
  const px = v => parseFloat(v) || 0;
  const items = [], texts = [], groups = {};
  let gid = 0;

  const opacity = e => { let o = 1; for (let x = e; x && x !== document.documentElement; x = x.parentElement) o *= parseFloat(cs(x).opacity); return o; };
  const hidden = e => e.matches('.notes, .rnotes') || cs(e).display === 'none' || cs(e).visibility === 'hidden';
  const label = e => (e.localName + ' ' + ((e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || '')).trim().slice(0, 60);
  const clipsText = s => /text/.test(s.webkitBackgroundClip || s.backgroundClip || '');
  const rotation = e => { const t = cs(e).transform; if (!t || t === 'none') return 0; const m = t.match(/matrix\(([^)]+)\)/); if (!m) return 0;
    const v = m[1].split(',').map(parseFloat); const a = Math.atan2(v[1], v[0]) * 180 / Math.PI; return Math.abs(a) > 0.05 ? a : 0; };

  function splitTop(str) {
    const out = []; let depth = 0, cur = '';
    for (const ch of str || '') { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { out.push(cur.trim()); cur = ''; } else cur += ch; }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function gradient(v) {
    const m = v && v.match(/^(?:repeating-)?(linear|radial)-gradient\((.*)\)$/);
    if (!m) return null;
    const args = splitTop(m[2]);
    let angle = 180;
    if (m[1] === 'linear') {
      const a = args[0];
      if (/deg$/.test(a)) { angle = parseFloat(a); args.shift(); }
      else if (/turn$/.test(a)) { angle = parseFloat(a) * 360; args.shift(); }
      else if (/^to /.test(a)) { angle = ({ 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270, 'to top right': 45, 'to right top': 45,
        'to bottom right': 135, 'to right bottom': 135, 'to bottom left': 225, 'to left bottom': 225, 'to top left': 315, 'to left top': 315 })[a] ?? 180; args.shift(); }
    } else if (!/^(rgb|#|transparent)/.test(args[0])) args.shift();
    const stops = args.map(s => { const c = (s.match(/rgba?\([^)]*\)|transparent/) || [''])[0]; const p = s.replace(c, '').match(/(-?[\d.]+)%/);
      return { color: c === 'transparent' ? 'rgba(0, 0, 0, 0)' : c, pos: p ? parseFloat(p[1]) / 100 : null }; }).filter(s => s.color);
    if (!stops.length) return null;
    if (stops[0].pos == null) stops[0].pos = 0;
    if (stops[stops.length - 1].pos == null) stops[stops.length - 1].pos = 1;
    for (let i = 1; i < stops.length - 1; i++) if (stops[i].pos == null) {
      let j = i; while (stops[j].pos == null) j++;
      for (let k = i; k < j; k++) stops[k].pos = stops[i - 1].pos + (stops[j].pos - stops[i - 1].pos) * (k - i + 1) / (j - i + 1);
    }
    return { type: m[1], angle, stops };
  }
  function shadows(v) {
    if (!v || v === 'none') return [];
    return splitTop(v).map(sh => { const color = (sh.match(/rgba?\([^)]*\)/) || ['rgba(0, 0, 0, 0)'])[0]; const rest = sh.replace(color, '');
      const nums = (rest.match(/-?[\d.]+px/g) || []).map(parseFloat);
      return { color, x: nums[0] || 0, y: nums[1] || 0, blur: nums[2] || 0, spread: nums[3] || 0, inset: /inset/.test(rest) }; })
      .filter(s => !CLEAR.test(s.color));
  }
  function radii(s, w, h) {
    const one = v => { const a = String(v).split(' ')[0]; return a.endsWith('%') ? parseFloat(a) / 100 * Math.min(w, h) : px(a); };
    const r = [one(s.borderTopLeftRadius), one(s.borderTopRightRadius), one(s.borderBottomRightRadius), one(s.borderBottomLeftRadius)];
    const f = Math.min(1, w / ((r[0] + r[1]) || 1e9), w / ((r[3] + r[2]) || 1e9), h / ((r[0] + r[3]) || 1e9), h / ((r[1] + r[2]) || 1e9));
    return r.map(v => v * f);
  }
  // a box inside a parent that clips (overflow hidden) is cut to the parent, and takes the parent's rounded corner where they meet
  function clip(e, r, rad) {
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = cs(a);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const q = a.getBoundingClientRect(), ar = radii(s, q.width, q.height);
      const x1 = Math.max(r.x, q.left), y1 = Math.max(r.y, q.top), x2 = Math.min(r.x + r.w, q.right), y2 = Math.min(r.y + r.h, q.bottom);
      if (x2 - x1 < 0.3 || y2 - y1 < 0.3) return null;
      r = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      const near = (u, v) => Math.abs(u - v) < 1.5;
      const pts = [[r.x, r.y, q.left, q.top], [r.x + r.w, r.y, q.right, q.top], [r.x + r.w, r.y + r.h, q.right, q.bottom], [r.x, r.y + r.h, q.left, q.bottom]];
      rad = rad.map((v, i) => near(pts[i][0], pts[i][2]) && near(pts[i][1], pts[i][3]) ? Math.max(v, ar[i]) : v);
    }
    return { r, rad };
  }

  // ---- painted boxes ----
  function boxes(e, s, g) {
    const op = opacity(e);
    if (op < 0.005) return;
    const grad = clipsText(s) ? null : gradient(splitTop(s.backgroundImage)[0]);
    const fill = clipsText(s) ? null : grad ? { grad } : !CLEAR.test(s.backgroundColor) ? { color: s.backgroundColor } : null;
    const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
    const bw = SIDES.map(k => /none|hidden/.test(s['border' + k + 'Style']) ? 0 : px(s['border' + k + 'Width']));
    const bc = SIDES.map(k => s['border' + k + 'Color']);
    const bs = SIDES.map(k => s['border' + k + 'Style']);
    const sh = shadows(s.boxShadow);
    if (!fill && !bw.some(Boolean) && !sh.length) return;
    const uniform = bw.every(v => Math.abs(v - bw[0]) < 0.01) && bc.every(v => v === bc[0]) && bw[0] > 0;
    const line = uniform && !CLEAR.test(bc[0]) ? { w: bw[0], color: bc[0], dash: /dashed|dotted/.test(bs[0]) ? [bw[0] * 3, bw[0] * 2] : null } : null;
    const sides = !uniform && bw.some(Boolean) ? bw.map((w, i) => ({ w, color: bc[i] })) : null;
    const rects = s.display === 'inline' ? [...e.getClientRects()] : [e.getBoundingClientRect()];
    for (const q of rects) {
      if (q.width < 0.3 || q.height < 0.3) continue;
      const c = clip(e, { x: q.left, y: q.top, w: q.width, h: q.height }, radii(s, q.width, q.height));
      if (!c) continue;
      items.push(Object.assign({ k: 'box', g, name: label(e), rad: c.rad, fill, line, sides, shadows: sh, op }, c.r));
    }
  }

  // ::before and ::after decorations become real elements just long enough to be measured
  function pseudo(e, which, g) {
    const p = getComputedStyle(e, which);
    if (p.content === 'none' || p.content === 'normal' || p.display === 'none') return;
    const m = document.createElement('x-ps');
    for (let k = 0; k < p.length; k++) { const prop = p[k]; if (prop !== 'content') m.style.setProperty(prop, p.getPropertyValue(prop)); }
    const q = p.content.match(/^"((?:[^"\\]|\\.)*)"$/), at = p.content.match(/^attr\(([\w-]+)\)$/);
    m.textContent = q ? q[1].replace(/\\(.)/g, '$1') : at ? (e.getAttribute(at[1]) || '') : '';
    const hide = document.createElement('style');
    hide.textContent = '[data-xhide]' + which + '{content:none!important}';
    document.head.append(hide);
    e.setAttribute('data-xhide', '');
    which === '::before' ? e.prepend(m) : e.append(m);
    boxes(m, cs(m), g);
    if (/\S/.test(m.textContent)) unit([...m.childNodes], m);
    m.remove(); hide.remove(); e.removeAttribute('data-xhide');
  }

  function shapesPass(el, g) {
    if (hidden(el)) return;
    if (el.localName === 'svg') { svgPass(el, ++gid); return; }
    let mine = g;
    if (g == null && el.children.length >= 24 && !/\S/.test(el.textContent)) { mine = ++gid; groups[mine] = el.getAttribute('aria-label') || label(el); }
    boxes(el, cs(el), mine);
    pseudo(el, '::before', mine);
    for (const c of el.children) shapesPass(c, mine);
    pseudo(el, '::after', mine);
  }

  // ---- SVG ----
  function parsePath(d) {
    const toks = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) || [];
    const out = []; let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lc = null, lq = null, guard = 0;
    const num = () => parseFloat(toks[i++]);
    while (i < toks.length && guard++ < 100000) {
      if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
      if (C === 'M') { x = ox + num(); y = oy + num(); sx = x; sy = y; out.push(['M', x, y]); cmd = rel ? 'l' : 'L'; lc = lq = null; }
      else if (C === 'L') { x = ox + num(); y = oy + num(); out.push(['L', x, y]); lc = lq = null; }
      else if (C === 'H') { x = ox + num(); out.push(['L', x, y]); lc = lq = null; }
      else if (C === 'V') { y = oy + num(); out.push(['L', x, y]); lc = lq = null; }
      else if (C === 'C') { const a = [ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()]; out.push(['C', ...a]); lc = [a[2], a[3]]; x = a[4]; y = a[5]; lq = null; }
      else if (C === 'S') { const r = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y]; const a = [ox + num(), oy + num(), ox + num(), oy + num()]; out.push(['C', r[0], r[1], ...a]); lc = [a[0], a[1]]; x = a[2]; y = a[3]; lq = null; }
      else if (C === 'Q') { const a = [ox + num(), oy + num(), ox + num(), oy + num()]; out.push(['Q', ...a]); lq = [a[0], a[1]]; x = a[2]; y = a[3]; lc = null; }
      else if (C === 'T') { const r = lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y]; const a = [ox + num(), oy + num()]; out.push(['Q', r[0], r[1], ...a]); lq = r; x = a[0]; y = a[1]; lc = null; }
      else if (C === 'Z') { out.push(['Z']); x = sx; y = sy; lc = lq = null; if (i < toks.length && !/[a-zA-Z]/.test(toks[i])) return null; }
      else return null;                                   // arcs and anything unusual are traced point by point instead
      if (out.some(c => c.slice(1).some(v => !isFinite(v)))) return null;
    }
    return out;
  }
  function svgShape(c, s, g) {
    const m = c.getScreenCTM();
    if (!m) return;
    const T = (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
    const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)), turned = Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6;
    const op = opacity(c);
    if (op < 0.005) return;
    const fill = c.localName !== 'line' && /^rgb/.test(s.fill) && !CLEAR.test(s.fill) ? { color: s.fill, a: parseFloat(s.fillOpacity) } : null;
    const sw = px(s.strokeWidth) * sc;
    let dash = null;
    if (s.strokeDasharray && s.strokeDasharray !== 'none') {
      let d = s.strokeDasharray.split(/[ ,]+/).map(parseFloat).filter(v => !isNaN(v));
      if (d.length % 2) d = d.concat(d);
      const len = c.getTotalLength ? c.getTotalLength() : Infinity;
      if (d.length && !(d[0] >= len - 0.5)) dash = d.map(v => v * sc);   // a dash as long as the line is how the deck draws lines in, so it is solid
    }
    const line = /^rgb/.test(s.stroke) && !CLEAR.test(s.stroke) && sw > 0 ?
      { w: sw, color: s.stroke, a: parseFloat(s.strokeOpacity), cap: s.strokeLinecap, join: s.strokeLinejoin, dash } : null;
    if (!fill && !line) return;
    const base = { g, name: label(c), fill, line, op };
    const tag = c.localName;
    if (tag === 'rect' && !turned) {
      const x = c.x.baseVal.value, y = c.y.baseVal.value, w = c.width.baseVal.value, h = c.height.baseVal.value;
      const rx = Math.min(c.rx.baseVal.value || c.ry.baseVal.value || px(s.rx), w / 2, h / 2);
      const [x1, y1] = T(x, y), [x2, y2] = T(x + w, y + h);
      items.push(Object.assign(base, { k: 'box', x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), rad: [0, 0, 0, 0].map(() => rx * sc) }));
      return;
    }
    if ((tag === 'circle' || tag === 'ellipse') && !turned) {
      const cx = c.cx.baseVal.value, cy = c.cy.baseVal.value;
      const rx = tag === 'circle' ? c.r.baseVal.value : c.rx.baseVal.value, ry = tag === 'circle' ? rx : c.ry.baseVal.value;
      const [x, y] = T(cx, cy);
      items.push(Object.assign(base, { k: 'ellipse', x: x - rx * Math.abs(m.a), y: y - ry * Math.abs(m.d), w: 2 * rx * Math.abs(m.a), h: 2 * ry * Math.abs(m.d) }));
      return;
    }
    let cmds = null;
    if (tag === 'line') cmds = [['M', c.x1.baseVal.value, c.y1.baseVal.value], ['L', c.x2.baseVal.value, c.y2.baseVal.value]];
    else if (tag === 'polyline' || tag === 'polygon') { cmds = [...c.points].map((p, i) => [i ? 'L' : 'M', p.x, p.y]); if (tag === 'polygon') cmds.push(['Z']); }
    else if (tag === 'path') cmds = parsePath(c.getAttribute('d') || '');
    else if (tag === 'rect') { const x = c.x.baseVal.value, y = c.y.baseVal.value, w = c.width.baseVal.value, h = c.height.baseVal.value;
      cmds = [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']]; }
    if (!cmds && c.getTotalLength) {
      const L = c.getTotalLength(), steps = Math.max(8, Math.ceil(L * sc / 3));
      cmds = []; for (let k = 0; k <= steps; k++) { const p = c.getPointAtLength(L * k / steps); cmds.push([k ? 'L' : 'M', p.x, p.y]); }
    }
    if (!cmds || !cmds.length) return;
    const path = cmds.map(cm => { const o = [cm[0]]; for (let k = 1; k < cm.length; k += 2) o.push(...T(cm[k], cm[k + 1])); return o; });
    items.push(Object.assign(base, { k: 'path', path }));
  }
  function svgText(t, g) {
    if (!/\S/.test(t.textContent)) return;
    const m = t.getScreenCTM(), sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)), bb = t.getBBox();
    const [cx, cy] = [m.a * (bb.x + bb.width / 2) + m.c * (bb.y + bb.height / 2) + m.e, m.b * (bb.x + bb.width / 2) + m.d * (bb.y + bb.height / 2) + m.f];
    const runs = [];
    let size = 0;
    (function walk(list) { for (const c of list) {
      if (c.nodeType === 3) { const st = runStyle(c.parentElement, true); size = Math.max(size, st.size); runs.push(Object.assign({ t: c.data }, st)); }
      else if (c.nodeType === 1 && cs(c).display !== 'none') walk(c.childNodes);
    } })(t.childNodes);
    const anchor = cs(t).textAnchor, w = bb.width * sc, lh = bb.height * sc, rot = Math.atan2(m.b, m.a) * 180 / Math.PI;
    texts.push({ g, x: cx - w / 2, y: cy - lh / 2, w, h: lh, lh, size, lines: 1, runs, indent: 0, rot: Math.abs(rot) > 0.05 ? rot : 0,
      align: Math.abs(rot) > 0.05 ? 'center' : anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left' });
  }
  function svgPass(svg, g) {
    groups[g] = 'Chart: ' + (svg.getAttribute('aria-label') || svg.id || label(svg)).slice(0, 80);
    (function walk(el) {
      for (const c of el.children) {
        const s = cs(c);
        if (s.display === 'none' || /^(defs|title|desc|clipPath|mask|marker|symbol|style|script)$/.test(c.localName)) continue;
        if (c.localName === 'g' || c.localName === 'a') { walk(c); continue; }
        if (c.localName === 'text') { if (s.visibility !== 'hidden' && opacity(c) > 0.005) svgText(c, g); continue; }
        if (s.visibility === 'hidden') continue;
        svgShape(c, s, g);
      }
    })(svg);
  }

  // ---- words ----
  function runStyle(p, svg) {
    const s = cs(p);
    let grad = null;
    for (let x = p; x && x !== document.body && !grad; x = x.parentElement) { const xs = cs(x); if (clipsText(xs)) grad = gradient(splitTop(xs.backgroundImage)[0]); }
    const sc = svg ? (() => { const m = p.getScreenCTM(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); })() : 1;
    return { color: svg ? s.fill : s.color, size: parseFloat(s.fontSize) * sc, weight: parseInt(s.fontWeight, 10) || 400,
      italic: s.fontStyle === 'italic', mono: /code|mono/i.test(s.fontFamily), ls: s.letterSpacing === 'normal' ? 0 : parseFloat(s.letterSpacing) * sc,
      up: s.textTransform === 'uppercase', va: s.verticalAlign, strike: /line-through/.test(s.textDecorationLine), u: /underline/.test(s.textDecorationLine),
      op: opacity(p) * (svg ? parseFloat(s.fillOpacity) : 1), pre: /^pre|break-spaces/.test(s.whiteSpace), grad };
  }
  const INLINE_BLOCKS = e => !INLINE.has(cs(e).display) || [...e.querySelectorAll('*')].some(x => !INLINE.has(cs(x).display) && x.localName !== 'br');
  // A badge or padded word inside a sentence keeps its own text box, so its words stay inside its shape. Anything
  // else stays in the sentence, so a wider substitute font pushes the rest of the line along instead of overlapping it.
  const boxy = e => { const s = cs(e); const pad = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((a, k) => a + px(s[k]), 0);
    return pad > 1 || clipsText(s) || (s.display !== 'inline' && (!CLEAR.test(s.backgroundColor) || s.boxShadow !== 'none')); };

  function unit(nodes, container) {
    const runs = [], tops = [];
    let prev = null, maxSize = 0, firstLeft = null;
    const r = document.createRange();
    function text(tn) {
      const style = runStyle(tn.parentElement, false);
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
        else if (c.nodeType === 1 && !hidden(c)) {       // a margin beside a word in the sentence is kept as extra space
          const s = cs(c), ml = px(s.marginLeft), mr = px(s.marginRight);
          if (ml > 0.5) runs.push({ gap: ml });
          walk(c.childNodes);
          if (mr > 0.5) runs.push({ gap: mr });
        }
      }
    })(nodes);
    if (!tops.length) return;
    const range = document.createRange();
    range.setStartBefore(nodes[0]); range.setEndAfter(nodes[nodes.length - 1]);
    const box = range.getBoundingClientRect();
    const c = cs(container), cl = c.lineHeight === 'normal' ? parseFloat(c.fontSize) * 1.2 : parseFloat(c.lineHeight);
    const lh = tops.length > 1 ? (tops[tops.length - 1] - tops[0]) / (tops.length - 1) : Math.max(cl, maxSize * 1.15);
    // a sentence that starts partway along a line, after a badge for example, keeps that start as a first-line indent
    texts.push({ g: null, x: box.left, y: tops[0] - lh / 2, w: box.width, h: tops.length * lh, lh, size: maxSize, lines: tops.length, align: c.textAlign, runs,
      indent: firstLeft === null ? 0 : firstLeft - box.left, rot: 0 });
  }
  // a turned element is measured flat, then turned back about its centre
  function turned(e, ang) {
    const before = e.getBoundingClientRect(), old = e.style.getPropertyValue('transform'), pri = e.style.getPropertyPriority('transform');
    e.style.setProperty('transform', 'none', 'important');
    const flat = e.getBoundingClientRect(), n0 = texts.length;
    visit(e, true);
    e.style.removeProperty('transform'); if (old) e.style.setProperty('transform', old, pri);
    const dx = before.left + before.width / 2 - (flat.left + flat.width / 2), dy = before.top + before.height / 2 - (flat.top + flat.height / 2);
    for (let k = n0; k < texts.length; k++) Object.assign(texts[k], { x: texts[k].x + dx, y: texts[k].y + dy, rot: ang });
  }
  function visit(el, flat) {
    if (el.localName === 'svg' || hidden(el)) return;
    const ang = flat ? 0 : rotation(el);
    if (ang) { turned(el, ang); return; }
    let group = [];
    const flush = () => { if (group.some(x => /\S/.test(x.textContent))) unit(group, el); group = []; };
    for (const c of el.childNodes) {
      if (c.nodeType === 3) { group.push(c); continue; }
      if (c.nodeType !== 1) continue;
      if (c.localName === 'br') { group.push(c); continue; }
      if (c.localName === 'svg' || hidden(c)) { if (c.localName === 'svg') flush(); continue; }
      if (rotation(c)) { flush(); turned(c, rotation(c)); continue; }
      if (INLINE_BLOCKS(c)) { flush(); visit(c); continue; }
      if (!/\S/.test(c.textContent)) { if (c.getBoundingClientRect().width > 0.5) flush(); continue; }   // a dot or icon between words
      if (boxy(c)) { flush(); unit([c], c); continue; }
      group.push(c);
    }
    flush();
  }

  for (const r of roots) shapesPass(r, null);
  for (const r of roots) visit(r);
  return { bg: cs(stage).backgroundColor, items, texts, groups };
}"""


# ---------------------------------------------------------------- colours, fills, lines and shadows as DrawingML

def parse_color(css, op=1.0):
    m = re.match(r"rgba?\(([^)]+)\)", css or "")
    if not m:
        return "E3E3E3", 1.0
    parts = [float(v) for v in re.split(r"[,\s/]+", m.group(1).strip()) if v]
    r, g, b = (int(round(v)) for v in parts[:3])
    a = parts[3] if len(parts) > 3 else 1.0
    return "%02X%02X%02X" % (r, g, b), max(0.0, min(1.0, a * op))


def clr(css, op=1.0):
    hexcolor, a = parse_color(css, op)
    alpha = '<a:alpha val="%d"/>' % round(a * 100000) if a < 0.995 else ""
    return '<a:srgbClr val="%s">%s</a:srgbClr>' % (hexcolor, alpha)


def grad_xml(g, op):
    stops, last = [], -1
    for s in g["stops"]:
        pos = max(last, min(100000, max(0, round(s["pos"] * 100000))))
        stops.append('<a:gs pos="%d">%s</a:gs>' % (pos, clr(s["color"], op)))
        last = pos
    if g["type"] == "linear":    # CSS measures from 12 o'clock towards the end colour, PowerPoint from 3 o'clock
        shade = '<a:lin ang="%d" scaled="0"/>' % round(((g["angle"] - 90) % 360) * 60000)
    else:
        shade = '<a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path>'
    return '<a:gradFill rotWithShape="1"><a:gsLst>%s</a:gsLst>%s</a:gradFill>' % ("".join(stops), shade)


def fill_xml(fill, op):
    if not fill:
        return "<a:noFill/>"
    if fill.get("grad"):
        return grad_xml(fill["grad"], op)
    return "<a:solidFill>%s</a:solidFill>" % clr(fill["color"], op * fill.get("a", 1.0))


def line_xml(line, op):
    if not line:
        return "<a:ln><a:noFill/></a:ln>"
    w = line["w"]
    cap = {"round": "rnd", "square": "sq"}.get(line.get("cap"), "flat")
    dash = ""
    if line.get("dash"):
        d = line["dash"]
        dash = "<a:custDash>%s</a:custDash>" % "".join(
            '<a:ds d="%d" sp="%d"/>' % (max(1, round(d[i] / w * 100000)), max(1, round(d[i + 1] / w * 100000))) for i in range(0, len(d) - 1, 2))
    join = {"round": "<a:round/>", "bevel": "<a:bevel/>"}.get(line.get("join"), '<a:miter lim="800000"/>')
    return '<a:ln w="%d" cap="%s"><a:solidFill>%s</a:solidFill>%s%s</a:ln>' % (
        max(1, round(w * EMU)), cap, clr(line["color"], op * line.get("a", 1.0)), dash, join)


def shadow_xml(shadows, op, w, h):
    """PowerPoint draws one outer shadow per shape, so the strongest blurred box-shadow is kept."""
    soft = [s for s in shadows if not s["inset"] and s["blur"] > 0.01]
    if not soft:
        return ""
    s = max(soft, key=lambda s: s["blur"] * parse_color(s["color"])[1])
    dist = math.hypot(s["x"], s["y"])
    ang = (math.degrees(math.atan2(s["y"], s["x"])) % 360) if dist else 0
    grow = ""
    if s["spread"]:
        grow = ' sx="%d" sy="%d"' % (round((w + 2 * s["spread"]) / max(w, 1) * 100000), round((h + 2 * s["spread"]) / max(h, 1) * 100000))
    return ('<a:effectLst><a:outerShdw blurRad="%d" dist="%d" dir="%d"%s algn="ctr" rotWithShape="0">%s</a:outerShdw></a:effectLst>'
            % (round(s["blur"] * EMU), round(dist * EMU), round(ang * 60000), grow, clr(s["color"], op)))


def frag(xml):
    return parse_xml('<r xmlns:a="%s">%s</r>' % (A, xml))


def style_shape(sp, fill, line, effects, op):
    """Replace the theme styling python-pptx adds with the exact fill, outline and shadow."""
    el = sp._element
    st = el.find(qn("p:style"))
    if st is not None:
        el.remove(st)
    sppr = el.find(qn("p:spPr"))
    for tag in ("a:noFill", "a:solidFill", "a:gradFill", "a:ln", "a:effectLst"):
        for old in sppr.findall(qn(tag)):
            sppr.remove(old)
    for child in frag(fill_xml(fill, op) + line_xml(line, op) + effects):
        sppr.append(child)


def set_geometry(sp, xml):
    sppr = sp._element.find(qn("p:spPr"))
    old = sppr.find(qn("a:prstGeom"))
    new = frag(xml)[0]
    old.addprevious(new)
    sppr.remove(old)


def rounded_geom(w, h, rad):
    """A rectangle whose four corners each have their own radius, all in EMU."""
    tl, tr, br, bl = rad
    p = ['<a:moveTo><a:pt x="%d" y="0"/></a:moveTo>' % tl, '<a:lnTo><a:pt x="%d" y="0"/></a:lnTo>' % (w - tr)]
    if tr:
        p.append('<a:arcTo wR="%d" hR="%d" stAng="16200000" swAng="5400000"/>' % (tr, tr))
    p.append('<a:lnTo><a:pt x="%d" y="%d"/></a:lnTo>' % (w, h - br))
    if br:
        p.append('<a:arcTo wR="%d" hR="%d" stAng="0" swAng="5400000"/>' % (br, br))
    p.append('<a:lnTo><a:pt x="%d" y="%d"/></a:lnTo>' % (bl, h))
    if bl:
        p.append('<a:arcTo wR="%d" hR="%d" stAng="5400000" swAng="5400000"/>' % (bl, bl))
    p.append('<a:lnTo><a:pt x="0" y="%d"/></a:lnTo>' % tl)
    if tl:
        p.append('<a:arcTo wR="%d" hR="%d" stAng="10800000" swAng="5400000"/>' % (tl, tl))
    p.append("<a:close/>")
    return ('<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/>'
            '<a:pathLst><a:path w="%d" h="%d">%s</a:path></a:pathLst></a:custGeom>' % (w, h, "".join(p)))


def e(v):
    return int(round(v * EMU))


# ---------------------------------------------------------------- shapes

def make_box(shapes, x, y, w, h, rad, fill, line, effects, op, name, ellipse=False):
    if w <= 0.05 or h <= 0.05:
        return None
    rad = [max(0.0, min(r, w / 2, h / 2)) for r in (rad or [0, 0, 0, 0])]
    big = min(w, h) / 2
    if ellipse or (abs(w - h) < 0.6 and all(r >= big - 0.6 for r in rad)):
        kind = MSO_SHAPE.OVAL
    elif all(r < 0.3 for r in rad):
        kind = MSO_SHAPE.RECTANGLE
    elif max(rad) - min(rad) < 0.3:
        kind = MSO_SHAPE.ROUNDED_RECTANGLE
    else:
        kind = None
    sp = shapes.add_shape(kind or MSO_SHAPE.RECTANGLE, Emu(e(x)), Emu(e(y)), Emu(max(1, e(w))), Emu(max(1, e(h))))
    sp.name = name
    if kind == MSO_SHAPE.ROUNDED_RECTANGLE:
        sp.adjustments[0] = min(0.5, rad[0] / min(w, h))
    elif kind is None:
        set_geometry(sp, rounded_geom(max(1, e(w)), max(1, e(h)), [e(r) for r in rad]))
    style_shape(sp, fill, line, effects, op)
    return sp


def add_box(shapes, it):
    x, y, w, h, op = it["x"], it["y"], it["w"], it["h"], it.get("op", 1.0)
    rad = it.get("rad") or [0, 0, 0, 0]
    name = it.get("name") or "Box"
    shadows = it.get("shadows") or []
    line = dict(it["line"]) if it.get("line") else None
    # a box-shadow with spread and no blur is a solid band around the box, drawn as a larger shape behind it
    for s in reversed(shadows):
        if not s["inset"] and s["blur"] <= 0.01 and s["spread"] > 0:
            sp = s["spread"]
            make_box(shapes, x - sp + s["x"], y - sp + s["y"], w + 2 * sp, h + 2 * sp, [r + sp if r > 0.3 else 0 for r in rad],
                     {"color": s["color"]}, None, "", op, name + " ring")
    # an inset ring (inset 0 0 0 1px) is the box's outline
    for s in shadows:
        if s["inset"] and s["blur"] <= 0.01 and not s["x"] and not s["y"] and s["spread"] > 0 and not line:
            line = {"w": s["spread"], "color": s["color"]}
    if line and it["k"] == "box" and it.get("shadows") is not None:
        # CSS draws a border inside the box, PowerPoint centres the outline on the edge
        lw = line["w"] / 2
        bx, by, bw, bh, brad = x + lw, y + lw, w - 2 * lw, h - 2 * lw, [max(0.0, r - lw) for r in rad]
    else:
        bx, by, bw, bh, brad = x, y, w, h, rad
    if it.get("fill") or line or any(not s["inset"] and s["blur"] > 0.01 for s in shadows):
        make_box(shapes, bx, by, bw, bh, brad, it.get("fill"), line, shadow_xml(shadows, op, w, h), op, name, ellipse=it["k"] == "ellipse")
    # an inset shadow with an offset and no blur is a bar along one inner edge
    for s in shadows:
        if s["inset"] and s["blur"] <= 0.01 and (s["x"] or s["y"]):
            if s["x"]:
                sx = x if s["x"] > 0 else x + w + s["x"]
                make_box(shapes, sx, y, abs(s["x"]), h, None, {"color": s["color"]}, None, "", op, name + " edge")
            if s["y"]:
                sy = y if s["y"] > 0 else y + h + s["y"]
                make_box(shapes, x, sy, w, abs(s["y"]), None, {"color": s["color"]}, None, "", op, name + " edge")
    # borders that differ by side are drawn as thin bars
    sides = it.get("sides")
    if sides:
        t, r, b, l = sides
        for (sx, sy, sw, sh), sd in (((x, y, w, t["w"]), t), ((x + w - r["w"], y, r["w"], h), r), ((x, y + h - b["w"], w, b["w"]), b), ((x, y, l["w"], h), l)):
            if sd["w"] > 0 and parse_color(sd["color"])[1] > 0.005:
                make_box(shapes, sx, sy, sw, sh, None, {"color": sd["color"]}, None, "", op, name + " border")


def add_path(shapes, it):
    path, op = it["path"], it.get("op", 1.0)
    pts = [(c[k], c[k + 1]) for c in path for k in range(1, len(c), 2)]
    if not pts:
        return
    # a straight two-point line becomes a PowerPoint line, which keeps its handles at both ends
    if len(path) == 2 and path[0][0] == "M" and path[1][0] == "L" and it.get("line"):
        (x1, y1), (x2, y2) = pts
        cx = shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Emu(e(x1)), Emu(e(y1)), Emu(e(x2)), Emu(e(y2)))
        cx.name = it.get("name") or "Line"
        st = cx._element.find(qn("p:style"))
        if st is not None:
            cx._element.remove(st)
        sppr = cx._element.find(qn("p:spPr"))
        for old in sppr.findall(qn("a:ln")):
            sppr.remove(old)
        sppr.append(frag(line_xml(it["line"], op))[0])
        return
    x0, y0 = min(p[0] for p in pts), min(p[1] for p in pts)
    w, h = max(1, e(max(p[0] for p in pts) - x0)), max(1, e(max(p[1] for p in pts) - y0))
    pt = lambda x, y: '<a:pt x="%d" y="%d"/>' % (e(x - x0), e(y - y0))
    body = []
    for c in path:
        if c[0] == "M":
            body.append("<a:moveTo>%s</a:moveTo>" % pt(c[1], c[2]))
        elif c[0] == "L":
            body.append("<a:lnTo>%s</a:lnTo>" % pt(c[1], c[2]))
        elif c[0] == "C":
            body.append("<a:cubicBezTo>%s%s%s</a:cubicBezTo>" % (pt(c[1], c[2]), pt(c[3], c[4]), pt(c[5], c[6])))
        elif c[0] == "Q":
            body.append("<a:quadBezTo>%s%s</a:quadBezTo>" % (pt(c[1], c[2]), pt(c[3], c[4])))
        elif c[0] == "Z":
            body.append("<a:close/>")
    nofill = "" if it.get("fill") else ' fill="none"'
    geom = ('<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/>'
            '<a:pathLst><a:path w="%d" h="%d"%s>%s</a:path></a:pathLst></a:custGeom>' % (w, h, nofill, "".join(body)))
    sp = shapes.add_shape(MSO_SHAPE.RECTANGLE, Emu(e(x0)), Emu(e(y0)), Emu(w), Emu(h))
    sp.name = it.get("name") or "Path"
    set_geometry(sp, geom)
    style_shape(sp, it.get("fill"), it.get("line"), "", op)


def add_item(shapes, it):
    if it["k"] == "path":
        add_path(shapes, it)
    elif it["k"] == "ellipse":
        make_box(shapes, it["x"], it["y"], it["w"], it["h"], None, it.get("fill"), it.get("line"), "", it.get("op", 1.0),
                 it.get("name") or "Circle", ellipse=True)
    else:
        add_box(shapes, it)


# ---------------------------------------------------------------- text

def clean_runs(runs):
    """Collapse whitespace the way the browser does, across run boundaries."""
    out, prev_space, gap = [], True, 0.0            # start of the block counts as a space

    def widen(gap):
        # a margin beside a word becomes letter spacing on the space before it, so the line keeps flowing
        if not gap or not out or out[-1].get("br"):
            return
        p = out[-1]
        if p["t"] == " ":
            out[-1] = dict(p, ls=p["ls"] + gap)
        elif p["t"].endswith(" "):
            out[-1] = dict(p, t=p["t"][:-1])
            out.append(dict(p, t=" ", ls=p["ls"] + gap))
        else:
            out.append(dict(p, t=" ", ls=p["ls"] + gap - 0.27 * p["size"]))

    for r in runs:
        if "gap" in r:
            gap += r["gap"]
            continue
        if r.get("br"):
            if out and not out[-1].get("br"):
                out[-1]["t"] = out[-1]["t"].rstrip(" ")
            out.append(r); prev_space = True; gap = 0.0
            continue
        if r.get("pre"):                            # white-space: pre keeps every space, as in the terminal
            gap = 0.0
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
            t = t.lstrip("  ") if not out or out[-1].get("br") else t.lstrip(" ")
        if not t:
            continue
        if r["up"]:
            t = t.upper()
        widen(gap); gap = 0.0
        prev_space = t.endswith(" ")
        out.append(dict(r, t=t))
    while out and out[-1].get("br"):
        out.pop()
    if out:
        out[-1]["t"] = out[-1]["t"].rstrip(" ")
    return [r for r in out if r.get("br") or r["t"]]


def add_text(shapes, u):
    runs = clean_runs(u["runs"])
    if not runs:
        return
    # Lines already break where the browser broke them. The extra width lets a substitute font that is up to
    # about 10% wider keep each line whole instead of wrapping it again.
    slack = 0.10 * u["w"] + 8
    x, w = u["x"], u["w"] + slack
    if u["align"] in ("center", "-webkit-center") or u.get("rot"):
        x -= slack / 2
    elif u["align"] in ("right", "end", "-webkit-right"):
        x -= slack
    # PowerPoint sets a fixed line height with the words at the bottom of the line, the browser centres them
    y = u["y"] - (u["lh"] - 1.2 * u["size"]) / 2
    tb = shapes.add_textbox(Emu(e(x)), Emu(e(y)), Emu(e(w)), Emu(e(u["h"] + 4)))
    plain = "".join(r.get("t", " ") for r in runs)
    tb.name = "Text: " + plain[:40]
    if u.get("rot"):
        tb.rotation = u["rot"] % 360
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
        p._p.get_or_add_pPr().set("indent", str(e(u["indent"])))
    for r in runs:
        if r.get("br"):
            p.add_line_break()
            continue
        hexcolor, alpha = parse_color(r["color"], r["op"])
        if alpha <= 0.01 and not r.get("grad"):
            continue
        run = p.add_run()
        run.text = r["t"]
        f = run.font
        f.name = MONO if r["mono"] else SANS
        f.size = Pt(round(r["size"] * 0.5, 1))
        f.bold = r["weight"] >= 600
        f.italic = r["italic"]
        rpr = run._r.get_or_add_rPr()
        # the fill goes before the font name in a run's properties
        rpr.insert(0, frag(grad_xml(r["grad"], r["op"]) if r.get("grad") else "<a:solidFill>%s</a:solidFill>" % clr(r["color"], r["op"]))[0])
        # tell PowerPoint what kind of font to substitute when the Google fonts are not installed
        latin = rpr.find(qn("a:latin"))
        if latin is not None:
            latin.set("pitchFamily", "49" if r["mono"] else "34")
        if r["ls"]:
            rpr.set("spc", str(int(round(r["ls"] * 50))))
        if r["strike"]:
            rpr.set("strike", "sngStrike")
        if r.get("u"):
            rpr.set("u", "sng")
        if r["va"] in ("super", "top", "text-top"):
            rpr.set("baseline", "30000")
        elif r["va"] in ("sub", "bottom", "text-bottom"):
            rpr.set("baseline", "-25000")


# ---------------------------------------------------------------- slides

def build_native(slide, s):
    hexcolor, _ = parse_color(s["bg"])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = RGBColor.from_string(hexcolor)
    groups = {}

    def target(g):
        if g is None:
            return slide.shapes
        if g not in groups:
            grp = slide.shapes.add_group_shape()
            grp.name = s["groups"].get(str(g)) or "Group"
            groups[g] = grp
        return groups[g].shapes

    for it in s["items"]:
        add_item(target(it.get("g")), it)
    for u in s["texts"]:                           # words go on top, chart labels on top inside their chart
        add_text(target(u.get("g")), u)
    for grp in groups.values():
        grp._element.recalculate_extents()


def add_picture(slide, path, alt):
    pic = slide.shapes.add_picture(path, 0, 0, Emu(W * EMU), Emu(H * EMU))
    pic.name = "Slide picture"
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
            layout = page.evaluate(EXTRACT_JS, i)
            info = page.evaluate("""i => { const dk = DECK.slides[i]; const n = dk.querySelector('.notes'); const h = dk.querySelector('h1, h2');
              const NL = String.fromCharCode(10);
              // the script comes first, then the background for questions, as separate paragraphs
              const lines = e => { const c = e.cloneNode(true); c.querySelectorAll('.bg').forEach(x => x.remove()); c.querySelectorAll('br').forEach(x => x.replaceWith(NL));
                return c.textContent.split(NL).map(l => l.split(' ').filter(Boolean).join(' ')).filter(Boolean).join(NL); };
              const bgEl = n && n.querySelector('.bg'), note = n ? [lines(n), bgEl ? lines(bgEl) : ''].filter(Boolean).join(NL + NL) : '';
              return { notes: note, title: h ? h.textContent.replace(/\\s+/g, ' ').trim() : '',
                       text: dk.innerText.replace(/\\s+/g, ' ').trim() }; }""", i)
            slides.append(dict(info, full=full, **layout))
            print("slide %2d  %4d shapes  %3d text blocks  %s" % (i + 1, len(layout["items"]), len(layout["texts"]), info["title"][:56]))
        b.close()
    httpd.shutdown()

    native, pictures = new_deck(), new_deck()
    for s in slides:
        sl = native.slides.add_slide(native.slide_layouts[6])
        build_native(sl, s)
        sl.notes_slide.notes_text_frame.text = s["notes"]
        sp = pictures.slides.add_slide(pictures.slide_layouts[6])
        add_picture(sp, s["full"], s["text"])
        sp.notes_slide.notes_text_frame.text = s["notes"]
    a = os.path.join(OUT, "UCLuster-Too-qualifier.pptx")
    c = os.path.join(OUT, "UCLuster-Too-qualifier-pictures.pptx")
    native.save(a)
    pictures.save(c)
    with open(os.path.join(OUT, "layout.json"), "w", encoding="utf-8") as fh:
        json.dump([{k: v for k, v in s.items() if k in ("title", "bg", "items", "texts", "groups")} for s in slides], fh)
    print("\nwrote %s (%.1f MB) and %s (%.1f MB)" % (a, os.path.getsize(a) / 1e6, c, os.path.getsize(c) / 1e6))
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
