/* Shared code for the page editor's functions in api/.

   Sign-in uses a GitHub App that only the repository owner creates (see README, "Switch on publishing from the
   page"). Each teammate signs in as themselves, so GitHub decides who may write, using the collaborator list.
   Their token never leaves an encrypted, HttpOnly cookie in their own browser. Nothing is stored on the server.

   Environment variables
     GITHUB_CLIENT_ID      the GitHub App's client ID
     GITHUB_CLIENT_SECRET  a client secret generated for that app
     DECK_REPO             owner/name, default kaihuang1425/ucluster-too-qualifier
     DECK_SITE             the live address, default https://ucluster-too-qualifier.vercel.app
     GITHUB_API, GITHUB_WEB  only for tests (tools/test_editor.py points them at a local stand-in) */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const REPO = process.env.DECK_REPO || 'kaihuang1425/ucluster-too-qualifier';
export const SITE = (process.env.DECK_SITE || 'https://ucluster-too-qualifier.vercel.app').replace(/\/$/, '');
export const API = (process.env.GITHUB_API || 'https://api.github.com').replace(/\/$/, '');
export const WEB = (process.env.GITHUB_WEB || 'https://github.com').replace(/\/$/, '');
export const CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const SECRET = process.env.GITHUB_CLIENT_SECRET || '';
export const configured = () => !!(CLIENT_ID && SECRET);
const SESSION = 'deck_s', STATE = 'deck_st';

/* ---- responses ---- */
export function json(data, status = 200, headers = {}) {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  for (const [k, v] of Object.entries(headers)) [].concat(v).forEach(x => h.append(k, x));
  return new Response(JSON.stringify(data), { status, headers: h });
}
export function redirect(to, cookies = []) {
  const h = new Headers({ location: to, 'cache-control': 'no-store' });
  cookies.forEach(c => h.append('set-cookie', c));
  return new Response(null, { status: 302, headers: h });
}
export const fail = (status, error, extra = {}) => json(Object.assign({ error }, extra), status);
// a plain page for the few steps a person sees directly (sign-in problems)
export function page(status, message) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Deck editor</title>' +
    '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#131314;color:#E3E3E3;font:16px/1.5 system-ui,sans-serif">' +
    '<div style="max-width:520px;padding:24px"><p>' + esc(message) + '</p><p><a style="color:#A8C7FA" href="/?edit">Back to the deck editor</a></p></div>',
  { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
// swap the one-time code from GitHub's sign-in page for the teammate's own token
export async function exchange(code, redirectUri) {
  const r = await fetch(WEB + '/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'ucluster-deck-editor' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: SECRET, code, redirect_uri: redirectUri }),
  });
  try { return await r.json(); } catch (e) { return { error: 'bad_response' }; }
}

/* ---- cookies ---- */
export function readCookies(req) {
  const out = {};
  (req.headers.get('cookie') || '').split(/;\s*/).forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); });
  return out;
}
export function cookie(req, name, value, maxAge) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAge + secure;
}
const key = () => createHash('sha256').update('deck-editor-session|' + SECRET).digest();
export function seal(obj) {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, body, c.getAuthTag()]).toString('base64url');
}
export function unseal(text) {
  try {
    const b = Buffer.from(text, 'base64url');
    const d = createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(b.length - 16));
    return JSON.parse(Buffer.concat([d.update(b.subarray(12, b.length - 16)), d.final()]).toString('utf8'));
  } catch (e) { return null; }
}
export function session(req) {
  if (!configured()) return null;
  const v = readCookies(req)[SESSION];
  const s = v && unseal(v);
  return s && s.t && s.e > Date.now() ? s : null;
}
export const sessionCookie = (req, s) => cookie(req, SESSION, seal(s), Math.max(60, Math.floor((s.e - Date.now()) / 1000)));
export const clearSession = req => cookie(req, SESSION, '', 0);
export const stateCookie = (req, s) => cookie(req, STATE, seal(s), 600);
export const readState = req => { const v = readCookies(req)[STATE]; return v ? unseal(v) : null; };
export const clearState = req => cookie(req, STATE, '', 0);

/* ---- request checks ---- */
export function isLocal(req) { const h = new URL(req.url).hostname; return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'; }
// state-changing calls must come from this site's own page, as JSON
export function sameOrigin(req) {
  const here = new URL(req.url).origin, o = req.headers.get('origin');
  if (o && o !== here) return false;
  if (!o) { const r = req.headers.get('referer'); if (!r || new URL(r).origin !== here) return false; }
  return (req.headers.get('content-type') || '').startsWith('application/json');
}
export async function body(req) { try { return await req.json(); } catch (e) { return null; } }
export const safeReturn = r => (typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') && !r.includes('\\') ? r : '/?edit');

/* ---- GitHub ---- */
export async function gh(token, method, path, data) {
  const r = await fetch(API + path, {
    method,
    headers: { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'ucluster-deck-editor', ...(data ? { 'content-type': 'application/json' } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });
  let out = null;
  if (r.status !== 204) { try { out = await r.json(); } catch (e) { out = null; } }
  return { status: r.status, ok: r.ok, data: out };
}
export const repoPath = p => '/repos/' + REPO + p;
export function ghError(r, what) {
  if (r.status === 401) return fail(401, 'Your GitHub sign-in has expired. Sign in again.');
  if (r.status === 403 || r.status === 404) return fail(403, 'GitHub refused to ' + what + '. Your account may not be a collaborator on ' + REPO + ', or the editing app is not installed on it.');
  return fail(502, 'GitHub could not ' + what + ' (' + r.status + (r.data && r.data.message ? ', ' + r.data.message : '') + ').');
}
export function authed(req) {
  if (!configured()) return { error: fail(503, 'Publishing from the page is not set up yet.') };
  const s = session(req);
  if (!s) return { error: fail(401, 'Sign in with GitHub first.') };
  return { s };
}
