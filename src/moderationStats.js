'use strict';
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'moderation.json');
let db = {};
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (_) {}
function save(){ try { fs.mkdirSync(path.dirname(FILE),{recursive:true}); fs.writeFileSync(FILE,JSON.stringify(db)); } catch(_){} }
function guild(id){ return db[id] || (db[id]={ bans:[], kicks:[], timeouts:[], warns:[], joins:[], leaves:[] }); }
function push(guildId,type,item){ const g=guild(guildId); g[type]=(g[type]||[]); g[type].push({...item,at:Date.now()}); if(g[type].length>500) g[type]=g[type].slice(-500); save(); }
function record(type,guildId,item){ push(guildId,type,item); }
function week(guildId,type){ const since=Date.now()-7*86400000; return (guild(guildId)[type]||[]).filter(x=>x.at>=since); }
function summary(guildId){ const g=guild(guildId); return { bans:week(guildId,'bans').length,kicks:week(guildId,'kicks').length,timeouts:week(guildId,'timeouts').length,warns:week(guildId,'warns').length,joins:week(guildId,'joins').length,leaves:week(guildId,'leaves').length }; }
module.exports={record,week,summary};
