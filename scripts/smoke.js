'use strict';
// Runs representative slash + prefix commands against mocked Discord objects
// and asserts they respond through the real reply interface.
const { client, commands } = require('../src/bot');
const prefix = require('../src/prefixCommands');
const { Collection } = require('discord.js');

function mockUser(id, username) {
  return {
    id, username, tag: `${username}#${id.slice(-4)}`,
    createdAt: new Date('2020-01-01'),
    displayAvatarURL: () => 'https://example.com/avatar.png',
    bannerURL: () => null
  };
}

let pass = 0;
const failures = [];

function mkInteraction(opts = {}, user = mockUser('u1', 'Test')) {
  const state = { deferred: false, replied: false };
  const replies = [];
  const mockMsg = { edit: async (p) => { replies.push(p); return mockMsg; }, react: async () => {}, delete: async () => {} };
  const push = async (p) => { replies.push(p); state.replied = true; return p; };
  const channels = new Collection();
  channels.set('c1', { id: 'c1', type: 0, name: 'genel' });
  channels.set('v1', { id: 'v1', type: 2, name: 'Ses' });
  const roles = new Collection();
  roles.set('everyone', { id: 'everyone', name: '@everyone', position: 0, hexColor: '#000000', members: new Collection(), createdAt: new Date() });
  const guild = {
    id: 'g1', name: 'Test Guild', ownerId: 'o1', memberCount: 1,
    premiumTier: 0, premiumSubscriptionCount: 0, verificationLevel: 0,
    createdAt: new Date(),
    channels: { cache: channels },
    roles: { cache: roles, everyone: roles.get('everyone'), highest: { position: 10 } },
    emojis: { cache: new Collection() },
    members: {
      cache: new Collection(),
      fetch: async (id) => null,
      me: { roles: { highest: { position: 10 } } }
    },
    invites: { fetch: async () => new Collection() },
    iconURL: () => null
  };
  return Object.assign(state, {
    replies,
    user,
    client,
    guild,
    member: { permissions: { has: () => true } },
    channel: { id: 'c1', name: 'genel', type: 0, topic: null, createdAt: new Date(), parent: null },
    options: {
      getString: (k) => (k in opts ? opts[k] : null),
      getInteger: (k) => (k in opts ? opts[k] : null),
      getUser: (k) => (k in opts ? opts[k] : user),
      getMember: (k) => (k in opts ? opts[k] : null),
      getRole: () => roles.get('everyone'),
      getChannel: () => null
    },
    reply: async (p) => { replies.push(p); state.replied = true; return mockMsg; },
    followUp: push,
    editReply: push,
    deferReply: async () => { state.deferred = true; },
    deleteReply: async () => {}
  });
}

async function runSlash(name, opts) {
  const cmd = commands.get(name);
  if (!cmd) { failures.push(`/${name}: komut yok`); return; }
  const i = mkInteraction(opts);
  try {
    await cmd.execute(i);
    if (!i.replies.length) failures.push(`/${name}: yanit uretmedi`);
    else pass++;
  } catch (e) {
    failures.push(`/${name}: hata -> ${e.message}`);
  }
}

function mkMessage(content, user = { id: 'u1', bot: false, username: 'Test' }) {
  const replies = [];
  return {
    content,
    author: user,
    client,
    createdTimestamp: Date.now(),
    member: { permissions: { has: () => true } },
    guild: { id: 'g1', name: 'TG', memberCount: 3, channels: { cache: new Map() }, roles: { cache: new Map() }, createdAt: new Date() },
    channel: { id: 'c1', name: 'genel', bulkDelete: async () => new Map(), permissionOverwrites: { edit: async () => {} }, setRateLimitPerUser: async () => {}, messages: { fetch: async () => [] } },
    mentions: { users: { first: () => null }, members: { first: () => null } },
    reply: async (p) => { replies.push(p); return { replies }; },
    replies
  };
}

async function runPrefix(content) {
  const args = content.slice(1).trim().split(/\s+/);
  const name = args.shift().toLowerCase();
  const fn = prefix.commands[name];
  if (!fn) { failures.push(`!${name}: komut yok`); return; }
  const msg = mkMessage(content);
  try {
    await fn(msg, args);
    if (!msg.replies.length) failures.push(`!${name}: yanit uretmedi`);
    else pass++;
  } catch (e) {
    failures.push(`!${name}: hata -> ${e.message}`);
  }
}

(async () => {
  // slash — one per category + tricky paths
  await runSlash('zar');
  await runSlash('tas-kagit-makas', { secim: 'tas' });
  await runSlash('8ball', { soru: 'Bugün hava nasıl?' });
  await runSlash('kelime-tahmin', { harf: 'e' });
  await runSlash('sira-bul', { tahmin: 5 });
  await runSlash('hafiza-emoji');
  await runSlash('bakiye');
  await runSlash('gunluk');
  await runSlash('calis');
  await runSlash('banka', { islem: 'yatir', miktar: 10 });
  await runSlash('magaza');
  await runSlash('satin-al', { urun: 'kalem' });
  await runSlash('envanter');
  await runSlash('yardim');
  await runSlash('yardim', { komut: 'ban' });
  await runSlash('istatistik');
  await runSlash('ping');
  await runSlash('uptime');
  await runSlash('renk-kod', { hex: '#3b82f6' });
  await runSlash('renk-kod', { hex: 'bozuk' }); // validation error path
  await runSlash('rastgele', { min: 10, max: 20 });
  await runSlash('sayi-tahmin', { tahmin: 50 });
  await runSlash('hatirlat', { sure: '10m', neden: 'test' });
  await runSlash('sehir-saat', { sehir: 'Istanbul' });
  await runSlash('tesekkur', { user: mockUser('u2', 'Ayse') });
  await runSlash('hug', { user: mockUser('u2', 'Ayse') });
  await runSlash('ask-hesap', { user1: mockUser('u1', 'Test'), user2: mockUser('u2', 'Ayse') });
  await runSlash('komik'); // network, must fail gracefully
  await runSlash('serverinfo');
  await runSlash('avatar');
  await runSlash('roller');
  await runSlash('anket', { soru: 'Test?' });
  await runSlash('warn', { user: mockUser('u2', 'Ayse'), sebep: 'test' });
  await runSlash('warns', { user: mockUser('u2', 'Ayse') });
  await runSlash('unwarn', { user: mockUser('u2', 'Ayse') });
  await runSlash('userinfo');
  await runSlash('rolbilgi');

  // prefix
  await runPrefix('!ping');
  await runPrefix('!help');
  await runPrefix('!8ball sorum var');
  await runPrefix('!terscevir merhaba');
  await runPrefix('!bakiye');
  await runPrefix('!gunluk');
  await runPrefix('!calis');
  await runPrefix('!zaman');
  await runPrefix('!komutsayi');
  await runPrefix('!zar');

  console.log(`passed: ${pass}`);
  if (failures.length) {
    console.error('FAILED:');
    for (const f of failures) console.error(' -', f);
    process.exitCode = 1;
  } else {
    console.log('OK: smoke tests passed');
  }
  client.destroy();
  setTimeout(() => process.exit(process.exitCode || 0), 300).unref();
})();
