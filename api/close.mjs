// Closes an editor pull request without merging it, and removes its branch.
import { authed, sameOrigin, body, gh, ghError, repoPath, json, fail } from './_lib/core.mjs';

export default {
  async fetch(req) {
    if (req.method !== 'POST') return fail(405, 'Use POST.');
    const { s, error } = authed(req);
    if (error) return error;
    if (!sameOrigin(req)) return fail(403, 'This request has to come from the deck page.');
    const b = await body(req), n = b && b.pr;
    if (!Number.isInteger(n) || n < 1) return fail(400, 'Which pull request?');
    const p = await gh(s.t, 'PATCH', repoPath('/pulls/' + n), { state: 'closed' });
    if (!p.ok) return ghError(p, 'close the pull request');
    if (/^edit\//.test(p.data.head.ref)) await gh(s.t, 'DELETE', repoPath('/git/refs/heads/' + p.data.head.ref));
    return json({ closed: true });
  },
};
