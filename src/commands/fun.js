'use strict';
const { emb, ok, fail, COLORS, rand, pick } = require('../helpers');

const U = (name, desc, required = true) => ({ name, description: desc, type: 6, required });
const S = (name, desc, required = false) => ({ name, description: desc, type: 3, required });
const I = (name, desc, required = false) => ({ name, description: desc, type: 4, required });

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const commands = [
  {
    name: 'komik', description: 'Rastgele bir şaka API\'sinden komik bir şey getirir', options: [],
    async execute(i) {
      await i.deferReply();
      try {
        const data = await fetchJson('https://official-joke-api.appspot.com/random_joke');
        return i.editReply({ embeds: [emb('😂 Şaka', `**${data.setup}**\n\n*${data.punchline}*`, COLORS.fun)] });
      } catch (_) {
        return i.editReply({ embeds: [emb('😂 Şaka', pick([
          'Neden bilgisayar soğukta durur? Çünkü fanları var!',
          'Programcı ne içer? Java!'
        ]), COLORS.fun)] });
      }
    }
  },
  {
    name: 'saka', description: 'Kullaniciya rastgele bir saka yapar', options: [U('user', 'Şaka yapılacak kullanıcı')],
    async execute(i) {
      const user = i.options.getUser('user');
      const jokes = [
        `**${user}**, seni görünce robotlar bile gülümsüyor 🤖`,
        `**${user}**, bu sunucunun en iyi spam botusun (olumlu anlamda) 🎉`,
        `**${user}**, seni Google'da aradım, sonuç bulunamadı 🔍`,
        `**${user}**, bu kadar iyi olman haksızlık 🏆`
      ];
      return ok(i, '😹 Şaka', pick(jokes));
    }
  },
  {
    name: 'ask-hesap', description: 'Iki kisi arasindaki uyumu hesaplar', options: [U('user1', 'Birinci kişi'), U('user2', 'İkinci kişi')],
    async execute(i) {
      const a = i.options.getUser('user1'), b = i.options.getUser('user2');
      const seed = [...(a.id + b.id)].reduce((s, c) => s + c.charCodeAt(0), 0);
      const pct = (seed % 101);
      const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
      const verdict = pct > 80 ? '💥 Mükemmel uyum!' : pct > 50 ? '😊 İyi gidiyor' : pct > 30 ? '😬 Zorlanabilir' : '❌ Uyumsuz';
      return ok(i, '💞 Uyum', `**${a.tag}** + **${b.tag}**\n\`${bar}\` **%${pct}**\n${verdict}`);
    }
  },
  {
    name: 'seviye', description: 'Eğlence seviyeni ölçer', options: [U('user', 'Seviyesi ölçülecek kişi', false)],
    async execute(i) {
      const user = i.options.getUser('user') || i.user;
      const seed = [...user.id].reduce((s, c) => s + c.charCodeAt(0), 0);
      const lvl = (seed % 100) + 1;
      const titles = lvl > 90 ? '🏆 Efsane' : lvl > 70 ? '⭐ Usta' : lvl > 40 ? '🔰 Orta seviye' : '🐣 Acemi';
      return ok(i, '📈 Seviye', `**${user.tag}**: seviye **${lvl}** — ${titles}`);
    }
  },
  {
    name: 'hug', description: 'Birine sarılırsın 🤗', options: [U('user', 'Sarılacak kişi')],
    async execute(i) {
      const user = i.options.getUser('user');
      return ok(i, '🤗 Sarılma', `**${i.user.tag}**, **${user.tag}**'e sarıldı! 🫂`);
    }
  },
  {
    name: 'pat', description: 'Birine sevgiyle vurursun 🐾', options: [U('user', 'Pat vurulacak kişi')],
    async execute(i) {
      const user = i.options.getUser('user');
      return ok(i, '🐾 Pat', `**${i.user.tag}**, **${user.tag}**'e pat verdi! 💕`);
    }
  },
  {
    name: 'rank', description: 'Gerçek XP ve mesaj istatistiklerini gösterir', options: [U('user', 'Bakılacak kullanıcı', false)],
    async execute(i) {
      const community = require('../community');
      const user = i.options.getUser('user') || i.user;
      const r = community.rank(i.guild.id, user.id);
      const need = Math.max(0, r.nextXp - r.user.xp);
      const bar = '█'.repeat(Math.min(10, Math.floor((r.user.xp % 100) / 10))) + '░'.repeat(Math.max(0, 10 - Math.floor((r.user.xp % 100) / 10)));
      return ok(i, '📈 Rank', `**${user.tag}**\nSeviye: **${r.user.level}** • XP: **${r.user.xp}**\n${bar}\nMesaj: **${r.user.messages}** • Sunucu sırası: **#${r.position}**\nSonraki seviye için: **${need} XP**`);
    }
  },
  {
    name: 'xp-top', description: 'Sunucunun XP liderlik tablosunu gösterir', options: [],
    async execute(i) {
      const community = require('../community');
      const rows = community.top(i.guild.id, 10);
      if (!rows.length) return fail(i, 'Henüz XP verisi yok. Mesajlaşmaya başlayın!');
      return ok(i, '🏆 XP Liderliği', rows.map((u, n) => `${n + 1}. <@${u.userId}> — Lv.${u.level} • ${u.xp} XP • ${u.messages} mesaj`).join('\\n'));
    }
  },
  {
    name: 'haftalik', description: 'Son 7 günün en aktif üyelerini gösterir', options: [],
    async execute(i) {
      const community = require('../community');
      const rows = community.weekly(i.guild.id, 10);
      if (!rows.length) return fail(i, 'Son 7 günde yeterli aktivite yok.');
      return ok(i, '🔥 Haftalık Aktivite', rows.map((u, n) => `${n + 1}. <@${u.userId}> — **${u.messages}** mesaj`).join('\\n'));
    }
  },
  {
    name: 'mesaj-geri-al', description: 'Kendine ait bir komut mesajini geri cektirir', options: [],
    async execute(i) {
      await i.deferReply({ ephemeral: true });
      const msgs = await i.channel.messages.fetch({ limit: 10 }).catch(() => null);
      if (!msgs) return i.editReply('Mesajlar çekilemedi.');
      const mine = msgs.find(m => m.author.id === i.user.id && !m.embeds.length && m.id !== i.followUp);
      if (!mine) return i.editReply('Silinecek uygun mesaj bulamadım.');
      await mine.delete().catch(() => {});
      return i.editReply('✅ Mesaj silindi.');
    }
  },
  { name: 'kus', description: 'Rastgele bir kuş emoji bilgisi verir', options: [],
    async execute(i) {
      const birds = [['🦅','Kartal'],['🦉','Baykuş'],['🦜','Papağan'],['🐧','Penguen'],['🦆','Ördek'],['🕊️','Güvercin'],['🐦','Serçe']];
      const [e,name] = pick(birds); return ok(i, `${e} Kuş`, `Bugünün kuşu: **${name}** ${e}`);
    }
  },
  { name: 'moon', description: 'Ayın evrelerinden birini gösterir', options: [],
    async execute(i) {
      const phases=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘']; return ok(i,'🌙 Ay',`Bugün ay: ${pick(phases)}`);
    }
  },
  {
    name: 'troll', description: 'Masum bir trolleme mesajı yollar', options: [U('user', 'Trollenecek kişi', false)],
    async execute(i) {
      const user = i.options.getUser('user') || i.user;
      const lines = [
        `**${user}**, mesajını 3 kez okudum... hâlâ anlamadım 🤔`,
        `**${user}**, yazdığın şeyi Google bile anlayamadı 📵`,
        `**${user}**, seni affettim ama klavyeni affetmedim ⌨️`
      ];
      return ok(i, '😈 Troll', pick(lines));
    }
  },
  {
    name: 'gif', description: 'Rastgele bir kategori gif\'i önerir', options: [S('kategori', 'Kategori: pat, hug, dance, kiss')],
    async execute(i) {
      const cat = (i.options.getString('kategori') || 'pat').toLowerCase();
      const allowed = ['pat', 'hug', 'dance', 'kiss'];
      if (!allowed.includes(cat)) return fail(i, 'Kategoriler: pat, hug, dance, kiss');
      return ok(i, '🎬 GIF', `**${cat}** kategorisinde gif aranıyor...\nGörmek için: [tenor.com/${cat}](https://tenor.com/search/${cat}-gifs)`);
    }
  },
  {
    name: 'lirik', description: 'Rastgele şarkı sözü parçası gösterir', options: [],
    async execute(i) {
      const lyrics = [
        '"Ironic" — Alanis Morissette: *An old man turned ninety-eight...*\n*He won the lottery and died the next day*',
        '"Lose Yourself" — Eminem: *You only get one shot, do not miss your chance to blow...*',
        '"Bohemian Rhapsody" — Queen: *Is this the real life? Is this just fantasy?*',
        '"Shape of You" — Ed Sheeran: *The club isn\'t the best place to find a lover...*'
      ];
      return ok(i, '🎤 Söz', pick(lyrics));
    }
  },
  {
    name: 'sarki-soz', description: 'Verdigin sarki icin soz arama baglantisi verir', options: [S('sarki', 'Şarkı adı + sanatçı', true)],
    async execute(i) {
      const q = encodeURIComponent(i.options.getString('sarki'));
      return ok(i, '🎵 Şarkı Sözü', `[Genius'ta ara](https://genius.com/search?q=${q})\n[Az lyrics'te ara](https://www.azlyrics.com/search.php?q=${q})`);
    }
  },
  {
    name: 'anime-karakter', description: 'Rastgele bir anime karakteri onerir', options: [],
    async execute(i) {
      const chars = [
        ['Luffy', 'One Piece — hayallerin peşinden koş! 🏴‍☠️'],
        ['Levi', 'Attack on Titan — disiplin her şeydir ⚔️'],
        ['Naruto', 'Naruto — asla pes etme 🍥'],
        ['Saitama', 'One Punch Man — 100 şınav, 100 mekik 🥊'],
        ['Gojo', 'Jujutsu Kaisen — güçlü ol, havalı ol 😎'],
        ['Tanjiro', 'Demon Slayer — iyilik kazanır 🌊']
      ];
      const [name, desc] = pick(chars);
      return ok(i, '🎌 Anime', `**${name}**\n${desc}`);
    }
  }
];

function userTag(i) { return `**${i.user.username}**`; }

module.exports = { commands };
