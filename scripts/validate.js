'use strict';
// Loads every command module and validates Discord constraints + counts.
const { commands, client, buildCommandBody } = require('../src/bot');
const prefix = require('../src/prefixCommands');

const errors = [];
const NAME_RE = /^[-_\p{L}\p{N}]{1,32}$/u;

for (const cmd of commands.values()) {
  if (!NAME_RE.test(cmd.name)) errors.push(`invalid name: ${cmd.name}`);
  if (cmd.name !== cmd.name.toLowerCase()) errors.push(`not lowercase: ${cmd.name}`);
  if (!cmd.description || cmd.description.length > 100) errors.push(`bad description: ${cmd.name}`);
  if (typeof cmd.execute !== 'function') errors.push(`no execute(): ${cmd.name}`);
  if (cmd.options) {
    for (const o of cmd.options) {
      if (!o.name || !o.description) errors.push(`bad option in ${cmd.name}`);
      if (o.description && o.description.length > 100) errors.push(`option desc too long in ${cmd.name}: ${o.name}`);
    }
  }
}

const prefixNames = Object.keys(prefix.commands);
const total = commands.size + prefixNames.length;

console.log('slash commands :', commands.size);
console.log('prefix commands:', prefixNames.length);
console.log('total          :', total);
console.log('categories     :', [...new Set([...commands.values()].map(c => c.category))].join(', '));
console.log('prefix         :', prefix.prefix);

if (commands.size < 1) errors.push('no slash commands loaded');
if (total < 100) errors.push(`total must be > 100, got ${total}`);

// duplicate names
const names = [...commands.values()].map(c => c.name);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
if (dupes.length) errors.push('duplicate slash names: ' + dupes.join(','));

// REST payload sanity (what registerCommands PUTs to Discord)
const body = buildCommandBody();
if (body.length < 1) errors.push('REST payload is empty');
if (body.length > 100) errors.push('Discord global limit (100) exceeded');
const OPT_TYPES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
for (const c of body) {
  if (!c.name || !c.description) errors.push('REST entry missing name/description');
  for (const o of c.options || []) {
    if (!OPT_TYPES.has(o.type)) errors.push(`bad option type ${o.type} in ${c.name}`);
    if (o.required !== undefined && typeof o.required !== 'boolean') errors.push(`bad required in ${c.name}.${o.name}`);
  }
  try { JSON.stringify(c); } catch (e) { errors.push(`not serializable: ${c.name}`); }
}

const pdupes = prefixNames.filter((n, i) => prefixNames.indexOf(n) !== i);
if (pdupes.length) errors.push('duplicate prefix names: ' + pdupes.join(','));

// help listing must reference existing slash commands
const help = commands.get('yardim');
if (help) {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'commands', 'utility.js'), 'utf8');
  const listed = [...src.matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]);
  const missing = listed.filter(n => !commands.has(n) && !['komut'].includes(n));
  // only check the hardcoded help arrays
  const helpStart = src.indexOf('const cats = {');
  const helpEnd = src.indexOf('};', helpStart);
  const block = src.slice(helpStart, helpEnd);
  const refs = [...block.matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]).filter(n => !n.includes('-') || commands.has(n));
  const badRefs = refs.filter(n => !commands.has(n));
  if (badRefs.length) errors.push('help lists unknown commands: ' + badRefs.join(','));
}

if (errors.length) {
  console.error('\nFAILED:');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log('\nOK: all validations passed');
