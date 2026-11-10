/* Deck behaviour: slide navigation, the phone reading layout, counters and the charts.
   To change words on a slide, edit index.html. To change a chart's numbers, edit DECK_DATA below. */

/* ===================== CHART DATA =====================
   Every value comes from the Durham repository (bobby-ta/cluster-challenge-durham).
   If you change a number here, change the matching text on the slide and its source line too. */
var DECK_DATA = {
  // Roofline.
  // P  = measured FP32 ceiling in GFLOP/s (likwid-bench peakflops_sp)
  // B  = measured memory bandwidth in GB/s (likwid-bench triad_mem)
  // ai = Grid FLOPs per byte, g = Grid GFLOP/s, both from likwid-perfctr at full node
  roofline: [
    { n: 'DINE',  P: 3341, B: 230.6, ai: 1.574, g: 259.3, c: 'var(--accent)' },
    { n: 'DINE2', P: 9287, B: 397.9, ai: 2.077, g: 505.9, c: 'var(--ai)' }
  ],
  // Strong scaling at L = 32. Each pair is [threads, speed-up over 1 thread].
  scaling: [
    { n: 'DINE',  c: 'var(--accent)', a: 'middle', p: [[1, 1], [2, 1.734], [4, 2.573], [8, 5.492], [16, 10.228], [24, 13.453], [32, 17.198]] },
    { n: 'DINE2', c: 'var(--ai)',     a: 'end',    p: [[1, 1], [2, 1.905], [4, 3.589], [8, 6.36], [16, 10.248], [24, 10.709], [32, 13.173], [48, 17.141], [64, 21.422]] }
  ]
};
/* ====================================================== */

(function () {
  var root = document.documentElement;
  var stage = document.getElementById('stage'), slides = [].slice.call(stage.querySelectorAll('.dk')), cur = -1;
  var bar = document.getElementById('bar'), counter = document.getElementById('count');
  // The talk is every slide without data-backup. Backup slides come after it and are for questions.
  var talk = slides.filter(function (s) { return !s.hasAttribute('data-backup'); });
  var backup = slides.filter(function (s) { return s.hasAttribute('data-backup'); });
  if (backup[0]) backup[0].classList.add('bk-first');
  // A slide's script is its note text outside any .bg (background for questions). Timing assumes 140 words a minute,
  // and counts a number as 2.5 words because "2.15" or "64%" takes longer to say than one word.
  var WPM = 140, LIMIT = 300;
  function scriptOf(a) { if (!a) return ''; var c = a.cloneNode(true); [].forEach.call(c.querySelectorAll('.bg'), function (b) { b.parentNode.removeChild(b); }); return c.textContent.replace(/\s+/g, ' ').trim(); }
  function secs(a) { var t = scriptOf(a), w = 0; if (!t) return 0; t.split(' ').forEach(function (x) { w += /\d/.test(x) ? 2.5 : 1; }); return w / WPM * 60; }
  function clock(v) { v = Math.round(v); return Math.floor(v / 60) + ':' + ('0' + v % 60).slice(-2); }
  // Timing for the whole talk. noteOf lets the page editor pass the notes it has moved into its toolbar.
  function timing(noteOf) {
    var rows = talk.map(function (s) { return secs(noteOf ? noteOf(s) : s.querySelector('.notes')); }), total = 0, ends = rows.map(function (v) { total += v; return total; });
    return { rows: rows, ends: ends, total: total, limit: LIMIT, wpm: WPM };
  }
  function timeLine(s, noteOf) {
    var k = talk.indexOf(s);
    if (k < 0) return 'Backup slide · for questions, not timed';
    var t = timing(noteOf);
    return 'Slide ' + (k + 1) + ' of ' + talk.length + ' · about ' + Math.round(t.rows[k]) + ' s · ends at ' + clock(t.ends[k]) + ' · whole talk ' + clock(t.total) + ' of ' + clock(LIMIT);
  }
  var NS = 'http://www.w3.org/2000/svg';
  var forced = (/[?&]mode=(read|slides)\b/.exec(location.search) || [])[1];
  // ?edit opens the page editor (edit/edit.mjs). Each element is numbered before anything below changes the page,
  // so the editor can find it again in index.html.
  var EDIT = /[?&]edit\b/.test(location.search);
  if (EDIT) { root.classList.add('editing'); [].forEach.call(stage.querySelectorAll('*'), function (e, i) { e.setAttribute('data-si', i); }); }
  var still = EDIT || /[?&]static\b/.test(location.search);
  if (still) root.classList.add('static');
  // phones (and any window under 600 px on its short side) get a scrolling reading layout; tablets and desktops get slides
  function wantRead() { return forced ? forced === 'read' : Math.min(innerWidth, innerHeight) < 600; }
  var READ = root.classList.contains('read');
  function vw() { return window.visualViewport ? visualViewport.width : innerWidth; }
  function vh() { return window.visualViewport ? visualViewport.height : innerHeight; }
  // the editor's toolbar takes --ed-bottom pixels at the bottom of the window
  function dockH() { return EDIT ? parseFloat(getComputedStyle(root).getPropertyValue('--ed-bottom')) || 0 : 0; }
  function fit() { if (!READ) stage.style.setProperty('--s', Math.min(vw() / 1920, (vh() - dockH()) / 1080)); }
  function typing(t) { return !!(t && t.closest && t.closest('[contenteditable="true"], input, textarea, select, .ed-dock, .ed-modal')); }
  function hashN() { return parseInt(location.hash.slice(1), 10) || 1; }
  function E(tag, attrs, parent, text) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; }
  function fmt(v, d) { return v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }); }

  slides.forEach(function (s) {
    s.querySelectorAll('.rise').forEach(function (r, i) { r.style.setProperty('--ri', i); });
    // speaker notes become an expandable block in the reading layout
    var a = s.querySelector('.notes');
    if (a && !EDIT) {
      var d = document.createElement('details'), c = a.cloneNode(true), bg = c.querySelector('.bg'), k = talk.indexOf(s);
      if (bg) c.removeChild(bg);
      d.className = 'rnotes';
      d.innerHTML = '<summary>' + (k < 0 ? 'Notes' : 'Script · about ' + Math.round(secs(a)) + ' s') + '</summary>' + (c.innerHTML.trim() ? '<p>' + c.innerHTML + '</p>' : '') + (bg ? '<p class="bg">' + bg.innerHTML + '</p>' : '');
      s.appendChild(d);
    }
  });

  // core maps: 24 chiplets (columns) of 12 cores; "half" lights one core of each pair
  stage.querySelectorAll('.cores').forEach(function (g) {
    var half = g.getAttribute('data-pattern') === 'half', html = '';
    for (var i = 0; i < 288; i++) html += '<i class="' + (!half || i % 2 === 0 ? 'lit' : '') + '" style="--c:' + i + '"></i>';
    g.innerHTML = html;
  });

  // roofline: log-log, measured roofs, Grid's whole-process points. Narrow screens get a narrower drawing with shorter labels.
  function roofline(svg, narrow) {
    if (!svg) return;
    svg.textContent = '';
    var W = narrow ? 640 : 1000, H = narrow ? 560 : 640;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var L = narrow ? 86 : 110, R = W - (narrow ? 28 : 40), T = 30, B = H - 100, ymax = Math.log10(20000);
    function x(v) { return L + (Math.log10(v) + 1) / 3 * (R - L); }
    function y(v) { return B - (Math.log10(v) - 1) / (ymax - 1) * (B - T); }
    [0.1, 1, 10, 100].forEach(function (v) { E('line', { x1: x(v), x2: x(v), y1: T, y2: B, class: 'gl' }, svg); E('text', { x: x(v), y: B + 38, class: 'ax', 'text-anchor': 'middle' }, svg, String(v)); });
    [10, 100, 1000, 10000].forEach(function (v) { E('line', { x1: L, x2: R, y1: y(v), y2: y(v), class: 'gl' }, svg); E('text', { x: L - 16, y: y(v) + 8, class: 'ax', 'text-anchor': 'end' }, svg, v >= 1000 ? (v / 1000) + 'k' : String(v)); });
    E('text', { x: (L + R) / 2, y: B + 82, class: 'axt', 'text-anchor': 'middle' }, svg, 'FLOPs per byte moved from memory (log scale)');
    E('text', { x: -(T + B) / 2, y: 26, class: 'axt', 'text-anchor': 'middle', transform: 'rotate(-90)' }, svg, 'GFLOP/s, single precision (log scale)');
    var nodes = DECK_DATA.roofline;
    nodes.forEach(function (n, i) {
      var ridge = n.P / n.B;
      E('line', { x1: x(ridge), x2: x(ridge), y1: y(n.P), y2: B, class: 'ridge', style: 'stroke:' + n.c }, svg);
      E('text', { x: x(ridge) + 10, y: B - 16 - i * 30, class: 'rl', style: 'fill:' + n.c }, svg, 'ridge ' + ridge.toFixed(1));
      E('path', { d: 'M' + x(0.1) + ' ' + y(n.B * 0.1) + ' L' + x(ridge) + ' ' + y(n.P) + ' L' + x(100) + ' ' + y(n.P), class: 'ln', style: 'stroke:' + n.c + ';--k:' + (i * 0.3) + 's' }, svg);
    });
    // roof labels go on after every line, so no line runs through the text
    nodes.forEach(function (n, i) {
      E('text', { x: R - 4, y: y(n.P) + (i ? -16 : 34), class: 'rl', 'text-anchor': 'end', style: 'fill:' + n.c }, svg, n.n + ' roof');
    });
    nodes.forEach(function (n, i) {
      var g = E('g', { class: 'pt', style: '--k:' + (i * 0.25) + 's' }, svg);
      E('circle', { cx: x(n.ai), cy: y(n.g), r: 12, style: 'fill:' + n.c }, g);
      E('circle', { cx: x(n.ai), cy: y(n.g), r: 22, style: 'fill:none;stroke-width:2;opacity:.45;stroke:' + n.c }, g);
      // legend in the empty top-left corner, so labels never sit on the roof lines
      E('circle', { cx: L + 36, cy: T + 34 + i * 42, r: 10, style: 'fill:' + n.c }, g);
      E('text', { x: L + 58, y: T + 42 + i * 42, class: 'pl' }, g, 'Grid on ' + n.n);
    });
  }

  // strong scaling: speedup vs threads at L = 32, ideal diagonal
  function scaling(svg, narrow) {
    if (!svg) return;
    svg.textContent = '';
    var W = narrow ? 640 : 1000, H = narrow ? 540 : 620;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var L = narrow ? 86 : 100, R = W - 40, T = 30, B = H - 100;
    function x(t) { return L + t / 64 * (R - L); }
    function y(s) { return B - s / 64 * (B - T); }
    [0, 16, 32, 48, 64].forEach(function (v) {
      E('line', { x1: x(v), x2: x(v), y1: T, y2: B, class: 'gl' }, svg); E('text', { x: x(v), y: B + 38, class: 'ax', 'text-anchor': 'middle' }, svg, String(v));
      E('line', { x1: L, x2: R, y1: y(v), y2: y(v), class: 'gl' }, svg); E('text', { x: L - 16, y: y(v) + 8, class: 'ax', 'text-anchor': 'end' }, svg, v + '×');
    });
    E('text', { x: (L + R) / 2, y: B + 82, class: 'axt', 'text-anchor': 'middle' }, svg, 'OpenMP threads (physical cores)');
    E('text', { x: -(T + B) / 2, y: 26, class: 'axt', 'text-anchor': 'middle', transform: 'rotate(-90)' }, svg, 'Speed-up over 1 thread');
    E('path', { d: 'M' + x(1) + ' ' + y(1) + ' L' + x(64) + ' ' + y(64), class: 'ideal' }, svg);
    E('text', { x: x(44) + 14, y: y(44) + 8, class: 'axt' }, svg, 'ideal');
    var series = DECK_DATA.scaling;
    series.forEach(function (s, i) {
      E('path', { d: s.p.map(function (q, j) { return (j ? 'L' : 'M') + x(q[0]) + ' ' + y(q[1]); }).join(' '), class: 'ln', style: 'stroke:' + s.c + ';--k:' + (i * 0.3) + 's' }, svg);
      var g = E('g', { class: 'pt', style: '--k:' + (i * 0.25) + 's' }, svg);
      s.p.forEach(function (q) { E('circle', { cx: x(q[0]), cy: y(q[1]), r: 6, style: 'fill:' + s.c }, g); });
      var e = s.p[s.p.length - 1];
      E('text', { x: x(e[0]), y: y(e[1]) - 28, class: 'pl', 'text-anchor': s.a }, g, s.n);
    });
  }

  // sockets: 2 sockets × 32 cores; DINE2 numbers socket 0 even, socket 1 odd. Threads 0–7 and their neighbour links.
  // Wide screens draw each socket as 8 columns × 4 rows; narrow screens use 4 × 8 so both sockets still fit side by side.
  function sockets(svg, narrow) {
    svg.textContent = '';
    var ordered = svg.getAttribute('data-mode') === 'ordered', cw = 44, gap = 8, pad = 20, cols = narrow ? 4 : 8, rows = 32 / cols;
    var sw = cols * cw + (cols - 1) * gap + 2 * pad, sh = rows * cw + (rows - 1) * gap + 2 * pad, sg = 36, head = 34;
    function origin(s) { return { x: s * (sw + sg), y: 0 }; }
    svg.setAttribute('viewBox', '0 0 ' + (2 * sw + sg) + ' ' + (head + sh + 4));
    function pos(s, j) { var o = origin(s); return { x: o.x + pad + (j % cols) * (cw + gap), y: o.y + head + pad + Math.floor(j / cols) * (cw + gap) }; }
    var thread = {};
    for (var k = 0; k < 8; k++) { var s = ordered ? 0 : k % 2, j = ordered ? k : Math.floor(k / 2); thread[s + ':' + j] = k; }
    for (var s2 = 0; s2 < 2; s2++) {
      var o = origin(s2);
      E('rect', { x: o.x, y: o.y + head, width: sw, height: sh, rx: 18, class: 's' }, svg);
      E('text', { x: o.x + 4, y: o.y + 20, class: 'sl' }, svg, 'SOCKET ' + s2);
      for (var j2 = 0; j2 < 32; j2++) {
        var p = pos(s2, j2), t = thread[s2 + ':' + j2];
        E('rect', { x: p.x, y: p.y, width: cw, height: cw, rx: 8, class: 'c' + (t != null ? ' t' : '') }, svg);
        if (t == null) E('text', { x: p.x + cw / 2, y: p.y + cw / 2 + 5, 'text-anchor': 'middle', class: 'cn' }, svg, String(2 * j2 + s2));
      }
    }
    // link each thread to the next: a short step when they share a socket, an arc over to the other socket when they don't
    var d = '', prev = null;
    for (var k2 = 0; k2 < 8; k2++) {
      var s3 = ordered ? 0 : k2 % 2, j3 = ordered ? k2 : Math.floor(k2 / 2), q = pos(s3, j3), cx = q.x + cw / 2, cy = q.y + cw / 2;
      if (!prev) d = 'M' + cx + ' ' + cy;
      else if (ordered) d += ' L' + cx + ' ' + cy;
      else d += ' Q' + ((prev.x + cx) / 2) + ' ' + (cy + 90 + k2 * 10) + ' ' + cx + ' ' + cy;
      prev = { x: cx, y: cy };
    }
    E('path', { d: d, class: 'link' }, svg);
    // thread cells and labels go on top of the line so they stay readable
    for (var k3 = 0; k3 < 8; k3++) {
      var s4 = ordered ? 0 : k3 % 2, j4 = ordered ? k3 : Math.floor(k3 / 2), r = pos(s4, j4);
      E('rect', { x: r.x, y: r.y, width: cw, height: cw, rx: 8, class: 'c t' }, svg);
      E('text', { x: r.x + cw / 2, y: r.y + cw / 2 + 6, 'text-anchor': 'middle', class: 'tn' }, svg, 'T' + k3);
    }
  }

  // line drawing uses each path's real length in user units, which Safari handles the same as Chrome
  function measure(svg) {
    svg.querySelectorAll('.ln, .link').forEach(function (p) {
      var len = 0; try { len = p.getTotalLength(); } catch (e) {}
      p.style.setProperty('--len', String(Math.ceil(len) + 2 || 1));
    });
  }
  function drawCharts() {
    roofline(document.getElementById('roofline'), READ);
    scaling(document.getElementById('scaling'), READ);
    stage.querySelectorAll('svg.sock').forEach(function (svg) { sockets(svg, READ); });
    stage.querySelectorAll('svg.chart').forEach(measure);
  }

  function count(el) {
    if (still) return;
    var a = +el.getAttribute('data-from'), b = +el.getAttribute('data-to'), d = +(el.getAttribute('data-dec') || 0), t0 = null;
    // timer-driven (not requestAnimationFrame) so the number always lands, even in a background tab or a capture
    clearInterval(el._t); el.textContent = fmt(a, d);
    setTimeout(function () { t0 = Date.now(); el._t = setInterval(function () { var p = Math.min(1, (Date.now() - t0) / 1000); el.textContent = fmt(a + (b - a) * (1 - Math.pow(1 - p, 3)), d); if (p >= 1) clearInterval(el._t); }, 16); }, 650);
  }
  function finalCounts() { stage.querySelectorAll('[data-count]').forEach(function (el) { clearInterval(el._t); el.textContent = fmt(+el.getAttribute('data-to'), +(el.getAttribute('data-dec') || 0)); }); }
  function playRelay(s) {
    s.querySelectorAll('.relay').forEach(function (r) {
      ['.rl-node', '.rl-row > .ag'].forEach(function (q) { r.querySelectorAll(q).forEach(function (el, i) { el.style.setProperty('--d', i * 2 + 's'); }); });
      r.classList.add('play');
    });
  }
  function activate(s) { if (s.classList.contains('on')) return; s.classList.add('on'); s.querySelectorAll('[data-count]').forEach(count); playRelay(s); }

  var chap = document.getElementById('chap'), notes = document.getElementById('notes');
  // Presenter view: P opens presenter.html in its own window. This window sends it the current slide's script and timing
  // and follows its next and back, so in a call only this window needs sharing and the script stays private.
  var chan = !EDIT && 'BroadcastChannel' in window ? new BroadcastChannel('ucluster-deck') : null;
  function headOf(s) { var h = s && s.querySelector('h1, h2'); return h ? h.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function tell() {
    if (!chan || cur < 0) return;
    var s = slides[cur], a = s.querySelector('.notes'), c = a ? a.cloneNode(true) : null, bg = c && c.querySelector('.bg'), k = talk.indexOf(s), t = timing();
    if (bg) c.removeChild(bg);
    chan.postMessage({ type: 'state', n: cur, k: k, talk: talk.length, label: counter.textContent, title: headOf(s), next: headOf(slides[cur + 1]),
      script: c ? c.innerHTML : '', bg: bg ? bg.innerHTML : '', secs: k < 0 ? 0 : t.rows[k], ends: k < 0 ? 0 : t.ends[k], total: t.total, limit: t.limit });
  }
  if (chan) chan.onmessage = function (e) { var m = e.data || {}; if (m.type === 'go') go(m.n); else if (m.type === 'step') go(cur + m.d); else if (m.type === 'hello') tell(); };
  function showNotes() { var a = slides[cur].querySelector('.notes'); notes.innerHTML = '<b>' + timeLine(slides[cur]) + '</b>' + (a ? a.innerHTML : 'No notes for this slide.'); }
  function go(n) {
    if (READ) return;
    n = Math.max(0, Math.min(slides.length - 1, n)); if (n === cur) return;
    if (cur >= 0) { slides[cur].classList.remove('on'); slides[cur].querySelectorAll('.relay').forEach(function (r) { r.classList.remove('play'); }); }
    cur = n; var s = slides[n];
    void s.offsetWidth; s.classList.add('on');
    s.querySelectorAll('[data-count]').forEach(count);
    playRelay(s);
    var rd = +(s.getAttribute('data-round') || 0);
    chap.classList.toggle('show', rd > 0 && !s.querySelector('.rtag'));
    chap.querySelectorAll('span').forEach(function (sp) { var r = +sp.getAttribute('data-r'); sp.classList.toggle('on', r === rd); sp.classList.toggle('done', r < rd); });
    var k = talk.indexOf(s);
    bar.style.setProperty('--p', k < 0 ? 1 : (k + 1) / talk.length);
    counter.textContent = k < 0 ? 'Backup ' + (backup.indexOf(s) + 1) + ' / ' + backup.length : (k + 1) + ' / ' + talk.length;
    if (!notes.hidden) showNotes();
    history.replaceState(null, '', '#' + (n + 1));
    if (window.DECK && DECK.onchange) DECK.onchange(n);
    tell();
  }

  var io = null;
  function setMode(read) {
    READ = read;
    root.classList.toggle('read', read); root.classList.toggle('slides', !read);
    if (io) { io.disconnect(); io = null; }
    slides.forEach(function (s) { s.classList.remove('on'); s.querySelectorAll('.relay').forEach(function (r) { r.classList.remove('play'); }); });
    drawCharts();
    if (read) {
      notes.hidden = true;
      stage.style.removeProperty('--s');
      if (still || !('IntersectionObserver' in window)) slides.forEach(activate);
      else {
        io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { activate(e.target); io.unobserve(e.target); } }); }, { threshold: 0.08 });
        slides.forEach(function (s) { io.observe(s); });
      }
      onScroll();
    } else {
      var c = cur; cur = -1; fit(); go(c >= 0 ? c : hashN() - 1);
    }
    if (window.DECK && DECK.onmode) DECK.onmode(read);
  }
  function onScroll() { if (!READ) return; var h = root.scrollHeight - innerHeight; bar.style.setProperty('--p', h > 0 ? Math.min(1, scrollY / h) : 0); }
  addEventListener('scroll', onScroll, { passive: true });

  var rt;
  function onResize() { fit(); clearTimeout(rt); rt = setTimeout(function () { var r = wantRead(); if (r !== READ) setMode(r); else fit(); }, 150); }
  addEventListener('resize', onResize);
  addEventListener('orientationchange', onResize);
  if (window.visualViewport) visualViewport.addEventListener('resize', fit);

  // full screen, including the webkit-prefixed API used by Safari on iPad; iPhone Safari has none, so the key does nothing there
  function toggleFull() {
    var d = document, el = root;
    if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) { var r = req.call(el); if (r && r.catch) r.catch(function () {}); }
  }
  addEventListener('keydown', function (e) {
    if (READ || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (EDIT && (e.key === 'n' || e.key === 'N' || e.key === 'Backspace')) return;
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].indexOf(e.key) >= 0) { e.preventDefault(); go(cur + 1); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].indexOf(e.key) >= 0) { e.preventDefault(); go(cur - 1); }
    else if (e.key === 'Home') go(0); else if (e.key === 'End') go(slides.length - 1);
    else if (e.key === 'n' || e.key === 'N') { notes.hidden = !notes.hidden; if (!notes.hidden) showNotes(); }
    else if (e.key === 'f' || e.key === 'F') toggleFull();
    else if ((e.key === 'p' || e.key === 'P') && chan) window.open('presenter.html', 'ucluster-presenter', 'popup,width=980,height=760');
  });
  // touch: swipe left or right to change slide; a tap on either half still works
  var tx = null, ty = 0, swipedAt = 0;
  addEventListener('touchstart', function (e) { if (READ || e.touches.length !== 1 || typing(e.target)) { tx = null; return; } tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchend', function (e) {
    if (READ || tx === null) return;
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) { swipedAt = Date.now(); go(cur + (dx < 0 ? 1 : -1)); }
  }, { passive: true });
  addEventListener('click', function (e) {
    if (READ || EDIT || Date.now() - swipedAt < 500 || e.target.closest('a, button, summary, .notes-ov')) return;
    go(cur + (e.clientX > innerWidth / 2 ? 1 : -1));
  });
  addEventListener('hashchange', function () { var h = hashN(); if (READ) { if (slides[h - 1]) slides[h - 1].scrollIntoView(); } else go(h - 1); });

  var printedFromRead = false;
  addEventListener('beforeprint', function () {
    printedFromRead = READ; if (READ) setMode(false);
    slides.forEach(function (s) { s.classList.add('on'); });
    finalCounts();
  });
  addEventListener('afterprint', function () { if (printedFromRead) setMode(true); });

  // what the page editor needs from the deck
  window.DECK = { slides: slides, talk: talk, timing: timing, timeLine: timeLine, clock: clock, go: go, fit: fit, redraw: drawCharts,
    cur: function () { return cur; }, read: function () { return READ; }, onchange: null, onmode: null };

  setMode(READ);
  if (READ && hashN() > 1 && slides[hashN() - 1]) slides[hashN() - 1].scrollIntoView();

  if (EDIT) import('./edit/edit.mjs').catch(function (err) {
    var m = document.createElement('div'); m.className = 'ed-fail';
    m.textContent = 'The editor did not load (' + (err && err.message || err) + '). Reload the page to try again.';
    document.body.appendChild(m);
  });
})();
