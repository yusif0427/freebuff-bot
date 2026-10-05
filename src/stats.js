'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USAGE_FILE = path.join(DATA_DIR, 'usage.json');

let usage = { total: 0, per: {} };
try {
  usage = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
  if (typeof usage.total !== 'number' || !usage.per) usage = { total: 0, per: {} };
} catch (_) { /* first run */ }

let pingMs = null;
const startedAt = Date.now();
let botClient = null; // set by bot.js when ready

function record(commandName) {
  usage.total += 1;
  usage.per[commandName] = (usage.per[commandName] || 0) + 1;
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage));
  } catch (_) { /* disk full / readonly: counters are best-effort */ }
}

function setPing(ms) { pingMs = ms; }
function setBot(client) { botClient = client; }

function snapshot() {
  const online = !!(botClient && botClient.isReady());
  let servers = 0;
  let users = 0;
  if (online) {
    servers = botClient.guilds.cache.size;
    users = botClient.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0);
  }
  return {
    online,
    pingMs: pingMs == null ? null : Math.round(pingMs),
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    servers,
    users,
    commandsUsed: usage.total,
    perCommand: usage.per,
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    startedAt: new Date(startedAt).toISOString()
  };
}

setInterval(save, 60_000).unref();
process.on('exit', save);

module.exports = { record, save, setPing, setBot, snapshot, startedAt };
