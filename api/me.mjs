// Who is signed in, and whether GitHub lets them write to the repository.
import { configured, session, gh, repoPath, json, clearSession, isLocal, REPO, SITE } from './_lib/core.mjs';

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const base = { configured: configured(), site: SITE, repo: REPO, signInHere: url.origin === SITE || isLocal(req) };
    if (!base.configured) return json(base);
    const s = session(req);
    if (!s) return json(Object.assign(base, { signedIn: false }));
    const u = await gh(s.t, 'GET', '/user');
    if (u.status === 401) return json(Object.assign(base, { signedIn: false }), 200, { 'set-cookie': clearSession(req) });
    const r = await gh(s.t, 'GET', repoPath(''));
    const p = r.ok && r.data ? r.data.permissions : null;
    const canPush = r.ok && (p ? !!p.push : true);
    return json(Object.assign(base, {
      signedIn: true, login: (u.data && u.data.login) || s.l, avatar: (u.data && u.data.avatar_url) || s.a || '',
      canPush, reason: canPush ? null : r.ok ? 'read-only' : 'no-access',
    }));
  },
};
