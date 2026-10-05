'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'warns.json');
let db = {};
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (_) { db = {}; }

function save() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db));
  } catch (_) {}
}

function key(guildId, userId) { return `${guildId}:${userId}`; }

function addWarn(guildId, userId, reason, by) {
  const k = key(guildId, userId);
  db[k] = db[k] || [];
  db[k].push({ reason, by, at: Date.now() });
  save();
  return db[k].length;
}

function getWarns(guildId, userId) {
  return db[key(guildId, userId)] || [];
}

function removeLastWarn(guildId, userId) {
  const k = key(guildId, userId);
  if (!db[k] || !db[k].length) return null;
  db[k].pop();
  if (!db[k].length) delete db[k];
  save();
  return db[k] ? db[k].length : 0;
}

module.exports = { addWarn, getWarns, removeLastWarn };
