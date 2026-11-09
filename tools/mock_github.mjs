/* A stand-in for the small part of GitHub the page editor uses: sign-in, branches, commits, pull requests,
   the check run, Vercel's status and preview comment. Only tools/test_editor.py uses it. It starts from the
   files in this folder and keeps everything in memory.

   MOCK_PORT        port to listen on
   MOCK_RUN_CHECK=1 run the real tools/check.py on each pull request (slower, about a minute)
   Test hooks: GET /__mock/main returns main's files, POST /__mock/edit-main {path, find, replace} changes main. */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.MOCK_PORT || 3901);
const REPO = process.env.DECK_REPO || 'kaihuang1425/ucluster-too-qualifier';
const LOGIN = process.env.MOCK_LOGIN || 'teammate';
const RUN_CHECK = process.env.MOCK_RUN_CHECK === '1';
const TRACKED = ['index.html', 'deck.js'];

const objects = new Map(), refs = new Map(), pulls = new Map(), runs = new Map(), statusPolls = new Map();
let prNo = 0, runNo = 1000;
const id = () => crypto.randomBytes(20).toString('hex');
function store(obj) { const k = id(); objects.set(k, obj); return k; }
function treeOf(commitSha) { const c = objects.get(commitSha); return c ? objects.get(c.tree).files : null; }

// first commit: the tracked files as they are on disk
const files0 = {}; TRACKED.forEach(p => { files0[p] = fs.readFileSync(path.join(ROOT, p), 'utf8'); });
refs.set('main', store({ type: 'commit', tree: store({ type: 'tree', files: files0 }), parents: [], message: 'start' }));

function startCheck(sha) {
  const run = { id: ++runNo, name: 'check', status: 'queued', conclusion: null, html_url: 'https://github.com/' + REPO + '/actions/runs/' + runNo, annotations: [], polls: 0 };
  runs.set(sha, run);
  if (!RUN_CHECK) return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-check-'));
  fs.cpSync(ROOT, dir, { recursive: true, filter: s => !/[\\/](\.git|node_modules|__pycache__|\.vercel)([\\/]|$)/.test(s) });
  for (const [p, text] of Object.entries(treeOf(sha))) fs.writeFileSync(path.join(dir, p), text);
  run.status = 'in_progress';
  const py = spawn(process.env.MOCK_PYTHON || 'python', ['tools/check.py'], { cwd: dir, env: Object.assign({}, process.env, { GITHUB_ACTIONS: 'true' }) });
  let out = '';
  py.stdout.on('data', d => { out += d; }); py.stderr.on('data', d => { out += d; });
  py.on('close', code => {
    run.status = 'completed'; run.conclusion = code === 0 ? 'success' : 'failure';
    run.annotations = out.split(/\r?\n/).filter(l => l.startsWith('::error::')).map(l => ({ annotation_level: 'failure', message: l.slice(9) }));
    if (code !== 0) run.annotations.push({ annotation_level: 'failure', message: 'Process completed with exit code ' + code + '.' });
    run.log = out;
    fs.rmSync(dir, { recursive: true, force: true });
  });
}
function runView(sha) {
  const r = runs.get(sha);
  if (!r) return null;
  if (!RUN_CHECK && r.status !== 'completed') {
    r.polls++;
    if (r.polls >= 3) {
      const html = treeOf(sha)['index.html'];
      r.status = 'completed'; r.conclusion = html.includes('MOCK-FAIL') ? 'failure' : 'success';
      if (r.conclusion === 'failure') r.annotations = [{ annotation_level: 'failure', message: 'slide 4 (mock): content runs from 120 to 1200 px, but must stay between 100 and 1046.' }];
    } else r.status = r.polls >= 2 ? 'in_progress' : 'queued';
  }
  return { id: r.id, name: r.name, status: r.status, conclusion: r.conclusion, html_url: r.html_url, app: { slug: 'github-actions' } };
}

function send(res, status, data, headers = {}) {
  res.writeHead(status, Object.assign({ 'content-type': 'application/json' }, headers));
  res.end(data === undefined ? '' : JSON.stringify(data));
}
async function readBody(req) { const c = []; for await (const x of req) c.push(x); const s = Buffer.concat(c).toString('utf8'); if (!s) return {}; try { return JSON.parse(s); } catch (e) { return Object.fromEntries(new URLSearchParams(s)); } }
const prView = p => ({ number: p.number, title: p.title, body: p.body, state: p.state, merged: p.merged, merge_commit_sha: p.mergeSha || null, mergeable: true,
  html_url: 'https://github.com/' + REPO + '/pull/' + p.number, head: { ref: p.head, sha: refs.get(p.head) || p.headSha }, base: { ref: 'main' } });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:' + PORT), p = url.pathname, m = req.method;
  const b = m === 'GET' ? {} : await readBody(req);
  // test hooks
  if (p === '/__mock/main') return send(res, 200, { sha: refs.get('main'), files: treeOf(refs.get('main')), pulls: [...pulls.values()].map(prView), refs: [...refs.keys()] });
  if (p === '/__mock/edit-main') {
    const files = Object.assign({}, treeOf(refs.get('main')));
    if (!files[b.path].includes(b.find)) return send(res, 400, { message: 'text not found' });
    files[b.path] = files[b.path].replace(b.find, b.replace);
    refs.set('main', store({ type: 'commit', tree: store({ type: 'tree', files }), parents: [refs.get('main')], message: 'someone else' }));
    return send(res, 200, { sha: refs.get('main') });
  }
  if (p === '/__mock/ref') return send(res, 200, { files: treeOf(refs.get(url.searchParams.get('name'))) });
  if (p === '/__mock/log') { const r = [...runs.values()].pop(); return send(res, 200, { log: r && r.log }); }
  // sign-in pages
  if (p === '/login/oauth/authorize') {
    const to = new URL(url.searchParams.get('redirect_uri'));
    to.searchParams.set('code', 'code-' + id().slice(0, 8)); to.searchParams.set('state', url.searchParams.get('state'));
    res.writeHead(302, { location: to.href }); return res.end();
  }
  if (p === '/login/oauth/access_token') {
    if (b.client_secret !== process.env.GITHUB_CLIENT_SECRET || !b.code) return send(res, 200, { error: 'bad_verification_code' });
    return send(res, 200, { access_token: 'mock-' + id(), token_type: 'bearer', expires_in: 28800 });
  }
  // API
  if (!/^Bearer mock-/.test(req.headers.authorization || '')) return send(res, 401, { message: 'Bad credentials' });
  if (p === '/user') return send(res, 200, { login: LOGIN, avatar_url: '' });
  const pre = '/repos/' + REPO;
  if (!p.startsWith(pre)) return send(res, 404, { message: 'Not Found' });
  const r = p.slice(pre.length);
  let x;
  if (r === '' && m === 'GET') return send(res, 200, { full_name: REPO, permissions: { pull: true, push: true, admin: false } });
  if ((x = /^\/git\/ref\/heads\/(.+)$/.exec(r)) && m === 'GET') return refs.has(x[1]) ? send(res, 200, { object: { sha: refs.get(x[1]) } }) : send(res, 404, { message: 'Not Found' });
  if ((x = /^\/git\/commits\/(\w+)$/.exec(r)) && m === 'GET') { const c = objects.get(x[1]); return c ? send(res, 200, { sha: x[1], tree: { sha: c.tree } }) : send(res, 404, {}); }
  if ((x = /^\/contents\/(.+)$/.exec(r)) && m === 'GET') {
    const ref = url.searchParams.get('ref') || 'main', sha = refs.get(ref) || ref, files = treeOf(sha);
    if (!files || !(x[1] in files)) return send(res, 404, { message: 'Not Found' });
    return send(res, 200, { encoding: 'base64', content: Buffer.from(files[x[1]], 'utf8').toString('base64').replace(/(.{60})/g, '$1\n') });
  }
  if (r === '/git/blobs' && m === 'POST') return send(res, 201, { sha: store({ type: 'blob', content: b.content }) });
  if (r === '/git/trees' && m === 'POST') {
    const files = Object.assign({}, objects.get(b.base_tree).files);
    b.tree.forEach(e => { files[e.path] = objects.get(e.sha).content; });
    return send(res, 201, { sha: store({ type: 'tree', files }) });
  }
  if (r === '/git/commits' && m === 'POST') return send(res, 201, { sha: store({ type: 'commit', tree: b.tree, parents: b.parents, message: b.message }) });
  if (r === '/git/refs' && m === 'POST') { const name = b.ref.replace('refs/heads/', ''); if (refs.has(name)) return send(res, 422, { message: 'Reference already exists' }); refs.set(name, b.sha); return send(res, 201, { ref: b.ref }); }
  if ((x = /^\/git\/refs\/heads\/(.+)$/.exec(r))) {
    if (m === 'PATCH') { refs.set(x[1], b.sha); for (const pr of pulls.values()) if (pr.head === x[1] && pr.state === 'open') startCheck(b.sha); return send(res, 200, {}); }
    if (m === 'DELETE') { refs.delete(x[1]); return send(res, 204); }
  }
  if (r === '/pulls' && m === 'POST') {
    const pr = { number: ++prNo, title: b.title, body: b.body, head: b.head, headSha: refs.get(b.head), base: refs.get('main'), state: 'open', merged: false };
    pulls.set(pr.number, pr); startCheck(pr.headSha);
    return send(res, 201, prView(pr));
  }
  if ((x = /^\/pulls\/(\d+)$/.exec(r))) {
    const pr = pulls.get(+x[1]); if (!pr) return send(res, 404, {});
    if (m === 'PATCH') { if (b.title) pr.title = b.title; if (b.body) pr.body = b.body; if (b.state) pr.state = b.state; }
    return send(res, 200, prView(pr));
  }
  if ((x = /^\/pulls\/(\d+)\/merge$/.exec(r)) && m === 'PUT') {
    const pr = pulls.get(+x[1]), head = refs.get(pr.head);
    const parent = objects.get(head).parents[0];
    if (parent !== refs.get('main')) return send(res, 405, { message: 'Pull Request is not mergeable' });
    const sha = store({ type: 'commit', tree: objects.get(head).tree, parents: [refs.get('main')], message: b.commit_title });
    refs.set('main', sha); pr.state = 'closed'; pr.merged = true; pr.mergeSha = sha; pr.headSha = head;
    return send(res, 200, { sha, merged: true });
  }
  if ((x = /^\/commits\/(\w+)\/check-runs$/.exec(r))) { const v = runView(x[1]); return send(res, 200, { total_count: v ? 1 : 0, check_runs: v ? [v] : [] }); }
  if ((x = /^\/check-runs\/(\d+)\/annotations$/.exec(r))) { const run = [...runs.values()].find(z => z.id === +x[1]); return send(res, 200, run ? run.annotations : []); }
  if ((x = /^\/commits\/(\w+)\/status$/.exec(r))) {
    const n = (statusPolls.get(x[1]) || 0) + 1; statusPolls.set(x[1], n);
    return send(res, 200, { statuses: [{ context: 'Vercel', state: n >= 2 ? 'success' : 'pending', target_url: 'https://vercel.com/mock' }] });
  }
  if ((x = /^\/issues\/(\d+)\/comments$/.exec(r))) return send(res, 200, [{ user: { login: 'vercel[bot]' }, body: '| Name | Preview |\n| ucluster-too-qualifier | [Visit Preview](https://vercel.live/open-feedback/ucluster-too-qualifier-git-edit-mock-team.vercel.app?via=pr-comment-visit-preview-link&passThrough=1) |' }]);
  return send(res, 404, { message: 'Not Found (mock)' });
}).listen(PORT, '127.0.0.1', () => console.log('mock GitHub on ' + PORT));
