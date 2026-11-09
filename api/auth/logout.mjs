import { clearSession, json, redirect } from '../_lib/core.mjs';

export default {
  async fetch(req) {
    if (req.method === 'POST') return json({ ok: true }, 200, { 'set-cookie': clearSession(req) });
    return redirect('/?edit', [clearSession(req)]);
  },
};
