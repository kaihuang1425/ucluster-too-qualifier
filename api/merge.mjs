// "Make it live": merges the pull request once the automatic check has passed, then removes its branch.
import { authed, sameOrigin, body, gh, ghError, repoPath, json, fail } from './_lib/core.mjs';
import { checkRun } from './status.mjs';

export default {
  async fetch(req) {
    if (req.method !== 'POST') return fail(405, 'Use POST.');
    const { s, error } = authed(req);
    if (error) return error;
    if (!sameOrigin(req)) return fail(403, 'This request has to come from the deck page.');
    const b = await body(req), n = b && b.pr;
    if (!Number.isInteger(n) || n < 1) return fail(400, 'Which pull request?');
    const t = s.t;
    const p = await gh(t, 'GET', repoPath('/pulls/' + n));
    if (!p.ok) return ghError(p, 'read the pull request');
    if (p.data.merged) return json({ merged: true, sha: p.data.merge_commit_sha });
    if (p.data.state !== 'open') return fail(409, 'This pull request is closed.');
    const run = await checkRun(t, p.data.head.sha);
    if (!run || run.status !== 'completed' || run.conclusion !== 'success') return fail(409, 'The automatic check has not passed yet.');
    const args = { sha: p.data.head.sha, commit_title: p.data.title + ' (#' + n + ')' };
    let m = await gh(t, 'PUT', repoPath('/pulls/' + n + '/merge'), Object.assign({ merge_method: 'squash' }, args));
    if (m.status === 405 && /squash/i.test((m.data && m.data.message) || '')) m = await gh(t, 'PUT', repoPath('/pulls/' + n + '/merge'), Object.assign({ merge_method: 'merge' }, args));
    if (!m.ok) {
      if (m.status === 405 || m.status === 409) return fail(409, 'GitHub cannot merge this pull request as it is. Press Update in the editor to rebuild it on the latest deck.');
      return ghError(m, 'merge the pull request');
    }
    if (/^edit\//.test(p.data.head.ref)) await gh(t, 'DELETE', repoPath('/git/refs/heads/' + p.data.head.ref));
    return json({ merged: true, sha: m.data && m.data.sha });
  },
};
