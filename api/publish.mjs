/* Publishes edits from the page as a pull request.
   The edits are applied to the current main branch, not to the copy the editor loaded, so two people editing
   different slides at once never overwrite each other. If someone changed the same text, nothing is written
   and the editor is told which parts clash. */
import { applyHtmlOps, applyDataOp } from '../lib/htmlmap.mjs';
import { authed, sameOrigin, body, gh, ghError, repoPath, json, fail } from './_lib/core.mjs';

const isStr = v => typeof v === 'string';
function stamp() { return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15); }
function slideText(ns) { return ns.length < 2 ? 'slide ' + ns[0] : 'slides ' + ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1]; }

export default {
  async fetch(req) {
    if (req.method !== 'POST') return fail(405, 'Use POST.');
    const { s, error } = authed(req);
    if (error) return error;
    if (!sameOrigin(req)) return fail(403, 'This request has to come from the deck page.');
    const b = await body(req);
    if (!b || !Array.isArray(b.ops) || !b.ops.length || b.ops.length > 400) return fail(400, 'There is nothing to publish.');
    if (JSON.stringify(b.ops).length > 600000) return fail(413, 'This edit is too large to publish from the page. Edit index.html on GitHub instead.');
    const htmlOps = [], dataOps = [];
    for (const o of b.ops) {
      if (!o || !isStr(o.old) || !isStr(o.new) || !Number.isInteger(o.slide)) return fail(400, 'An edit is incomplete.');
      if (o.file === 'index.html' && (o.kind === 'inner' || o.kind === 'tag') && Number.isInteger(o.si) && isStr(o.name)) htmlOps.push(o);
      else if (o.file === 'deck.js' && o.kind === 'data') dataOps.push(o);
      else return fail(400, 'An edit names a file the page editor does not change.');
    }
    if (dataOps.length > 1) return fail(400, 'Send the chart numbers as one edit.');
    const title = (isStr(b.title) && b.title.replace(/\s+/g, ' ').trim().slice(0, 120)) || 'Edit the deck';
    const t = s.t;

    const ref = await gh(t, 'GET', repoPath('/git/ref/heads/main'));
    if (!ref.ok) return ghError(ref, 'read the main branch');
    const mainSha = ref.data.object.sha;
    const read = async path => {
      const r = await gh(t, 'GET', repoPath('/contents/' + path + '?ref=' + mainSha));
      return r.ok && r.data && isStr(r.data.content) ? { text: Buffer.from(r.data.content, 'base64').toString('utf8') } : { error: ghError(r, 'read ' + path) };
    };
    const files = {}, conflicts = [];
    if (htmlOps.length) {
      const f = await read('index.html'); if (f.error) return f.error;
      const r = applyHtmlOps(f.text, htmlOps);
      if (r.error) return fail(422, r.error);
      conflicts.push(...r.conflicts);
      files['index.html'] = r.out;
    }
    if (dataOps.length) {
      const f = await read('deck.js'); if (f.error) return f.error;
      const r = applyDataOp(f.text, dataOps[0]);
      if (r.conflict) conflicts.push({ slide: 11, text: 'the chart numbers in deck.js' });
      else if (r.error) return fail(422, r.error);
      else files['deck.js'] = r.out;
    }
    if (conflicts.length) return fail(409, 'Someone changed the same text on GitHub after you opened the page.', { conflicts });

    const slides = [...new Set(b.ops.map(o => o.slide).filter(n => n > 0))].sort((x, y) => x - y);
    const base = await gh(t, 'GET', repoPath('/git/commits/' + mainSha));
    if (!base.ok) return ghError(base, 'read the latest commit');
    const tree = [];
    for (const [path, content] of Object.entries(files)) {
      const bl = await gh(t, 'POST', repoPath('/git/blobs'), { content, encoding: 'utf-8' });
      if (!bl.ok) return ghError(bl, 'save ' + path);
      tree.push({ path, mode: '100644', type: 'blob', sha: bl.data.sha });
    }
    const tr = await gh(t, 'POST', repoPath('/git/trees'), { base_tree: base.data.tree.sha, tree });
    if (!tr.ok) return ghError(tr, 'save the edit');
    const message = title + '\n\nEdited on the deck page by @' + s.l + (slides.length ? ', ' + slideText(slides) : '') + '.';
    const cm = await gh(t, 'POST', repoPath('/git/commits'), { message, tree: tr.data.sha, parents: [mainSha] });
    if (!cm.ok) return ghError(cm, 'save the commit');

    // a second publish from the same page replaces the branch of its open pull request
    let branch = isStr(b.branch) && /^edit\/[\w.-]+$/.test(b.branch) ? b.branch : null, pr = null;
    if (branch && Number.isInteger(b.pr)) {
      const p = await gh(t, 'GET', repoPath('/pulls/' + b.pr));
      if (p.ok && p.data.state === 'open' && p.data.head.ref === branch) pr = p.data; else branch = null;
    } else branch = null;
    if (branch) {
      const u = await gh(t, 'PATCH', repoPath('/git/refs/heads/' + branch), { sha: cm.data.sha, force: true });
      if (!u.ok) return ghError(u, 'update the branch');
    } else {
      branch = 'edit/' + String(s.l).toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-' + stamp();
      const c = await gh(t, 'POST', repoPath('/git/refs'), { ref: 'refs/heads/' + branch, sha: cm.data.sha });
      if (!c.ok) return ghError(c, 'create a branch');
    }
    const prBody = 'Edited on the deck page by @' + s.l + '.' + (slides.length ? ' This changes ' + slideText(slides) + '.' : '') +
      '\n\nThe automatic check runs on this pull request. Merge it once the check passes, or press Make it live in the page editor.';
    if (pr) {
      await gh(t, 'PATCH', repoPath('/pulls/' + pr.number), { title, body: prBody });
    } else {
      const n = await gh(t, 'POST', repoPath('/pulls'), { title, head: branch, base: 'main', body: prBody });
      if (!n.ok) return ghError(n, 'open the pull request');
      pr = n.data;
    }
    return json({ pr: pr.number, url: pr.html_url, branch, sha: cm.data.sha });
  },
};
