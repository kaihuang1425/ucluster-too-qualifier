/* Source map for the page editor.

   The editor in edit/ and the publish function in api/ both use this file. It reads index.html as text and
   records where every element inside <div id="stage"> starts and ends, in the same order the browser builds
   them. An edit then replaces only the characters of the element that changed, so the rest of the file keeps
   its exact formatting. It also finds the numbers inside DECK_DATA in deck.js. */

const VOID = new Set('area base br col embed hr img input link meta source track wbr'.split(' '));
const RAW = new Set(['script', 'style', 'textarea', 'title']);
// a start tag from this list ends an open <p> in the browser, which would break the mapping
const CLOSES_P = new Set('address article aside blockquote details dialog div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr main menu nav ol p pre section table ul'.split(' '));

export function lineOf(src, at) { let n = 1; for (let i = 0; i < at && i < src.length; i++) if (src.charCodeAt(i) === 10) n++; return n; }

// Parse one start tag beginning at src[lt] === '<'. Returns null when it is not a tag.
function readTag(src, lt) {
  let j = lt + 1;
  const m = /^[a-zA-Z][^\s/>]*/.exec(src.slice(j, j + 64));
  if (!m) return null;
  const name = m[0].toLowerCase();
  j += m[0].length;
  const attrs = [];
  for (;;) {
    while (j < src.length && /\s/.test(src[j])) j++;
    if (j >= src.length) return null;
    if (src[j] === '>') return { name, attrs, end: j + 1, selfClose: false };
    if (src[j] === '/' && src[j + 1] === '>') return { name, attrs, end: j + 2, selfClose: true };
    if (src[j] === '/') { j++; continue; }
    const a = /^[^\s=/>]+/.exec(src.slice(j, j + 256));
    if (!a) return null;
    const attr = { name: a[0].toLowerCase(), value: '', nameStart: j, vStart: -1, vEnd: -1, quote: '' };
    j += a[0].length;
    let k = j; while (k < src.length && /\s/.test(src[k])) k++;
    if (src[k] === '=') {
      k++; while (k < src.length && /\s/.test(src[k])) k++;
      const q = src[k];
      if (q === '"' || q === "'") {
        const e = src.indexOf(q, k + 1);
        if (e < 0) return null;
        attr.quote = q; attr.vStart = k + 1; attr.vEnd = e; j = e + 1;
      } else {
        const u = /^[^\s>]+/.exec(src.slice(k, k + 4096));
        attr.vStart = k; attr.vEnd = k + (u ? u[0].length : 0); j = attr.vEnd;
      }
      attr.value = decode(src.slice(attr.vStart, attr.vEnd));
    }
    attr.end = j;
    attrs.push(attr);
  }
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', times: '×', middot: '·', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', rarr: '→', larr: '←', minus: '−', deg: '°', plusmn: '±', le: '≤', ge: '≥' };
export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isFinite(c) ? String.fromCodePoint(c) : m; }
    return Object.prototype.hasOwnProperty.call(ENT, e.toLowerCase()) ? ENT[e.toLowerCase()] : m;
  });
}

/* scan(src) returns { els, errors }. Each element:
   name, start (the "<"), startEnd (after ">"), innerStart, innerEnd, end, parent (index or -1),
   attrs, svg (inside an <svg>), self (void or self-closing). Elements are in document order. */
export function scan(src) {
  const els = [], errors = [], stack = [];
  let i = 0;
  const top = () => stack.length ? els[stack[stack.length - 1]] : null;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) break;
    if (src.startsWith('<!--', lt)) {
      const e = src.indexOf('-->', lt + 4);
      if (e < 0) { errors.push({ at: lt, msg: 'a comment is never closed with -->' }); break; }
      i = e + 3; continue;
    }
    if (src[lt + 1] === '!' || src[lt + 1] === '?') { const e = src.indexOf('>', lt); i = e < 0 ? src.length : e + 1; continue; }
    if (src[lt + 1] === '/') {
      const m = /^<\/([a-zA-Z][^\s/>]*)\s*>/.exec(src.slice(lt, lt + 80));
      if (!m) { i = lt + 1; continue; }
      const name = m[1].toLowerCase();
      let k = stack.length - 1;
      while (k >= 0 && els[stack[k]].name !== name) k--;
      if (k < 0) { errors.push({ at: lt, msg: `</${name}> closes nothing` }); i = lt + m[0].length; continue; }
      if (k !== stack.length - 1) errors.push({ at: lt, msg: `<${top().name}> is still open at </${name}>` });
      while (stack.length - 1 > k) { const el = els[stack.pop()]; el.innerEnd = el.end = lt; }
      const el = els[stack.pop()];
      el.innerEnd = lt; el.end = lt + m[0].length;
      i = el.end; continue;
    }
    const t = readTag(src, lt);
    if (!t) { i = lt + 1; continue; }
    const parent = top();
    const svg = !!parent && (parent.svg || parent.name === 'svg');
    if (parent && parent.name === 'p' && !svg && CLOSES_P.has(t.name)) errors.push({ at: lt, msg: `<${t.name}> inside <p>. The browser ends the <p> here, so close it first` });
    if (parent && parent.name === 'li' && t.name === 'li') errors.push({ at: lt, msg: '<li> inside <li>. Close the first one with </li>' });
    const el = { name: t.name, start: lt, startEnd: t.end, innerStart: t.end, innerEnd: t.end, end: t.end, parent: stack.length ? stack[stack.length - 1] : -1, attrs: t.attrs, svg, self: false };
    for (const a of t.attrs) { if (a.name === 'id') el.id = a.value; if (a.name === 'class') el.cls = a.value; }
    const idx = els.push(el) - 1;
    if (VOID.has(t.name) || (t.selfClose && (svg || t.name === 'svg'))) { el.self = true; i = t.end; continue; }
    if (RAW.has(t.name)) {
      const re = new RegExp('</' + t.name + '\\s*>', 'ig'); re.lastIndex = t.end;
      const m = re.exec(src);
      if (!m) { errors.push({ at: lt, msg: `<${t.name}> is never closed` }); break; }
      el.innerEnd = m.index; el.end = m.index + m[0].length; i = el.end; continue;
    }
    stack.push(idx);
    i = t.end;
  }
  while (stack.length) { const el = els[stack.pop()]; errors.push({ at: el.start, msg: `<${el.name}> is never closed` }); el.innerEnd = el.end = src.length; }
  return { els, errors };
}

/* The elements inside #stage, in order. data-si on the live page is an index into this list.
   Each entry gets "sec", the 0-based slide number it belongs to (or -1 outside slides). */
export function stageMap(src) {
  const { els, errors } = scan(src);
  const s = els.findIndex(e => e.id === 'stage');
  if (s < 0) return { list: [], errors: errors.concat([{ at: 0, msg: 'no element with id="stage"' }]) };
  const list = [];
  let sec = -1;
  for (let k = s + 1; k < els.length && els[k].start < els[s].end; k++) {
    const el = els[k];
    if (el.parent === s) sec = el.name === 'section' ? sec + 1 : sec;
    let p = el, top = el;
    while (p && p.parent !== s && p.parent >= 0) { p = els[p.parent]; top = p; }
    el.sec = top.name === 'section' && /\bdk\b/.test(top.cls || '') ? sec : -1;
    el.si = list.push(el) - 1;
  }
  return { list, errors };
}

export function range(el, kind) { return kind === 'tag' ? [el.start, el.startEnd] : [el.innerStart, el.innerEnd]; }

/* Change one attribute inside a start tag such as <i style="--v:48">, keeping everything else as written. */
export function setAttr(tag, name, value) {
  const t = readTag(tag, 0);
  if (!t) return tag;
  const v = String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const a = t.attrs.find(x => x.name === name);
  if (a && a.vStart >= 0) return tag.slice(0, a.vStart) + (a.quote ? v : '"' + v + '"') + tag.slice(a.vEnd);
  if (a) return tag.slice(0, a.end) + '="' + v + '"' + tag.slice(a.end);
  const at = tag.endsWith('/>') ? tag.length - 2 : tag.length - 1;
  return tag.slice(0, at).replace(/\s*$/, '') + ' ' + name + '="' + v + '"' + tag.slice(at);
}
export function getAttr(tag, name) { const t = readTag(tag, 0); const a = t && t.attrs.find(x => x.name === name); return a ? a.value : null; }

// Set one custom property such as --v inside a style attribute value, leaving the other declarations alone.
export function setStyleProp(style, prop, value) {
  const re = new RegExp('(^|;)(\\s*)' + prop.replace(/[-]/g, '\\-') + '\\s*:[^;]*');
  if (re.test(style)) return style.replace(re, (m, a, b) => a + b + prop + ':' + value);
  return (style ? style.replace(/;?\s*$/, ';') : '') + prop + ':' + value;
}
export function getStyleProp(style, prop) {
  const m = new RegExp('(?:^|;)\\s*' + prop.replace(/[-]/g, '\\-') + '\\s*:([^;]*)').exec(style || '');
  return m ? m[1].trim() : null;
}

/* Rules for new content. Editors are trusted collaborators, so this only stops pasted script or
   markup that would break the page. */
const BANNED = /<\s*\/?\s*(script|style|iframe|object|embed|link|meta|base|form|input|section|html|head|body)\b|\son[a-z]+\s*=|javascript:/i;
export function checkFragment(html, kind, name) {
  if (BANNED.test(html)) return 'contains markup that is not allowed on a slide';
  if (kind === 'tag') {
    const t = readTag(html, 0);
    if (!t || t.end !== html.length || t.name !== name) return 'is not a single <' + name + '> start tag';
    return null;
  }
  const { errors } = scan('<div>' + html + '</div>');
  return errors.length ? 'has unbalanced tags (' + errors[0].msg + ')' : null;
}

/* Apply edits to index.html. Each op is { kind: 'inner' | 'tag', si, name, old, new, slide }.
   "old" is the exact text the editor started from. If the element at "si" no longer holds that text,
   the edit is matched to the one element that does. Otherwise it is reported as a conflict. */
export function applyHtmlOps(src, ops) {
  const { list, errors } = stageMap(src);
  if (errors.length) return { out: src, conflicts: [], error: 'index.html cannot be read: ' + errors[0].msg + ' (line ' + lineOf(src, errors[0].at) + ')' };
  const edits = [], conflicts = [];
  for (const op of ops) {
    if (op.kind !== 'inner' && op.kind !== 'tag') return { out: src, conflicts, error: 'unknown edit kind' };
    const bad = checkFragment(op.new, op.kind, op.name);
    if (bad) return { out: src, conflicts, error: 'The edit on slide ' + op.slide + ' ' + bad };
    let el = list[op.si];
    const holds = e => e && e.name === op.name && src.slice(...range(e, op.kind)) === op.old;
    if (!holds(el)) {
      const c = list.filter(holds);
      el = c.length === 1 ? c[0] : null;
    }
    if (!el) { conflicts.push({ slide: op.slide, si: op.si, text: textOf(op.old) }); continue; }
    const [a, b] = range(el, op.kind);
    edits.push({ a, b, text: op.new, slide: op.slide });
  }
  edits.sort((x, y) => x.a - y.a);
  for (let k = 1; k < edits.length; k++) if (edits[k].a < edits[k - 1].b) return { out: src, conflicts, error: 'two edits overlap on slide ' + edits[k].slide };
  let out = src;
  for (let k = edits.length - 1; k >= 0; k--) out = out.slice(0, edits[k].a) + edits[k].text + out.slice(edits[k].b);
  const after = stageMap(out);
  if (after.errors.length) return { out: src, conflicts, error: 'the edited page would not be valid: ' + after.errors[0].msg };
  return { out, conflicts, error: null };
}

export function textOf(html) { return decode(String(html).replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(); }

/* ---- DECK_DATA in deck.js ---- */
export function dataBlock(js) {
  const s = js.indexOf('var DECK_DATA = {');
  if (s < 0) return null;
  const e = js.indexOf('\n};', s);
  return e < 0 ? null : { start: s, end: e + 3, text: js.slice(s, e + 3) };
}
// numeric literals in source order, skipping comments and strings
export function dataNumbers(block) {
  const out = [];
  let i = 0;
  while (i < block.length) {
    const c = block[i];
    if (c === '/' && block[i + 1] === '/') { const e = block.indexOf('\n', i); i = e < 0 ? block.length : e; continue; }
    if (c === '/' && block[i + 1] === '*') { const e = block.indexOf('*/', i + 2); i = e < 0 ? block.length : e + 2; continue; }
    if (c === "'" || c === '"' || c === '`') { let j = i + 1; while (j < block.length && block[j] !== c) j += block[j] === '\\' ? 2 : 1; i = j + 1; continue; }
    if (/[A-Za-z_$]/.test(c)) { const m = /^[\w$]+/.exec(block.slice(i)); i += m[0].length; continue; }
    const m = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(block.slice(i));
    if (m && /[\d.]/.test(c === '-' ? block[i + 1] : c)) { out.push({ start: i, end: i + m[0].length, text: m[0] }); i += m[0].length; continue; }
    i++;
  }
  return out;
}
export function replaceNumbers(block, values) {
  const nums = dataNumbers(block);
  let out = block;
  for (let k = nums.length - 1; k >= 0; k--) if (values[k] != null && String(values[k]) !== nums[k].text) out = out.slice(0, nums[k].start) + values[k] + out.slice(nums[k].end);
  return out;
}
const skeleton = b => { let s = b; const n = dataNumbers(b); for (let k = n.length - 1; k >= 0; k--) s = s.slice(0, n[k].start) + '#' + s.slice(n[k].end); return s; };
export function applyDataOp(js, op) {
  const cur = dataBlock(js);
  if (!cur) return { out: js, error: 'deck.js has no DECK_DATA block' };
  if (skeleton(op.new) !== skeleton(op.old)) return { out: js, error: 'a chart edit may only change numbers' };
  if (!dataNumbers(op.new).every(n => isFinite(+n.text))) return { out: js, error: 'a chart value is not a number' };
  if (cur.text !== op.old) return { out: js, conflict: true, error: 'Someone changed the chart numbers since you opened the page' };
  return { out: js.slice(0, cur.start) + op.new + js.slice(cur.end), error: null };
}
