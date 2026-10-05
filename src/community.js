'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'community.json');
let db = { users: {}, guilds: {} };
try { db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch (_) {}

function save() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db));
  } catch (_) {}
}
function user(guildId, userId, name='User') {
  const k = guildId + ':' + userId;
  if (!db.users[k]) db.users[k] = { guildId, userId, name, xp: 0, level: 0, messages: 0, lastMessage: 0 };
  db.users[k].name = name || db.users[k].name;
  return db.users[k];
}
function addMessage(guildId, userId, name) {
  const u = user(guildId, userId, name);
  const now = Date.now();
  if (now - u.lastMessage < 45000) return { gained: 0, levelUp: false, ...u };
  const gained = 15 + Math.floor(Math.random() * 11);
  u.xp += gained; u.messages += 1; u.lastMessage = now;
  const old = u.level;
  u.level = Math.floor(Math.sqrt(u.xp / 100));
  save();
  return { gained, levelUp: u.level > old, ...u };
}
function rank(guildId, userId) {
  const rows = Object.values(db.users).filter(x => x.guildId === guildId).sort((a,b) => b.xp-a.xp);
  const idx = rows.findIndex(x => x.userId === userId);
  const u = user(guildId, userId);
  return { user: u, position: idx < 0 ? rows.length + 1 : idx + 1, total: rows.length, nextXp: (u.level + 1) ** 2 * 100 };
}
function top(guildId, limit=10) {
  return Object.values(db.users).filter(x => x.guildId === guildId).sort((a,b) => b.xp-a.xp).slice(0, limit);
}
function weekly(guildId, limit=10) {
  const since = Date.now() - 7 * 86400000;
  return Object.values(db.users).filter(x => x.guildId === guildId && x.lastMessage >= since)
    .sort((a,b) => b.messages-a.messages).slice(0, limit);
}
function recordGuild(guildId, patch={}) {
  db.guilds[guildId] = { ...(db.guilds[guildId] || {}), ...patch };
  save();
}
function guildConfig(guildId) { return db.guilds[guildId] || {}; }
module.exports = { addMessage, rank, top, weekly, recordGuild, guildConfig, save };
