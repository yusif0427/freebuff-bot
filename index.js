'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');

// minimal .env loader (no dependency) — Render uses real env vars instead
(() => {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
})();

const stats = require('./src/stats');
const { client, commands } = require('./src/bot');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_NAME = process.env.BOT_NAME || 'Freebuff Bot';
const sessions = new Map();
const oauthStates = new Map();
const OAUTH_API = 'https://discord.com/api/v10';

function sessionUser(req) { const sid = req.headers.cookie?.match(/(?:^|; )fb_session=([^;]+)/)?.[1]; return sid ? sessions.get(sid) : null; }
function jsonError(res, code, msg) { return res.status(code).json({ error: msg }); }

app.use(express.static(path.join(__dirname, 'public')));

// Live stats used by the website (polls every 5s)
app.get('/api/stats', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const s = stats.snapshot();
  res.json({
    botName: BOT_NAME,
    inviteUrl: process.env.INVITE_URL || null,
    mode: process.env.DISCORD_TOKEN ? 'bot' : 'site-only',
    ...s,
    counts: {
      slash: commands.size,
      prefix: Object.keys(require('./src/prefixCommands').commands).length,
      get total() { return this.slash + this.prefix; }
    },
    categories: commands.size
      ? [...new Set([...commands.values()].map(c => c.category))]
      : []
  });
});

// Command list for the website's command browser
app.get('/api/commands', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  const byCat = {};
  for (const c of commands.values()) {
    const label = client.CATEGORY_LABELS[c.category] || c.category;
    byCat[label] = byCat[label] || [];
    byCat[label].push({ name: c.name, description: c.description });
  }
  const prefixCmds = Object.keys(require('./src/prefixCommands').commands);
  res.json({ slash: byCat, prefix: prefixCmds });
});

app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Discord OAuth2 dashboard. Secrets stay server-side; the browser never receives them.
app.get('/auth/discord', (req, res) => {
  const clientId = process.env.CLIENT_ID;
  const redirect = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !redirect || !process.env.DISCORD_CLIENT_SECRET) return res.status(503).send('Discord dashboard OAuth ayarlanmamış.');
  const state = require('crypto').randomBytes(24).toString('hex');
  oauthStates.set(state, Date.now());
  setTimeout(() => oauthStates.delete(state), 10 * 60_000).unref();
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId); url.searchParams.set('response_type', 'code'); url.searchParams.set('redirect_uri', redirect); url.searchParams.set('scope', 'identify guilds');
  url.searchParams.set('state', state); return res.redirect(url.toString());
});
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state || !oauthStates.has(state)) return res.status(400).send('Geçersiz OAuth isteği.');
  oauthStates.delete(state);
  try {
    const body = new URLSearchParams({ client_id: process.env.CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code: String(code), redirect_uri: process.env.DISCORD_REDIRECT_URI });
    const tokenRes = await fetch(OAUTH_API + '/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!tokenRes.ok) throw new Error('token');
    const token = await tokenRes.json();
    const [userRes, guildRes] = await Promise.all([
      fetch(OAUTH_API + '/users/@me', { headers: { Authorization: 'Bearer ' + token.access_token } }),
      fetch(OAUTH_API + '/users/@me/guilds', { headers: { Authorization: 'Bearer ' + token.access_token } })
    ]);
    if (!userRes.ok || !guildRes.ok) throw new Error('profile');
    const user = await userRes.json(), guilds = await guildRes.json();
    const sid = require('crypto').randomBytes(32).toString('hex');
    sessions.set(sid, { user, guilds, expiresAt: Date.now() + 7 * 86400_000 });
    res.setHeader('Set-Cookie', `fb_session=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
    res.redirect('/#dashboard');
  } catch (e) { res.status(502).send('Discord girişi başarısız.'); }
});
app.post('/auth/logout', (req, res) => {
  const sid = req.headers.cookie?.match(/(?:^|; )fb_session=([^;]+)/)?.[1];
  if (sid) sessions.delete(sid);
  res.setHeader('Set-Cookie', 'fb_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});
app.get('/api/me', (req, res) => {
  const s = sessionUser(req);
  if (!s || s.expiresAt < Date.now()) return jsonError(res, 401, 'Giriş yapmalısın.');
  const botGuilds = new Set(client.guilds.cache.keys());
  res.json({ user: s.user, guilds: s.guilds.map(g => ({ id:g.id, name:g.name, icon:g.icon, owner:g.owner, permissions:g.permissions, botPresent:botGuilds.has(g.id) })) });
});

app.listen(PORT, () => {
  console.log(`[web] site http://localhost:${PORT} — mod: ${process.env.DISCORD_TOKEN ? 'bot' : 'site-only'}`);
});

if (process.env.DISCORD_TOKEN) {
  client.login(process.env.DISCORD_TOKEN).catch(e => {
    console.error('[bot] giris hatasi (site calismaya devam eder):', e.message);
  });
} else {
  console.log('[bot] DISCORD_TOKEN yok — site-only mod. Slash komutlari yerel olarak kayitli.');
}
