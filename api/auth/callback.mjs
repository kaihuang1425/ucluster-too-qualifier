// GitHub sends the teammate here after they approve the sign-in. Their token goes into an encrypted cookie.
import { configured, readState, clearState, exchange, gh, sessionCookie, redirect, page } from '../_lib/core.mjs';

export default {
  async fetch(req) {
    if (!configured()) return page(503, 'Publishing from the page is not set up yet.');
    const url = new URL(req.url), st = readState(req);
    const back = st && st.r ? st.r : '/?edit';
    if (url.searchParams.get('error')) return redirect(back, [clearState(req)]);          // they pressed Cancel
    const code = url.searchParams.get('code');
    if (!st || !code || st.s !== url.searchParams.get('state')) return page(400, 'This sign-in link has expired. Go back to the deck and press Sign in with GitHub again.');
    const tok = await exchange(code, url.origin + '/api/auth/callback');
    if (!tok || !tok.access_token) return page(502, 'GitHub did not finish the sign-in (' + (tok && (tok.error_description || tok.error) || 'no token') + '). Try again from the deck.');
    const me = await gh(tok.access_token, 'GET', '/user');
    if (!me.ok) return page(502, 'GitHub signed you in but did not say who you are. Try again from the deck.');
    const life = Math.min(Number(tok.expires_in) || 28800, 28800) * 1000;
    const s = { t: tok.access_token, l: me.data.login, a: me.data.avatar_url || '', e: Date.now() + life - 60000 };
    return redirect(back, [clearState(req), sessionCookie(req, s)]);
  },
};
