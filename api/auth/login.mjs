// Starts "Sign in with GitHub". GitHub sends the teammate back to /api/auth/callback.
import { randomBytes } from 'node:crypto';
import { configured, CLIENT_ID, WEB, SITE, isLocal, safeReturn, stateCookie, redirect, page } from '../_lib/core.mjs';

export default {
  async fetch(req) {
    if (!configured()) return page(503, 'Publishing from the page is not set up yet. The repository owner switches it on once, as the README describes.');
    const url = new URL(req.url), ret = safeReturn(url.searchParams.get('return'));
    // GitHub only returns people to the addresses registered on the app, so sign-in always happens on the live site
    if (url.origin !== SITE && !isLocal(req)) return redirect(SITE + '/api/auth/login?return=' + encodeURIComponent(ret));
    const state = randomBytes(16).toString('hex');
    const q = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: url.origin + '/api/auth/callback', state, allow_signup: 'false' });
    return redirect(WEB + '/login/oauth/authorize?' + q, [stateCookie(req, { s: state, r: ret })]);
  },
};
