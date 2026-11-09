// Where a pull request from the editor stands: the automatic check, Vercel's preview, and whether it is live.
import { authed, gh, ghError, repoPath, json, fail, SITE } from './_lib/core.mjs';

export async function checkRun(t, sha) {
  const r = await gh(t, 'GET', repoPath('/commits/' + sha + '/check-runs?per_page=50'));
  const runs = r.ok && r.data ? (r.data.check_runs || []).filter(x => x.name === 'check') : [];
  return runs.sort((a, b) => b.id - a.id)[0] || null;
}
const vercel = r => (r.ok && r.data ? (r.data.statuses || []) : []).find(x => /^vercel/i.test(x.context || ''));

export default {
  async fetch(req) {
    const { s, error } = authed(req);
    if (error) return error;
    const n = parseInt(new URL(req.url).searchParams.get('pr'), 10);
    if (!(n > 0)) return fail(400, 'Which pull request?');
    const t = s.t;
    const p = await gh(t, 'GET', repoPath('/pulls/' + n));
    if (!p.ok) return ghError(p, 'read the pull request');
    const pr = p.data;
    const out = { number: n, url: pr.html_url, state: pr.state, merged: !!pr.merged, mergeable: pr.mergeable,
      check: { state: 'waiting', url: null }, errors: [], preview: { state: 'waiting', url: null }, live: null };

    if (pr.merged) {
      const v = vercel(await gh(t, 'GET', repoPath('/commits/' + pr.merge_commit_sha + '/status')));
      out.live = !v ? 'pending' : v.state === 'success' ? 'ready' : v.state === 'failure' || v.state === 'error' ? 'failed' : 'pending';
      return json(out);
    }

    const run = await checkRun(t, pr.head.sha);
    if (run) {
      out.check.url = run.html_url;
      out.check.state = run.status === 'queued' ? 'waiting' : run.status !== 'completed' ? 'running' : run.conclusion === 'success' ? 'success' : 'failure';
      if (out.check.state === 'failure') {
        const an = await gh(t, 'GET', repoPath('/check-runs/' + run.id + '/annotations?per_page=50'));
        if (an.ok && Array.isArray(an.data)) out.errors = an.data.filter(a => a.annotation_level === 'failure' && !/exit code \d+/i.test(a.message)).map(a => String(a.message).split('\n')[0].slice(0, 300));
      }
    }

    const v = vercel(await gh(t, 'GET', repoPath('/commits/' + pr.head.sha + '/status')));
    if (v) out.preview.state = v.state === 'success' ? 'success' : v.state === 'failure' || v.state === 'error' ? 'failure' : 'running';
    if (out.preview.state === 'success') {
      // Vercel posts the preview address in a comment on the pull request
      const c = await gh(t, 'GET', repoPath('/issues/' + n + '/comments?per_page=50'));
      const live = new URL(SITE).host.toLowerCase();
      const hosts = c.ok && Array.isArray(c.data) ? c.data.filter(x => /^vercel/i.test((x.user && x.user.login) || ''))
        .flatMap(x => String(x.body || '').match(/[a-z0-9-]+\.vercel\.app/gi) || []).filter(h => h.toLowerCase() !== live) : [];
      if (hosts.length) out.preview.url = 'https://' + hosts[hosts.length - 1];
    }
    return json(out);
  },
};
