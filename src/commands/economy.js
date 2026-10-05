'use strict';
const fs = require('fs');
const path = require('path');
const { ok, fail, rand, pick } = require('../helpers');

const FILE = path.join(__dirname, '..', '..', 'data', 'economy.json');
let db = {};
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (_) {}
function save() {
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); } catch (_) {}
}
function acc(id) {
  if (!db[id]) db[id] = { coins: 100, bank: 0, inv: [], lastDaily: 0, lastWork: 0, lastHourly: 0 };
  return db[id];
}
const fmt = (n) => n.toLocaleString('tr-TR');

const U = (name, desc, required = true) => ({ name, description: desc, type: 6, required });
const S = (name, desc, required = false) => ({ name, description: desc, type: 3, required });
const I = (name, desc, required = false) => ({ name, description: desc, type: 4, required });

const SHOP = [
  { id: 'kalem', name: '✏️ Kalem', price: 50 },
  { id: 'kitap', name: '📕 Kitap', price: 150 },
  { id: 'kupa', name: '🏆 Kupa', price: 1000 },
  { id: 'araba', name: '🚗 Araba', price: 25000 },
  { id: 'ev', name: '🏠 Ev', price: 150000 },
  { id: 'roket', name: '🚀 Roket', price: 500000 }
];

const commands = [
  {
    name: 'bakiye', description: 'Coin bakiyeni gösterir', options: [U('user', 'Başkasının bakiyesi', false)],
    async execute(i) {
      const user = i.options.getUser('user') || i.user;
      const a = acc(user.id);
      return ok(i, '💰 Bakiye', `**${user.tag}**\nCüzdan: **${fmt(a.coins)}** coin\nBanka: **${fmt(a.bank)}** coin\nToplam: **${fmt(a.coins + a.bank)}** coin`);
    }
  },
  {
    name: 'gunluk', description: 'Günlük ödülünü al (24 saatte bir)', options: [],
    async execute(i) {
      const a = acc(i.user.id);
      const day = 86400_000;
      const left = a.lastDaily + day - Date.now();
      if (left > 0) return fail(i, `Günlük ödülün hazır değil. Kalan: **${Math.ceil(left / 3600000)}** saat.`);
      const reward = 200 + rand(301);
      a.coins += reward;
      a.lastDaily = Date.now();
      save();
      return ok(i, '🎁 Günlük Ödül', `**${fmt(reward)}** coin kazandın!\nCüzdan: **${fmt(a.coins)}** coin`);
    }
  },
  {
    name: 'calis', description: 'Çalışıp coin kazan (2 saatte bir)', options: [],
    async execute(i) {
      const a = acc(i.user.id);
      const cd = 2 * 3600_000;
      const left = a.lastWork + cd - Date.now();
      if (left > 0) return fail(i, `Yorgunsun. **${Math.ceil(left / 60000)}** dakika bekle.`);
      const jobs = [
        ['Öğretmenlik yaptın', 300], ['Kuryelik yaptın', 250], ['Yazılım yazdın', 600],
        ['Garsonluk yaptın', 200], ['Temizlik yaptın', 180], ['DJ\'lik yaptın', 450],
        ['Anketörlük yaptın', 220], ['Çeviri yaptın', 380]
      ];
      const [desc, pay] = pick(jobs);
      const bonus = rand(100);
      a.coins += pay + bonus;
      a.lastWork = Date.now();
      save();
      return ok(i, '💼 Çalışma', `${desc} ve **${fmt(pay + bonus)}** coin kazandın! (base ${pay} + bahşiş ${bonus})`);
    }
  },
  {
    name: 'saatlik', description: 'Saatlik bonusunu al (60 dakikada bir)', options: [],
    async execute(i) {
      const a = acc(i.user.id);
      const cd = 3600_000;
      const left = a.lastHourly + cd - Date.now();
      if (left > 0) return fail(i, `Saatlik bonus hazır değil. **${Math.ceil(left / 60000)}** dakika bekle.`);
      const reward = 50 + rand(51);
      a.coins += reward;
      a.lastHourly = Date.now();
      save();
      return ok(i, '⏰ Saatlik Bonus', `**${fmt(reward)}** coin aldın!`);
    }
  },
  {
    name: 'transfer', description: 'Başkasına coin gönderir', options: [U('user', 'Alıcı'), I('miktar', 'Gönderilecek miktar', true)],
    async execute(i) {
      const target = i.options.getUser('user');
      const amount = i.options.getInteger('miktar');
      if (target.id === i.user.id) return fail(i, 'Kendine transfer yapamazsın.');
      if (amount <= 0) return fail(i, 'Miktar pozitif olmalı.');
      const a = acc(i.user.id), b = acc(target.id);
      if (a.coins < amount) return fail(i, `Yetersiz bakiye. Elinde **${fmt(a.coins)}** coin var.`);
      a.coins -= amount;
      b.coins += amount;
      save();
      return ok(i, '💸 Transfer', `**${fmt(amount)}** coin → **${target.tag}**\nYeni bakiyen: **${fmt(a.coins)}**`);
    }
  },
  {
    name: 'banka', description: 'Parayı bankaya yatır / çek', options: [S('islem', 'yatir veya cek', true), I('miktar', 'Miktar (0 = hepsi)', true)],
    async execute(i) {
      const a = acc(i.user.id);
      const islem = (i.options.getString('islem') || '').toLowerCase();
      let amount = i.options.getInteger('miktar') || 0;
      if (islem === 'yatir') {
        if (amount <= 0) amount = a.coins;
        if (amount > a.coins) return fail(i, 'Elinde bu kadar yok.');
        a.coins -= amount; a.bank += amount;
        save();
        return ok(i, '🏦 Yatırıldı', `**${fmt(amount)}** coin bankaya yatırıldı. Banka: **${fmt(a.bank)}**`);
      } else if (islem === 'cek') {
        if (amount <= 0) amount = a.bank;
        if (amount > a.bank) return fail(i, 'Bankada bu kadar yok.');
        a.bank -= amount; a.coins += amount;
        save();
        return ok(i, '🏧 Çekildi', `**${fmt(amount)}** coin çekildi. Cüzdan: **${fmt(a.coins)}**`);
      }
      return fail(i, 'İşlem: `yatir` veya `cek` olmalı.');
    }
  },
  {
    name: 'magaza', description: 'Mağazadaki ürünleri listeler', options: [],
    async execute(i) {
      const lines = SHOP.map(s => `${s.name} — **${fmt(s.price)}** coin (\`${s.id}\`)`).join('\n');
      return ok(i, '🛒 Mağaza', lines + '\n\nSatın almak: `/satin-al urun:` yaz.');
    }
  },
  {
    name: 'satin-al', description: 'Mağazadan ürün satın alır', options: [S('urun', 'Ürün ID (mağazaya bak)', true)],
    async execute(i) {
      const a = acc(i.user.id);
      const id = (i.options.getString('urun') || '').toLowerCase();
      const item = SHOP.find(s => s.id === id);
      if (!item) return fail(i, 'Geçersiz ürün. `/magaza` yazarak listeye bak.');
      if (a.coins < item.price) return fail(i, `Yetersiz bakiye. **${item.name}** ${fmt(item.price)} coin, sende **${fmt(a.coins)}** var.`);
      a.coins -= item.price;
      a.inv.push(item.id);
      save();
      return ok(i, '🛍️ Satın Alındı', `${item.name} satın alındı!\nCüzdan: **${fmt(a.coins)}** coin`);
    }
  },
  {
    name: 'envanter', description: 'Eşyalarını listeler', options: [],
    async execute(i) {
      const a = acc(i.user.id);
      if (!a.inv.length) return ok(i, '🎒 Envanter', "Envanterin boş. /magaza'ye git, bir şey al!");
      const counts = {};
      a.inv.forEach(x => counts[x] = (counts[x] || 0) + 1);
      const lines = Object.entries(counts).map(([id, n]) => {
        const item = SHOP.find(s => s.id === id);
        return `${item ? item.name : id} ×${n}`;
      }).join('\n');
      return ok(i, '🎒 Envanter', lines);
    }
  },
  {
    name: 'siralama', description: 'Zenginlik sıralamasını gösterir', options: [],
    async execute(i) {
      const top = Object.entries(db)
        .map(([id, a]) => ({ id, total: a.coins + a.bank }))
        .sort((x, y) => y.total - x.total)
        .first || null;
      const sorted = Object.entries(db).map(([id, a]) => ({ id, total: a.coins + a.bank })).sort((x, y) => y.total - x.total).slice(0, 10);
      if (!sorted.length) return fail(i, 'Henüz kimse para kazanmamış.');
      const lines = [];
      const medals = ['🥇', '🥈', '🥉'];
      for (let k = 0; k < sorted.length; k++) {
        let name;
        try { const u = await i.client.users.fetch(sorted[k].id); name = u.tag; } catch (_) { name = sorted[k].id; }
        lines.push(`${medals[k] || (k + 1) + '.'} **${name}** — ${fmt(sorted[k].total)} coin`);
      }
      return ok(i, '🏆 Zenginlik Sıralaması', lines.join('\n'));
    }
  },
  {
    name: 'kumar', description: 'Coin ile kumar oyna (riskli)', options: [I('miktar', 'Bahis miktarı', true)],
    async execute(i) {
      const a = acc(i.user.id);
      const amount = i.options.getInteger('miktar');
      if (amount <= 0) return fail(i, 'Miktar pozitif olmalı.');
      if (amount > a.coins) return fail(i, `Yetersiz bakiye (**${fmt(a.coins)}**).`);
      const roll = rand(100);
      if (roll < 45) {
        a.coins -= amount;
        save();
        return ok(i, '🎰 Kumar', `Kaybettin! **${fmt(amount)}** coin gitti. (kalan: ${fmt(a.coins)})`);
      } else if (roll < 85) {
        const win = Math.floor(amount * 1.5);
        a.coins += win;
        save();
        return ok(i, '🎰 Kumar', `Kazandın! **+${fmt(win)}** coin. (kalan: ${fmt(a.coins)})`);
      } else {
        const win = amount * 3;
        a.coins += win;
        save();
        return ok(i, '🎰 Kumar', `BÜYÜK KAZANÇ! **+${fmt(win)}** coin! 🎉 (kalan: ${fmt(a.coins)})`);
      }
    }
  },
  {
    name: 'maden', description: 'Maden kazarak cevher topla (3 saatte bir)', options: [],
    async execute(i) {
      const a = acc(i.user.id);
      const cd = 3 * 3600_000;
      if (a.lastMaden && a.lastMaden + cd > Date.now()) return fail(i, `Yer yorgun. **${Math.ceil((a.lastMaden + cd - Date.now()) / 60000)}** dk bekle.`);
      const finds = [
        ['🥇 Altın', 900], ['🥈 Gümüş', 400], ['⛏️ Demir', 250], ['💎 Elmas', 2500], ['🪨 Çakıl', 50], ['💀 Boş çıktın', 0]
      ];
      const [what, pay] = pick(finds);
      a.coins += pay;
      a.lastMaden = Date.now();
      save();
      return ok(i, '⛏️ Maden', `${what} buldun! ${pay ? `**+${fmt(pay)}** coin` : 'Hiçbir şey çıkmadı.'}`);
    }
  },
  {
    name: 'balik', description: 'Balık tut (1 saatte bir)', options: [],
    async execute(i) {
      const a = acc(i.user.id);
      const cd = 3600_000;
      if (a.lastBalik && a.lastBalik + cd > Date.now()) return fail(i, `Oltan ıslak. **${Math.ceil((a.lastBalik + cd - Date.now()) / 60000)}** dk bekle.`);
      const fish = [
        ['🐟 Hamsi', 30], ['🐠 Altın balık', 500], ['🐡 Balon balığı', 80], ['🦈 Köpekbalığı', 1200],
        ['👢 Eski çizme', 5], ['👢 İki eski çizme', 10], ['🐋 Balina', 3000]
      ];
      const [what, pay] = pick(fish);
      a.coins += pay;
      a.lastBalik = Date.now();
      save();
      return ok(i, '🎣 Balık', `${what} tuttun! **+${fmt(pay)}** coin`);
    }
  },
  {
    name: 'hirsiz', description: 'Birinden çalmayı dene (riskli!)', options: [U('user', 'Hedef üye')],
    async execute(i) {
      const target = i.options.getUser('user');
      if (target.id === i.user.id) return fail(i, 'Kendinden çalamazsın.');
      const a = acc(i.user.id), b = acc(target.id);
      const r = rand(100);
      if (r < 35) {
        const penalty = Math.min(a.coins, 500);
        a.coins -= penalty;
        save();
        return ok(i, '🚨 Yakalandın!', `Polis seni yakaladı! **${fmt(penalty)}** coin ceza ödedin.`);
      } else if (r < 70) {
        const loot = Math.min(b.coins, 200 + rand(800));
        b.coins -= loot;
        a.coins += loot;
        save();
        return ok(i, '🥷 Hırsızlık', `**${target.tag}**'den **${fmt(loot)}** coin çaldın!`);
      }
      return ok(i, '😅 Boş', 'Kimseyi bulamadın, ellerin boş döndün.');
    }
  },
  {
    name: 'odul', description: 'Birine bahşiş / ödül verir', options: [U('user', 'Ödül verilecek'), I('miktar', 'Miktar', true)],
    async execute(i) {
      const target = i.options.getUser('user');
      const amount = i.options.getInteger('miktar');
      if (amount <= 0) return fail(i, 'Miktar pozitif olmalı.');
      if (target.id === i.user.id) return fail(i, 'Kendine ödül veremezsin.');
      const a = acc(i.user.id), b = acc(target.id);
      if (a.coins < amount) return fail(i, 'Yetersiz bakiye.');
      a.coins -= amount;
      b.coins += amount;
      save();
      return ok(i, '🎁 Ödül', `**${target.tag}** kullanıcısına **${fmt(amount)}** coin ödül verdin!`);
    }
  }
];

module.exports = { commands };
