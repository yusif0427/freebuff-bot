'use strict';
const { Client, GatewayIntentBits, Partials, REST, Routes, Collection, Events } = require('discord.js');
const stats = require('./stats');
const prefix = require('./prefixCommands');
const { storeSnipe } = require('./commands/moderation');
const community = require('./community');

const CATEGORIES = ['moderation', 'server', 'utility', 'games', 'fun', 'economy'];
const CATEGORY_LABELS = {
  moderation: '🛡️ Moderasyon',
  server: '📌 Sunucu',
  utility: '🔧 Yardımcı',
  games: '🎮 Oyun',
  fun: '😄 Eğlence',
  economy: '💰 Ekonomi'
};

// --- load slash commands -------------------------------------------------
const commands = new Collection();
const SLASH_LIMIT = 100;

// Discord global slash command limiti 100. Botta kullanılabilen prefix
// komutlarını koruyoruz; aşağıdaki daha az kullanılan komutlar slash menüsünden
// kaldırılır ama koddan silinmez. Böylece eski komutlar prefix ile çalışmaya
// devam ederken Discord'daki / komut listesi limit altında kalır.
const DISABLED_SLASH_COMMANDS = new Set([
  'moon',
  'troll',
  'gif',
  'lirik'
]);

for (const cat of CATEGORIES) {
  const mod = require(`./commands/${cat}`);
  for (const cmd of mod.commands) {
    cmd.category = cat;
    commands.set(cmd.name, cmd);
  }
}

// validation: Discord rejects non-lowercase / oversize names
const NAME_RE = /^[-_\p{L}\p{N}]{1,32}$/u;
for (const cmd of commands.values()) {
  if (!NAME_RE.test(cmd.name)) throw new Error(`Gecersiz komut adi: ${cmd.name}`);
  if (cmd.name !== cmd.name.toLowerCase()) throw new Error(`Komut adi kucuk harf olmali: ${cmd.name}`);
  if (!cmd.description || cmd.description.length > 100) throw new Error(`Aciklama gecersiz: ${cmd.name}`);
}
const slashCommandCount = buildCommandBody().length;
if (slashCommandCount > SLASH_LIMIT) {
  throw new Error(`Slash komut limiti asildi: ${slashCommandCount} > ${SLASH_LIMIT}`);
}
console.log(`[bot] ${commands.size} toplam komut, ${slashCommandCount} slash komut kaydedilecek.`);

// --- client --------------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message]
});
client.commands = commands;
client.CATEGORY_LABELS = CATEGORY_LABELS;

// Exact JSON payload sent to Discord's REST API — exported so tests can verify it.
function buildCommandBody() {
  return [...commands.values()]
    .filter(c => !DISABLED_SLASH_COMMANDS.has(c.name))
    .map(c => ({
      name: c.name,
      description: c.description,
      options: (c.options || []).map(o => ({ ...o })),
      ...(c.default_member_permissions ? { default_member_permissions: c.default_member_permissions } : {})
    }));
}

async function registerCommands() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN yok');

  // Slash komutları, ENV'deki CLIENT_ID'ye değil giriş yapan botun
  // gerçek application ID'sine kaydet. Yanlış CLIENT_ID kullanılırsa
  // komutlar Discord'da görünür ama bu bot interaction'ı alamaz ve
  // kullanıcıya "Uygulama zamanında yanıt vermedi" hatası gösterir.
  if (!client.user?.id) throw new Error('Discord client henüz hazır değil');

  const actualClientId = client.user.id;
  const configuredClientId = process.env.CLIENT_ID;
  if (configuredClientId && configuredClientId !== actualClientId) {
    console.warn(`[bot] CLIENT_ID uyumsuz: ENV=${configuredClientId}, bot=${actualClientId}. Komutlar botun gerçek ID'sine kaydediliyor.`);
  }

  const body = buildCommandBody();
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationCommands(actualClientId), { body });
  console.log(`[bot] ${body.length} slash komut kaydedildi (global) — application=${actualClientId}`);
}

client.once(Events.ClientReady, (c) => {
  console.log(`[bot] ${c.user.tag} hazir — ${c.guilds.cache.size} sunucu`);
  stats.setBot(client);
  stats.setPing(c.ws.ping);
  setInterval(() => stats.setPing(c.ws.ping), 10_000).unref();
  if (process.env.DISCORD_TOKEN && (process.env.CLIENT_ID || c.user.id)) {
    registerCommands().catch(e => console.error('[bot] komut kaydi hatasi:', e.message));
  }
});

// --- slash interactions --------------------------------------------------
client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand()) return;
  const cmd = commands.get(i.commandName);
  if (!cmd) {
    console.warn(`[bot] Bilinmeyen slash interaction: /${i.commandName}`);
    try {
      if (!i.replied && !i.deferred) {
        await i.reply({ content: '❌ Bu komut botun mevcut komut listesinde yok. Komutları yeniden kaydetmeyi deneyin.', ephemeral: true });
      }
    } catch (_) {}
    return;
  }
  stats.record(cmd.name);
  try {
    await cmd.execute(i);
  } catch (e) {
    console.error(`[bot] /${cmd.name} hatasi:`, e);
    const msg = { content: '❌ Komut çalıştırılırken bir hata oluştu.', ephemeral: true };
    try {
      if (i.deferred || i.replied) await i.followUp(msg);
      else await i.reply(msg);
    } catch (_) {}
  }
});

// --- prefix + game answers ----------------------------------------------
client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;
  if (msg.guild) community.addMessage(msg.guild.id, msg.author.id, msg.author.username);
  const p = prefix.prefix;

  // game answer handling (word/riddle/math/quiz state)
  try {
    const text = (msg.content || '').trim().toLowerCase();
    const c = msg.client;

    if (c.quickMath && Date.now() - c.quickMath.at < 15_000) {
      if (/^\d+$/.test(text)) {
        const want = c.quickMath.answer;
        const got = parseInt(text, 10);
        c.quickMath = null;
        return msg.reply(got === want ? '✅ Doğru! Hızlısın!' : `❌ Yanlış! Doğrusu **${want}** idi.`).catch(() => {});
      }
    }
    if (c.riddle && c.riddleAt && Date.now() - c.riddleAt < 60_000) {
      const ans = (c.riddle || '').toLowerCase();
      if (text.length > 1) {
        const ok = text === ans || ans.includes(text) || text.includes(ans);
        c.riddle = null;
        if (ok) return msg.reply(`✅ Doğru! Cevap: **${ans}**`).catch(() => {});
      }
    }
    if (c.tfAnswer !== undefined && c.tfAnswer !== null && c.tfAt && Date.now() - c.tfAt < 60_000) {
      if (/^(evet|yes|hayır|hayir|no)$/.test(text)) {
        const want = c.tfAnswer;
        const said = /^evet|yes/.test(text);
        c.tfAnswer = null;
        return msg.reply(said === want ? '✅ Doğru!' : '❌ Yanlış!').catch(() => {});
      }
    }
    if (c.emojiQuiz && c.emojiAt && Date.now() - c.emojiAt < 60_000) {
      if (text.length > 2 && (text === c.emojiQuiz.toLowerCase() || c.emojiQuiz.toLowerCase().includes(text))) {
        const a = c.emojiQuiz;
        c.emojiQuiz = null;
        return msg.reply(`✅ Doğru! Cevap: **${a}**`).catch(() => {});
      }
    }
    if (c.scramble && c.scrambleAt && Date.now() - c.scrambleAt < 60_000) {
      if (text.length > 2 && (text === c.scramble || c.scramble.includes(text))) {
        const a = c.scramble;
        c.scramble = null;
        return msg.reply(`✅ Doğru! Kelime: **${a}**`).catch(() => {});
      }
    }
    if (c.wordGame) {
      const g = c.wordGame;
      const w = g.word;
      if (text === w) { c.wordGame = null; return msg.reply(`✅ Doğru! Kelime: **${w}**`).catch(() => {}); }
      else if (text.length === 1 && w.includes(text)) {
        if (!g.guessed.includes(text)) g.guessed.push(text);
        const masked = [...w].map(ch => (ch === ' ' || g.guessed.includes(ch) ? ch : '⬛')).join('');
        if (masked === w) { c.wordGame = null; return msg.reply(`✅ Bildin! Kelime: **${w}**`).catch(() => {}); }
        return msg.reply(`🔤 ${masked} — kalan hak: **${8 - g.tries}**`).catch(() => {});
      }
      else if (text.length === 1) {
        g.tries += 1;
        if (g.tries >= 8) { c.wordGame = null; return msg.reply(`💀 Bitti! Kelime **${w}** idi.`).catch(() => {}); }
      }
    }
    if (c.series && /^-?\d+$/.test(text)) {
      const st = c.series;
      const want = st.start + st.step * st.round;
      const got = parseInt(text, 10);
      if (got === want) {
        st.round += 1;
        const preview = st.start + st.step * st.round;
        return msg.reply(`✅ Doğru! Devam: ${preview - st.step}, ${preview}, ?`).catch(() => {});
      }
      c.series = null;
      return msg.reply(`❌ Yanlış! Doğrusu **${want}** idi. Yeni oyun: /sira-bul`).catch(() => {});
    }
    if (c.memoryNum && text === String(c.memoryNum)) {
      const n = c.memoryNum;
      c.memoryNum = null;
      return msg.reply(`✅ Doğru! Sayı **${n}** idi.`).catch(() => {});
    }
    if (c.mathQuiz && Date.now() - c.mathQuiz.at < 60_000) {
      if (/^\d+$/.test(text)) {
        const want = c.mathQuiz.answer;
        const got = parseInt(text, 10);
        c.mathQuiz = null;
        return msg.reply(got === want ? '✅ Doğru!' : `❌ Yanlış! Doğrusu **${want}**.`).catch(() => {});
      }
    }
    if (c.thanksStore === undefined) c.thanksStore = {};
    if (c.noteStore === undefined) c.noteStore = {};
    if (c.gameSecret === undefined) c.gameSecret = null;
  } catch (e) {
    console.error('[bot] oyun cevapi hatasi:', e);
  }

  // prefix commands
  if (!msg.content.startsWith(prefix.prefix)) return;
  const args = msg.content.slice(prefix.prefix.length).trim().split(/\s+/);
  const name = (args.shift() || '').toLowerCase();
  const fn = prefix.commands[name];
  if (!fn) return;
  stats.record('prefix:' + name);
  try {
    await fn(msg, args);
  } catch (e) {
    console.error(`[bot] !${name} hatasi:`, e);
  }
});

// --- snipe support -------------------------------------------------------
client.on(Events.MessageDelete, (msg) => {
  try { storeSnipe(msg); } catch (_) {}
});

module.exports = { client, commands, registerCommands, buildCommandBody };
