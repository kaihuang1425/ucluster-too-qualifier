/* Page editor. Open the deck with ?edit (for example /?edit#5) to change slide text, speaker notes and chart
   numbers in place, then publish them as a pull request. The automatic check runs on it, and one click makes
   it live once the check passes. Nothing here loads during the talk itself.

   How it stays safe
   * deck.js numbers every element (data-si) before it changes the page, and ../lib/htmlmap.mjs finds the same
     element in index.html. An edit replaces only that element's text in the file.
   * Big numbers (data-to) and bar lengths (--v, --a) follow their visible labels, as tools/check.py expects.
   * Edits are kept in this browser until they are published or discarded. */

import * as M from '../lib/htmlmap.mjs';

const D = window.DECK, root = document.documentElement, stage = document.getElementById('stage');
const KEY = 'deck-edit:v1', RESUME = 'deck-edit:resume';
const S = { src: '', js: '', list: [], units: [], bySi: new Map(), notes: new Map(), attr: new Map(),
  block: null, nums: [], vals: [], paths: [], dataOK: false, me: { state: 'loading' }, pr: null, title: '', home: null, poll: 0, stale: false };
const baseText = new WeakMap();
const ALLOW = new Set(['b', 'i', 'em', 'strong', 'sub', 'sup', 's', 'small', 'code', 'u']);
const VOIDS = new Set(['br', 'img', 'hr', 'wbr']);
const LABELS = { P: 'Peak GFLOP/s', B: 'Bandwidth GB/s', ai: 'FLOPs per byte', g: 'Grid GFLOP/s' };
const GROUPS = { roofline: 'Roofline', scaling: 'Strong scaling' };
// a chart is named with the slide it is on now, so the name stays right when slides move
const groupName = g => { const c = document.getElementById(g), n = c ? D.slides.indexOf(c.closest('.dk')) + 1 : 0; return (GROUPS[g] || g) + (n ? ' · slide ' + n : ''); };

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const el = h => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstElementChild; };
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const slideList = ns => { ns = [...new Set(ns)].sort((a, b) => a - b); return ns.length < 2 ? 'slide ' + ns[0] : 'slides ' + ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1]; };
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

/* ------------------------------------------------------------------ start */

let dock, toastEl, modal, card;
boot();

async function boot() {
  await addCss();
  buildUi();
  try { [S.src, S.js] = await Promise.all([fetchText('index.html'), fetchText('deck.js')]); }
  catch (e) { return fail('The editor could not read the deck files. Check your connection and reload.'); }
  const map = M.stageMap(S.src);
  if (map.errors.length) return fail('The editor cannot follow index.html near line ' + M.lineOf(S.src, map.errors[0].at) + '. ' + map.errors[0].msg + '. Fix it on GitHub, then reload.');
  S.list = map.list;
  const live = stage.querySelectorAll('[data-si]');
  let same = live.length > 0;
  live.forEach(e => { const s = S.list[+e.getAttribute('data-si')]; if (!s || s.name !== e.localName.toLowerCase()) same = false; });
  if (!same) return fail('The deck changed after this page loaded. Reload to edit the latest version.');

  findUnits();
  setupData();
  restore();
  wire();
  D.onchange = n => { hostNotes(n); showPos(); };
  D.onmode = () => { hostNotes(D.cur()); D.fit(); refresh(); };
  hostNotes(D.cur()); showPos(); D.fit();
  refresh(true);
  if (document.fonts) document.fonts.ready.then(() => refresh());   // slide fit depends on the web fonts
  window.__deckEditor = { ops: allOps, issues, ser: u => html(S.bySi.get(u)) };   // for tools/test_editor.py
  loadMe();
  if (S.pr) tick();
}

function addCss() {
  return new Promise(res => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./edit.css', import.meta.url).href;
    l.onload = l.onerror = () => res(); document.head.appendChild(l);
  });
}
async function fetchText(path) {
  const r = await fetch(path + '?v=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.text();
}
function fail(msg) {
  const m = el('<div class="ed-fail"></div>'); m.textContent = msg; document.body.appendChild(m);
  if (dock) dock.remove();
  root.style.setProperty('--ed-bottom', '0px'); D.fit();
}

/* ------------------------------------------------------- editable text */

function hasText(e) { for (const c of e.childNodes) if (c.nodeType === 3 && c.data.trim()) return true; return false; }
const squash = s => s.replace(/\s+/g, '');

function findUnits() {
  D.slides.forEach((dk, sec) => {
    dk.querySelectorAll('[data-si]').forEach(e => {
      if (e.closest('svg, .cores, script, style')) return;
      const notes = e.matches('aside.notes');
      if (!notes && !hasText(e)) return;
      if (e.parentElement.closest('[data-ed]')) return;
      if (e.querySelector(':not([data-si])')) return;                  // the deck script draws inside it
      const s = S.list[+e.getAttribute('data-si')];
      if (squash(M.textOf(S.src.slice(s.innerStart, s.innerEnd))) !== squash(e.textContent)) return;
      e.setAttribute('data-ed', ''); e.setAttribute('contenteditable', 'true'); e.spellcheck = true;
      const u = { el: e, si: s.si, s, sec, notes, base: '', problem: null };
      S.units.push(u); S.bySi.set(u.si, u); if (notes) S.notes.set(sec, u);
    });
  });
  S.units.forEach(u => { walkText(u.el, n => baseText.set(n, n.data)); u.base = ser(u.el); });
}
function walkText(n, f) { for (const c of n.childNodes) c.nodeType === 3 ? f(c) : c.nodeType === 1 && walkText(c, f); }

function srcTag(si) { const s = S.list[si]; return S.src.slice(s.start, s.startEnd); }
function srcInner(u) { return S.src.slice(u.s.innerStart, u.s.innerEnd); }
function startTag(si) { let t = srcTag(si); const a = S.attr.get(si); if (a) for (const k in a) t = M.setAttr(t, k, a[k]); return t; }

// text typed in the browser often carries no-break spaces; keep only the ones the file already had
function txt(n) {
  let d = n.data; const b = baseText.get(n);
  if (b !== d) { const lead = !!b && b[0] === ' '; d = d.replace(/ /g, ' '); if (lead && d[0] === ' ') d = ' ' + d.slice(1); }
  return d.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
}
function keepAttrs(c) {
  let a = '';
  for (const at of c.attributes) {
    if (/^(data-si|data-keep|data-ed|contenteditable|spellcheck)$/.test(at.name)) continue;
    a += ' ' + at.name + (at.value === '' && at.name.startsWith('data-') ? '' : '="' + esc(at.value) + '"');
  }
  return a;
}
// the element's content as it should appear in index.html: original tags kept exactly, new tags kept simple
function ser(node) {
  let out = '';
  for (const c of node.childNodes) {
    if (c.nodeType === 3) out += txt(c);
    else if (c.nodeType === 8) out += '<!--' + c.data + '-->';
    else if (c.nodeType === 1) {
      const name = c.localName, si = c.getAttribute('data-si');
      if (si !== null && S.list[+si]) { out += startTag(+si); if (!S.list[+si].self) out += ser(c) + '</' + name + '>'; }
      else if (c.hasAttribute('data-keep')) out += '<' + name + keepAttrs(c) + '>' + (VOIDS.has(name) ? '' : ser(c) + '</' + name + '>');
      else if (name === 'br') out += '<br>';
      else if (ALLOW.has(name) && !c.attributes.length) out += '<' + name + '>' + ser(c) + '</' + name + '>';
      else { if ((name === 'div' || name === 'p') && out && !/<br>\s*$/.test(out)) out += '<br>'; out += ser(c); }
    }
  }
  return out;
}
function html(u) { let h = ser(u.el); if (!/<br>\s*$/.test(u.base)) h = h.replace(/(?:\s*<br>)+\s*$/, ''); return h; }
const dirty = u => html(u) !== u.base;

/* numbers that must agree with their labels (the same pairs tools/check.py tests) */
const num = t => parseFloat(String(t).replace(/[^0-9.\-]/g, ''));
function setAttrEdit(e, name, value) {
  if (e.getAttribute(name) !== value) e.setAttribute(name, value);
  const si = e.getAttribute('data-si'); if (si === null) return;
  const a = S.attr.get(+si) || {};
  if (M.getAttr(srcTag(+si), name) === value) delete a[name]; else a[name] = value;
  Object.keys(a).length ? S.attr.set(+si, a) : S.attr.delete(+si);
}
function setStyleEdit(e, prop, value, tol) {
  const si = e.getAttribute('data-si');
  const from = si !== null ? M.getAttr(srcTag(+si), 'style') || '' : e.getAttribute('style') || '';
  const was = parseFloat(M.getStyleProp(from, prop));
  const keep = isFinite(was) && Math.abs(was - value) <= tol;          // still agrees, so leave the precise value
  e.style.setProperty(prop, keep ? String(M.getStyleProp(from, prop)) : String(value));
  if (si === null) return;
  const a = S.attr.get(+si) || {};
  if (keep) delete a.style; else a.style = M.setStyleProp(from, prop, String(value));
  Object.keys(a).length ? S.attr.set(+si, a) : S.attr.delete(+si);
}
function sync(u) {
  u.problem = null;
  const e = u.el;
  (e.matches('[data-count]') ? [e] : [...e.querySelectorAll('[data-count]')]).forEach(c => {
    const clean = c.textContent.replace(/[^0-9.\-]/g, ''), v = parseFloat(clean);
    if (!isFinite(v) || !/^-?\d*\.?\d+$/.test(clean)) { u.problem = 'The big number on slide ' + (u.sec + 1) + ' has to stay a number, such as 15,345 or 0.71.'; return; }
    const dec = (clean.split('.')[1] || '').length;
    setAttrEdit(c, 'data-to', String(v));
    if (dec || c.hasAttribute('data-dec')) setAttrEdit(c, 'data-dec', String(dec));
  });
  if (e.localName !== 'b') return;
  const shown = num(e.textContent);
  if (!isFinite(shown)) return;
  const row = e.closest('.lv, .cl');
  if (row && row.querySelector('b') === e) { const i = row.querySelector('.lv-t i, .cl-t i'); if (i) setStyleEdit(i, '--v', shown, 0.5); }
  const age = e.parentElement;
  if (age && age.parentElement && age.parentElement.matches('.agebars') && age.querySelector('b') === e) setStyleEdit(age, '--v', shown, 0.5);
  const nz = e.closest('.nz-row');
  if (nz && nz.querySelector('b') === e) setStyleEdit(nz, '--a', shown, 0.006);
}

/* ------------------------------------------------------- chart numbers */

function getPath(o, p) { return p.reduce((v, k) => v == null ? v : v[k], o); }
function setPath(o, p, v) { getPath(o, p.slice(0, -1))[p[p.length - 1]] = v; }
function setupData() {
  S.block = M.dataBlock(S.js);
  if (!S.block || !window.DECK_DATA) return;
  S.nums = M.dataNumbers(S.block.text);
  const paths = [];
  (function walk(v, p) {
    if (typeof v === 'number') paths.push(p);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, p.concat(i)));
    else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], p.concat(k)));
  })(window.DECK_DATA, []);
  S.paths = paths; S.vals = S.nums.map(n => n.text);
  S.dataOK = paths.length === S.nums.length && paths.every((p, k) => getPath(window.DECK_DATA, p) === +S.nums[k].text);
}
function dataLabel(k) {
  const p = S.paths[k], item = window.DECK_DATA[p[0]][p[1]];
  if (p[2] === 'p') return groupName(p[0]) + ' · ' + item.n + ' · ' + (p[4] === 0 ? 'thread count ' + (p[3] + 1) : 'speed-up at ' + item.p[p[3]][0] + ' threads');
  return groupName(p[0]) + ' · ' + item.n + ' · ' + (LABELS[p[2]] || p[2]);
}
let redrawT = 0;
function setValue(k, text) {
  S.vals[k] = text; setPath(window.DECK_DATA, S.paths[k], +text);
  clearTimeout(redrawT); redrawT = setTimeout(() => { D.redraw(); }, 120);
}

/* ------------------------------------------------------- saved drafts */

function save() {
  if (S.stale) { store.del(KEY); return; }           // these edits are live now, nothing left to keep
  const d = { v: 1, units: {}, data: null, pr: S.pr, title: S.title };
  S.units.forEach(u => { if (dirty(u)) d.units[u.si] = { old: srcInner(u), new: html(u) }; });
  if (S.vals.some((v, k) => v !== S.nums[k].text)) d.data = { old: S.block.text, vals: S.vals };
  if (!Object.keys(d.units).length && !d.data && !d.pr) store.del(KEY); else store.set(KEY, JSON.stringify(d));
}
function restore() {
  let d = null; try { d = JSON.parse(store.get(KEY) || 'null'); } catch (e) {}
  if (!d || d.v !== 1) return;
  let dropped = 0, kept = 0;
  for (const si in d.units) {
    const u = S.bySi.get(+si), x = d.units[si];
    if (!u || srcInner(u) !== x.old) { dropped++; continue; }
    u.el.innerHTML = x.new; u.el.querySelectorAll('*').forEach(e => e.setAttribute('data-keep', ''));
    walkText(u.el, n => baseText.set(n, n.data));
    sync(u); kept++;
  }
  if (d.data && S.dataOK) {
    if (d.data.old === S.block.text) { d.data.vals.forEach((v, k) => { if (v !== S.nums[k].text) setValue(k, v); }); kept++; } else dropped++;
  }
  S.pr = d.pr || null; S.title = d.title || '';
  if (dropped) setTimeout(() => toast(plural(dropped, 'saved edit') + ' no longer matched the deck, because someone changed the same text. ' + (kept ? 'Your other edits are back.' : '')), 600);
  else if (kept) setTimeout(() => toast('Your unpublished edits are back.'), 600);
}

/* ------------------------------------------------------- collecting edits */

function allOps() {
  const ops = [];
  S.units.forEach(u => { if (dirty(u)) ops.push({ file: 'index.html', kind: 'inner', si: u.si, name: u.s.name, old: srcInner(u), new: html(u), slide: u.sec + 1 }); });
  S.attr.forEach((a, si) => {
    const live = document.querySelector('[data-si="' + si + '"]');
    if (!live || (live.parentElement && live.parentElement.closest('[data-ed]'))) return;   // saved as part of its text block
    const t = startTag(si), old = srcTag(si);
    if (t !== old) ops.push({ file: 'index.html', kind: 'tag', si, name: S.list[si].name, old, new: t, slide: S.list[si].sec + 1 });
  });
  if (S.dataOK && S.vals.some((v, k) => v !== S.nums[k].text)) ops.push({ file: 'deck.js', kind: 'data', old: S.block.text, new: M.replaceNumbers(S.block.text, S.vals), slide: 0 });
  return ops;
}
function changedSlides(ops) { const s = []; ops.forEach(o => { if (o.kind === 'data') s.push(...S.vals.map((v, k) => v !== S.nums[k].text ? (S.paths[k][0] === 'roofline' ? 11 : 13) : 0).filter(Boolean)); else s.push(o.slide); }); return [...new Set(s)].sort((a, b) => a - b); }
function defaultTitle(ops) { const s = changedSlides(ops); return s.length ? 'Edit ' + slideList(s) : 'Edit the deck'; }

/* ------------------------------------------------------- checks */

function fitIssues() {
  if (D.read()) return [];
  const sc = parseFloat(stage.style.getPropertyValue('--s')) || 1, sr = stage.getBoundingClientRect(), out = [];
  D.slides.forEach((dk, i) => {
    let top = 1e9, bottom = 0, src = null;
    for (const c of dk.children) {
      if (c.matches('.notes, .rnotes, .halo')) continue;
      const r = c.getBoundingClientRect(); if (!r.height) continue;
      const t = (r.top - sr.top) / sc, b = (r.bottom - sr.top) / sc;
      if (c.matches('.srcl, .foot')) { src = Math.min(src == null ? 1e9 : src, t); continue; }
      top = Math.min(top, t); bottom = Math.max(bottom, b);
    }
    const limit = src != null ? src - 14 : 1060;
    const over = Math.round(Math.max(100 - top, bottom - limit));
    if (over > 0) out.push({ slide: i + 1, over });
  });
  return out;
}
function writingIssues(u) {
  const t = u.el.textContent.replace(/\b\d{1,2}:\d{2}\b/g, '').replace(/https?:\/\/\S+/g, '');
  const out = [];
  if (t.includes(':')) out.push('a colon'); if (t.includes(';')) out.push('a semicolon'); if (t.includes('—')) out.push('an em dash');
  const m = /\b(gaps?|bridges?|shifts?)\b/i.exec(t); if (m) out.push('the word “' + m[1] + '”');
  return out;
}
function issues() {
  const bad = [], warn = [];
  fitIssues().forEach(f => bad.push({ slide: f.slide, text: 'Slide ' + f.slide + ' runs ' + f.over + ' px outside its frame. Shorten the text or remove a line.' }));
  S.units.forEach(u => { if (u.problem) bad.push({ slide: u.sec + 1, text: u.problem }); });
  S.units.forEach(u => { if (!dirty(u)) return; const w = writingIssues(u); if (w.length) warn.push({ slide: u.sec + 1, text: 'Slide ' + (u.sec + 1) + (u.notes ? ' speaker notes have ' : ' has ') + w.join(' and ') + '. The house style splits the sentence or picks another word.' }); });
  if (S.dataOK) S.vals.forEach((v, k) => { if (!/^-?(\d+\.?\d*|\.\d+)$/.test(v)) bad.push({ slide: 0, text: dataLabel(k) + ' has to be a number.' }); });
  return { bad, warn };
}

/* ------------------------------------------------------- refresh the dock */

let refreshT = 0;
function refresh(now) {
  clearTimeout(refreshT);
  const run = () => {
    if (S.stale) return;
    const ops = allOps(), slides = changedSlides(ops), n = ops.filter(o => o.kind !== 'tag').length;
    S.units.forEach(u => u.el.classList.toggle('ed-dirty', dirty(u)));
    const { bad, warn } = issues();
    const over = new Map(fitIssues().map(f => [f.slide, f.over]));
    D.slides.forEach((dk, i) => { const o = over.get(i + 1); dk.classList.toggle('ed-over', !!o); if (o) dk.setAttribute('data-ed-over', 'This slide runs ' + o + ' px outside its frame'); else dk.removeAttribute('data-ed-over'); });
    const sum = dock.querySelector('.ed-sum');
    sum.innerHTML = n ? '<b>' + plural(n, 'change') + '</b> on ' + slideList(slides) + '. Saved in this browser until you publish.' : (S.pr && S.pr.open ? 'Your published edits are waiting in pull request #' + S.pr.number + '.' : 'Click any text on a slide to change it.');
    const chk = dock.querySelector('[data-a="checks"]');
    chk.className = 'ed-btn ed-chk' + (bad.length ? ' on bad' : warn.length ? ' on warn' : '');
    chk.textContent = bad.length ? plural(bad.length, 'problem') : plural(warn.length, 'style note');
    const pub = dock.querySelector('[data-a="publish"]'), badge = pub.querySelector('.ed-n');
    pub.disabled = !n; badge.hidden = !n; badge.textContent = n;
    pub.firstChild.nodeValue = S.pr && S.pr.open ? 'Update #' + S.pr.number : 'Publish';
    dock.querySelector('[data-a="discard"]').hidden = !n;
    renderPrChip();
    showTime();
    save();
  };
  now ? run() : (refreshT = setTimeout(run, 120));
}
function showPos() { const p = dock.querySelector('.ed-pos span'); if (p) p.textContent = (D.cur() + 1) + ' / ' + D.slides.length; }

/* ------------------------------------------------------- notes */

function hostNotes(n) {
  const h = S.home;
  if (h) { h.parent.insertBefore(h.el, h.next); S.home = null; }
  const host = dock.querySelector('.ed-host'); host.textContent = '';
  if (D.read() || n < 0) return;
  const u = S.notes.get(n);
  if (!u) { host.appendChild(el('<span class="ed-empty">This slide has no speaker notes.</span>')); return; }
  S.home = { el: u.el, parent: u.el.parentNode, next: u.el.nextSibling };
  host.appendChild(u.el);
  showTime();
}
// The notes sit in the toolbar while a slide is open, so the deck is told where to find them.
function showTime() {
  const lab = dock && dock.querySelector('.ed-notes > span');
  if (!lab || !D.timing) return;
  const s = D.slides[D.cur()], k = D.talk.indexOf(s);
  if (k < 0) { lab.innerHTML = 'Backup notes<small>not timed</small>'; return; }
  const t = D.timing(x => { const u = S.notes.get(D.slides.indexOf(x)); return u ? u.el : x.querySelector('.notes'); });
  lab.innerHTML = 'Script · ' + Math.round(t.rows[k]) + ' s<small' + (t.total > t.limit ? ' class="over"' : '') + '>Talk ' + D.clock(t.total) + ' of ' + D.clock(t.limit) + '</small>';
}

/* ------------------------------------------------------- interface */

function buildUi() {
  dock = el(`<div class="ed-dock" role="region" aria-label="Page editor">
    <div class="ed-row">
      <span class="ed-mode"><i></i>Editing</span>
      <span class="ed-pos ed-wide"><button class="ed-btn icon ghost" data-a="prev" aria-label="Previous slide">‹</button><span>1 / 23</span><button class="ed-btn icon ghost" data-a="next" aria-label="Next slide">›</button></span>
      <div class="ed-grow"><span class="ed-sum">Loading the editor…</span></div>
      <button class="ed-btn ed-chk" data-a="checks"></button>
      <button class="ed-btn ed-pr" data-a="pr"><span class="ed-dot"></span><span></span></button>
      <button class="ed-btn ghost ed-wide" data-a="chart">Chart numbers</button>
      <button class="ed-btn ghost" data-a="discard" hidden>Discard</button>
      <button class="ed-btn primary" data-a="publish" disabled>Publish<span class="ed-n" hidden>0</span></button>
      <span class="ed-acct ed-wide"></span>
    </div>
    <div class="ed-notes"><span>Speaker notes</span><div class="ed-host"></div></div>
  </div>`);
  toastEl = el('<div class="ed-toast" role="status" aria-live="polite"></div>');
  modal = el('<div class="ed-modal" hidden><div class="ed-card" role="dialog" aria-modal="true"></div></div>');
  card = modal.firstElementChild;
  document.body.append(dock, toastEl, modal);
}

let toastT = 0;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 5200); }

function open(htmlStr, focusSel) {
  card.innerHTML = htmlStr; modal.hidden = false;
  const f = card.querySelector('[autofocus]') || card.querySelector(focusSel || '.ed-btn.primary:not([disabled])') || card.querySelector('footer .ed-btn');
  if (f) setTimeout(() => f.focus(), 0);
}
function close() { modal.hidden = true; card.innerHTML = ''; }

function wire() {
  document.addEventListener('input', e => {
    if (e.target.closest && e.target.closest('.ed-modal')) return;
    const u = e.target.closest && e.target.closest('[data-ed]') ? S.bySi.get(+e.target.closest('[data-ed]').getAttribute('data-si')) : null;
    if (!u) return;
    sync(u); refresh();
  });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); openReview(); return; }
    if (!modal.hidden && e.key === 'Escape') { close(); return; }
    const t = e.target.closest && e.target.closest('[data-ed]');
    if (!t) return;
    if (e.key === 'Escape') { t.blur(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const u = S.bySi.get(+t.getAttribute('data-si'));
      if (e.shiftKey || (u && u.notes)) document.execCommand('insertLineBreak'); else t.blur();
    }
  });
  document.addEventListener('paste', e => {
    const t = e.target.closest && e.target.closest('[data-ed]'); if (!t) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\s*\r?\n\s*/g, ' ');
    document.execCommand('insertText', false, text);
  });
  document.addEventListener('drop', e => { if (e.target.closest && e.target.closest('[data-ed]')) e.preventDefault(); });
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-ed] a, [data-ed][href]'); if (a) e.preventDefault(); });
  document.addEventListener('focusin', e => {
    const t = e.target.closest && e.target.closest('#stage [data-ed]'); if (!t || D.read()) return;
    const sec = D.slides.indexOf(t.closest('.dk')); if (sec >= 0 && sec !== D.cur()) D.go(sec);
  });
  addEventListener('resize', () => refresh());
  const act = e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.getAttribute('data-a');
    ({ prev: () => D.go(D.cur() - 1), next: () => D.go(D.cur() + 1), publish: openReview, checks: openChecks, chart: openChart,
      discard: discard, pr: openProgress, close: close, signin: signIn, signout: signOut, download: download, live: makeLive, closepr: closePr,
      reload: () => location.reload(), go: () => { close(); D.go(+b.getAttribute('data-n') - 1); },
      send: publish })[a]?.();
  };
  dock.addEventListener('click', act);
  modal.addEventListener('click', e => { if (e.target === modal) close(); else act(e); });
}

function discard() {
  const ops = allOps(); if (!ops.length) return;
  if (!confirm('Discard ' + plural(ops.filter(o => o.kind !== 'tag').length, 'unpublished change') + '? This cannot be undone.')) return;
  const pr = S.pr; store.del(KEY); if (pr) store.set(KEY, JSON.stringify({ v: 1, units: {}, data: null, pr, title: S.title }));
  location.reload();
}

/* ------------------------------------------------------- account */

async function api(path, body) {
  try {
    const r = await fetch('/api/' + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' } : { credentials: 'same-origin', cache: 'no-store' });
    let data = null; try { data = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, data: data || {} };
  } catch (e) { return { ok: false, status: 0, data: { error: 'The network request failed. Check your connection.' } }; }
}
async function loadMe() {
  const r = await api('me');
  const d = r.data;
  if (!r.ok && r.status !== 401 || d.configured === undefined) S.me = { state: 'off', why: 'here' };
  else if (!d.configured) S.me = { state: 'off', why: 'setup', site: d.site };
  else if (!d.signedIn) S.me = { state: 'signin', site: d.site, here: d.signInHere };
  else if (!d.canPush) S.me = { state: 'noaccess', login: d.login, reason: d.reason };
  else S.me = { state: 'ready', login: d.login, avatar: d.avatar };
  renderAcct();
  if (store.get(RESUME) === 'publish') { store.del(RESUME); if (S.me.state === 'ready') openReview(); }
}
function renderAcct() {
  const a = dock.querySelector('.ed-acct'), m = S.me;
  if (m.state === 'ready') a.innerHTML = (m.avatar ? '<img alt="" src="' + esc(m.avatar) + '">' : '') + '<span>@' + esc(m.login) + '</span><button class="ed-btn ghost" data-a="signout">Sign out</button>';
  else if (m.state === 'signin') a.innerHTML = '<button class="ed-btn ghost" data-a="signin">Sign in with GitHub</button>';
  else if (m.state === 'noaccess') a.innerHTML = '<span>@' + esc(m.login) + ' cannot publish</span><button class="ed-btn ghost" data-a="signout">Sign out</button>';
  else a.textContent = '';
}
function signIn() {
  save(); store.set(RESUME, 'publish');
  const here = location.pathname + location.search + location.hash;
  location.href = '/api/auth/login?return=' + encodeURIComponent(here);
}
async function signOut() { await api('auth/logout', {}); S.me = { state: 'signin' }; renderAcct(); toast('Signed out of GitHub on this page.'); }

/* ------------------------------------------------------- word diff */

function diff(a, b) {
  const A = a.split(/(\s+)/).filter(Boolean), B = b.split(/(\s+)/).filter(Boolean);
  if (A.length * B.length > 250000) return '<del>' + esc(a) + '</del> <ins>' + esc(b) + '</ins>';
  const L = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const seq = [];
  let i = 0, j = 0;
  while (i < A.length || j < B.length) {
    if (i < A.length && j < B.length && A[i] === B[j]) { seq.push(['eq', A[i]]); i++; j++; }
    else if (i < A.length && (j === B.length || L[i + 1][j] >= L[i][j + 1])) { seq.push(['del', A[i]]); i++; }
    else { seq.push(['ins', B[j]]); j++; }
  }
  // removed words first, then added words, each run in one mark with its own spaces
  let out = '', k = 0;
  while (k < seq.length) {
    if (seq[k][0] === 'eq') { out += esc(seq[k][1]); k++; continue; }
    const del = [], ins = [];
    while (k < seq.length && seq[k][0] !== 'eq') { (seq[k][0] === 'del' ? del : ins).push(seq[k][1]); k++; }
    const d = del.join('').trim(), n = ins.join('').trim();
    if (!d && !n) { out += ' '; continue; }
    if (out && !/\s$/.test(out)) out += ' ';
    out += (d ? '<del>' + esc(d) + '</del>' : '') + (d && n ? ' ' : '') + (n ? '<ins>' + esc(n) + '</ins>' : '');
    if (k < seq.length && !/^\s/.test(seq[k][1])) out += ' ';
  }
  return out;
}
function slideTitle(n) { const h = D.slides[n - 1] && D.slides[n - 1].querySelector('h1, h2'); return h ? h.textContent.trim() : ''; }
function changesHtml(ops) {
  const by = new Map();
  ops.forEach(o => {
    if (o.kind === 'tag') return;
    if (o.kind === 'data') {
      S.vals.forEach((v, k) => { if (v === S.nums[k].text) return; const n = S.paths[k][0] === 'roofline' ? 11 : 13;
        (by.get(n) || by.set(n, []).get(n)).push('<div class="ed-change">' + esc(dataLabel(k)) + ' <del>' + esc(S.nums[k].text) + '</del> <ins>' + esc(v) + '</ins><small>Chart number in deck.js. Check any slide text that quotes it.</small></div>'); });
      return;
    }
    const u = S.bySi.get(o.si);
    const before = M.textOf(o.old), after = M.textOf(o.new);
    let note = '';
    if (u && (u.el.matches('[data-count]') || u.el.querySelector('[data-count]'))) note = '<small>The count-up value follows the new number.</small>';
    else if (u && u.el.localName === 'b' && u.el.closest('.lv, .cl, .agebars, .nz-row')) note = '<small>The bar or dot follows the new label.</small>';
    (by.get(o.slide) || by.set(o.slide, []).get(o.slide)).push('<div class="ed-change">' + (before || after ? diff(before, after) : '<i>formatting only</i>') + (u && u.notes ? '<small>Speaker notes</small>' : '') + note + '</div>');
  });
  return [...by.keys()].sort((a, b) => a - b).map(n => '<div class="ed-slide"><h4>Slide ' + n + ' · ' + esc(slideTitle(n).slice(0, 70)) + '</h4>' + by.get(n).join('') + '</div>').join('');
}

/* ------------------------------------------------------- review and publish */

function openReview() {
  if (S.stale) return;
  const ops = allOps();
  if (!ops.length) { if (S.pr) openProgress(); else toast('Change some text first. Click any words on a slide.'); return; }
  const { bad, warn } = issues(), m = S.me, n = ops.filter(o => o.kind !== 'tag').length;
  const upd = S.pr && S.pr.open;
  let note = '', primary = '';
  if (m.state === 'ready') primary = '<button class="ed-btn primary" data-a="send"' + (bad.length ? ' disabled' : '') + '>' + (upd ? 'Update pull request #' + S.pr.number : 'Publish for review') + '</button>';
  else if (m.state === 'signin') primary = '<button class="ed-btn primary" data-a="signin"' + (bad.length ? ' disabled' : '') + '>Sign in with GitHub to publish</button>';
  else if (m.state === 'noaccess') note = '<p class="ed-note warn">Your GitHub account @' + esc(m.login) + ' cannot write to the repository yet. Ask the owner to add you as a collaborator, then sign out and sign in again.</p>';
  else if (m.state === 'loading') note = '<p class="ed-note">Checking your GitHub sign-in. Try again in a moment.</p>';
  else if (m.why === 'setup') note = '<p class="ed-note warn">Publishing from the page is not switched on yet. The repository owner finishes a one-time setup described in the README. Until then you can download the edited files and upload them on GitHub.</p>';
  else note = '<p class="ed-note warn">Publishing works on the live site at ucluster-too-qualifier.vercel.app. Here you can download the edited files and upload them on GitHub.</p>';
  open(`<header><h3>Review your changes</h3><p>${plural(n, 'change')} on ${slideList(changedSlides(ops))}. ${upd ? 'This replaces what pull request #' + S.pr.number + ' holds now.' : 'Publishing opens a pull request. The live site stays as it is until the check passes and you make it live.'}</p></header>
    <div class="ed-body">
      ${bad.length ? '<div class="ed-note bad"><b>Fix these before publishing.</b><ul>' + bad.map(x => '<li>' + esc(x.text) + '</li>').join('') + '</ul></div>' : ''}
      ${warn.length ? '<div class="ed-note warn"><b>Style notes.</b> These do not block publishing.<ul>' + warn.map(x => '<li>' + esc(x.text) + '</li>').join('') + '</ul></div>' : ''}
      ${note}
      ${changesHtml(ops)}
      <div class="ed-field"><label for="ed-title">Pull request title</label><input id="ed-title" class="ed-input" maxlength="120" value="${esc(S.title || defaultTitle(ops))}"></div>
    </div>
    <footer><button class="ed-link" data-a="download">Download the edited files</button><span class="ed-grow"></span><button class="ed-btn ghost" data-a="close">Keep editing</button>${primary}</footer>`);
}

async function publish() {
  const ops = allOps();
  if (!ops.length || issues().bad.length) return;
  const input = card.querySelector('#ed-title');
  S.title = (input && input.value.trim()) || defaultTitle(ops); save();
  const upd = S.pr && S.pr.open;
  open('<header><h3>' + (upd ? 'Updating the pull request' : 'Publishing') + '</h3><p>Saving your edits to a new branch on GitHub.</p></header><div class="ed-body"><ol class="ed-steps"><li class="run"><i></i><div><b>Sending ' + plural(ops.filter(o => o.kind !== 'tag').length, 'change') + '</b></div></li></ol></div><footer></footer>');
  const r = await api('publish', { ops, title: S.title, branch: upd ? S.pr.branch : null, pr: upd ? S.pr.number : null });
  if (r.status === 409 && r.data.conflicts) {
    const list = r.data.conflicts.map(c => '<li>Slide ' + c.slide + (c.text ? ' · “' + esc(c.text.slice(0, 90)) + '”' : '') + '</li>').join('');
    open(`<header><h3>Someone changed the same text</h3><p>These parts changed on GitHub after you opened the page, so publishing them would overwrite another edit.</p></header>
      <div class="ed-body"><div class="ed-note warn"><ul>${list || '<li>' + esc(r.data.error || '') + '</li>'}</ul></div><p class="ed-note">Reload to get the latest deck. Your other edits come back by themselves. Redo the ones listed here.</p></div>
      <footer><span class="ed-grow"></span><button class="ed-btn ghost" data-a="close">Not now</button><button class="ed-btn primary" data-a="reload">Reload the deck</button></footer>`);
    return;
  }
  if (r.status === 401) { S.me = { state: 'signin' }; renderAcct(); openReview(); toast('Your GitHub sign-in expired. Sign in again to publish.'); return; }
  if (!r.ok) {
    open(`<header><h3>Publishing did not work</h3><p>${esc(r.data.error || 'GitHub returned an error (' + r.status + ').')}</p></header><div class="ed-body"><p class="ed-note">Your edits are still saved in this browser. Try again, or download the edited files.</p></div>
      <footer><button class="ed-link" data-a="download">Download the edited files</button><span class="ed-grow"></span><button class="ed-btn ghost" data-a="close">Close</button><button class="ed-btn primary" data-a="publish">Try again</button></footer>`);
    return;
  }
  S.pr = { number: r.data.pr, url: r.data.url, branch: r.data.branch, sha: r.data.sha, open: true, at: Date.now(), status: null };
  save(); refresh(true);
  openProgress();
  tick();
}

/* ------------------------------------------------------- after publishing */

function step(cls, title, sub) { return '<li class="' + cls + '"><i></i><div><b>' + title + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div></li>'; }
function progressHtml() {
  const p = S.pr, st = p.status || {}, ck = st.check || { state: 'waiting' };
  const mins = Math.max(0, Math.round((Date.now() - p.at) / 60000));
  const merged = !!st.merged;
  let steps = step('ok', 'Published for review', 'Branch ' + esc(p.branch) + '. The live site is unchanged so far.');
  if (ck.state === 'success') steps += step('ok', 'The automatic check passed', 'Every slide fits and every number matches its label.');
  else if (ck.state === 'failure') steps += step('bad', 'The automatic check found problems', (st.errors && st.errors.length ? '<ul style="margin:6px 0 0;padding-left:18px">' + st.errors.slice(0, 8).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + 'Fix them on the page, then press Update.' + (ck.url ? ' <a class="ed-link" target="_blank" rel="noopener" href="' + esc(ck.url) + '">See the full log</a>' : ''));
  else steps += step('run', ck.state === 'running' ? 'The automatic check is running' : 'Waiting for the automatic check to start', 'It tests that every slide fits and that numbers match. It usually takes about three minutes' + (mins ? ', and it has been running for ' + plural(mins, 'minute') : '') + '.');
  if (!merged) {
    if (st.preview && st.preview.url) steps += step('ok', 'Preview ready', '<a class="ed-link" target="_blank" rel="noopener" href="' + esc(st.preview.url) + '">Open the preview</a> to see the deck with your edits, on a phone too.');
    else steps += step(st.preview && st.preview.state === 'failure' ? 'bad' : 'run', st.preview && st.preview.state === 'failure' ? 'The Vercel preview failed' : 'Vercel is building a preview', 'The link appears here when it is ready.');
  }
  if (merged) steps += st.live === 'ready' ? step('ok', 'Live now', 'The live site shows your edits. Reload this page before editing again.') : step('run', 'Going live', 'The live site updates in about a minute.');
  const canLive = !merged && st.state === 'open' && ck.state === 'success' && st.mergeable !== false;
  const blocked = !merged && ck.state === 'success' && st.mergeable === false;
  return `<header><h3>Pull request #${p.number}</h3><p><a class="ed-link" target="_blank" rel="noopener" href="${esc(p.url)}">Open it on GitHub</a> to review the change or ask a teammate to look.</p></header>
    <div class="ed-body"><ol class="ed-steps">${steps}</ol>${blocked ? '<p class="ed-note warn">GitHub cannot merge this pull request as it is, usually because the deck changed meanwhile. Press Update to rebuild it on the latest version.</p>' : ''}</div>
    <footer>${merged ? '' : '<button class="ed-btn ghost danger" data-a="closepr">Close pull request</button>'}<span class="ed-grow"></span>
      ${merged ? (st.live === 'ready' ? '<button class="ed-btn primary" data-a="reload">Reload</button>' : '<button class="ed-btn ghost" data-a="close">Close</button>') : '<button class="ed-btn ghost" data-a="close">Keep editing</button><button class="ed-btn primary" data-a="live"' + (canLive ? '' : ' disabled') + '>Make it live</button>'}</footer>`;
}
function openProgress() { if (!S.pr) return; open(progressHtml(), '.ed-btn.primary:not([disabled]), [data-a="close"]'); }
function renderPrChip() {
  const b = dock.querySelector('[data-a="pr"]'), p = S.pr;
  if (!p) { b.className = 'ed-btn ed-pr'; return; }
  const st = p.status || {}, ck = (st.check || {}).state;
  let cls = 'run', label = '#' + p.number + ' checking';
  if (st.merged) { cls = st.live === 'ready' ? 'ok' : 'run'; label = st.live === 'ready' ? 'Live now' : 'Going live'; }
  else if (ck === 'success') { cls = 'ok'; label = '#' + p.number + ' ready to go live'; }
  else if (ck === 'failure') { cls = 'bad'; label = '#' + p.number + ' check failed'; }
  b.className = 'ed-btn ed-pr on ' + cls; b.lastChild.textContent = label;
}
async function tick() {
  clearTimeout(S.poll);
  if (!S.pr) return;
  const r = await api('status?pr=' + S.pr.number);
  if (r.ok && S.pr) {
    const st = r.data;
    S.pr.status = st;
    if (st.merged) { S.pr.open = false; if (st.live === 'ready') liveNow(); }
    else if (st.state === 'closed') { S.pr = null; toast('The pull request was closed on GitHub. Your edits are still here.'); }
    save(); refresh(true);
    if (!modal.hidden && card.querySelector('.ed-steps') && S.pr) card.innerHTML = progressHtml();
  }
  const done = !S.pr || (S.pr.status && S.pr.status.merged && S.pr.status.live === 'ready');
  if (!done) S.poll = setTimeout(tick, document.hidden ? 15000 : 5000);
}
function liveNow() {
  if (S.stale) return;
  S.stale = true;                                   // the file on GitHub now has these edits, so start fresh
  const keep = S.pr; store.del(KEY);
  S.units.forEach(u => { u.el.removeAttribute('contenteditable'); u.el.classList.remove('ed-dirty'); });
  dock.querySelector('.ed-sum').innerHTML = '<b>Live now.</b> Reload the page to keep editing.';
  dock.querySelector('[data-a="publish"]').disabled = true; dock.querySelector('[data-a="discard"]').hidden = true;
  S.pr = keep;
}
async function makeLive() {
  const b = card.querySelector('[data-a="live"]'); if (b) { b.disabled = true; b.textContent = 'Merging…'; }
  const r = await api('merge', { pr: S.pr.number });
  if (!r.ok) { toast(r.data.error || 'GitHub would not merge the pull request.'); openProgress(); return; }
  S.pr.status = Object.assign({}, S.pr.status, { merged: true, live: 'pending' }); S.pr.open = false;
  save(); openProgress(); tick();
}
async function closePr() {
  if (!confirm('Close pull request #' + S.pr.number + ' without publishing? Your edits stay on this page.')) return;
  const r = await api('close', { pr: S.pr.number });
  if (!r.ok) { toast(r.data.error || 'GitHub would not close the pull request.'); return; }
  S.pr = null; save(); refresh(true); close(); toast('Pull request closed. Your edits are still here.');
}

/* ------------------------------------------------------- other dialogs */

function openChecks() {
  const { bad, warn } = issues();
  const row = x => '<li>' + esc(x.text) + (x.slide ? ' <button class="ed-link" data-a="go" data-n="' + x.slide + '">Show slide ' + x.slide + '</button>' : '') + '</li>';
  open(`<header><h3>Checks</h3><p>The editor runs the same tests as the automatic check while you type.</p></header><div class="ed-body">
    ${bad.length ? '<div class="ed-note bad"><b>Problems that block publishing</b><ul>' + bad.map(row).join('') + '</ul></div>' : '<p class="ed-note ok">Every slide fits and every number matches its label.</p>'}
    ${warn.length ? '<div class="ed-note warn"><b>Style notes</b><ul>' + warn.map(row).join('') + '</ul></div>' : ''}</div>
    <footer><span class="ed-grow"></span><button class="ed-btn primary" data-a="close">Done</button></footer>`);
}

function openChart() {
  if (!S.dataOK) { toast('The chart numbers in deck.js have an unusual layout, so edit them on GitHub instead.'); return; }
  const k = p => S.paths.findIndex(q => q.join('.') === p.join('.'));
  const input = (i) => '<input class="ed-input' + (S.vals[i] !== S.nums[i].text ? ' changed' : '') + '" inputmode="decimal" data-k="' + i + '" value="' + esc(S.vals[i]) + '" aria-label="' + esc(dataLabel(i)) + '">';
  let body = '';
  Object.keys(window.DECK_DATA).forEach(g => {
    const items = window.DECK_DATA[g];
    if (!Array.isArray(items)) return;
    const flat = items.some(it => Object.keys(it).some(f => typeof it[f] === 'number'));
    if (flat) {
      const fields = Object.keys(items[0]).filter(f => typeof items[0][f] === 'number');
      body += '<div class="ed-slide"><h4>' + esc(groupName(g)) + '</h4><table class="ed-tbl"><tr><th></th>' + fields.map(f => '<th>' + esc(LABELS[f] || f) + '</th>').join('') + '</tr>' +
        items.map((it, i) => '<tr><td>' + esc(it.n) + '</td>' + fields.map(f => '<td>' + input(k([g, i, f])) + '</td>').join('') + '</tr>').join('') + '</table></div>';
    } else {
      body += '<div class="ed-slide"><h4>' + esc(groupName(g)) + '</h4>' + items.map((it, i) => '<div style="margin:8px 0 12px"><div style="color:var(--muted);margin-bottom:4px">' + esc(it.n) + ' · threads, then speed-up</div><div class="ed-pairs">' +
        (it.p || []).map((q, j) => '<label>' + input(k([g, i, 'p', j, 0])) + input(k([g, i, 'p', j, 1])) + '</label>').join('') + '</div></div>').join('') + '</div>';
    }
  });
  open(`<header><h3>Chart numbers</h3><p>The charts redraw as you type. If a slide's text quotes a number, change that text as well.</p></header><div class="ed-body">${body}</div>
    <footer><span class="ed-grow"></span><button class="ed-btn primary" data-a="close">Done</button></footer>`, '.ed-btn.primary');
  card.querySelectorAll('input[data-k]').forEach(inp => inp.addEventListener('input', () => {
    const i = +inp.getAttribute('data-k'), v = inp.value.trim();
    const ok = /^-?(\d+\.?\d*|\.\d+)$/.test(v);
    inp.classList.toggle('bad', !ok);
    S.vals[i] = v;
    if (ok) setValue(i, v);
    inp.classList.toggle('changed', ok && v !== S.nums[i].text);
    refresh();
  }));
  const go = S.paths.length && S.paths[0][0] === 'roofline' ? 11 : 13;
  if (!D.read() && D.cur() !== go - 1 && D.cur() !== 12) D.go(go - 1);
}

function download() {
  const ops = allOps();
  const h = M.applyHtmlOps(S.src, ops.filter(o => o.file === 'index.html'));
  if (h.error) { toast(h.error); return; }
  const files = [['index.html', h.out]];
  const dop = ops.find(o => o.kind === 'data');
  if (dop) { const j = M.applyDataOp(S.js, dop); if (j.error) { toast(j.error); return; } files.push(['deck.js', j.out]); }
  files.forEach(([name, text], i) => setTimeout(() => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }, i * 400));
  toast('Downloaded ' + files.map(f => f[0]).join(' and ') + '. On GitHub, choose Add file, then Upload files, and commit them to a new branch.');
}
