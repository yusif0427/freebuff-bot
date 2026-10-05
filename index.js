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

app.use(express.static(path.join(__dirname, 'public')));

// Live stats used by the website (polls every 5s)
app.get('/api/stats', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const s = stats.snapshot();
  res.json({
    botName: BOT_NAME,
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
