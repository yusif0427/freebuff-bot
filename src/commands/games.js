'use strict';
const { emb, ok, fail, reply, COLORS, rand, pick } = require('../helpers');

const S = (name, desc, required = false) => ({ name, description: desc, type: 3, required });
const I = (name, desc, required = false) => ({ name, description: desc, type: 4, required });

const WORDS = ['elma', 'armut', 'kitap', 'kalem', 'masa', 'deniz', 'güneş', 'yıldız', 'orman', 'çicek', 'kedi', 'köpek', 'kuş', 'balık', 'rıza', 'şeker', 'çikolata', 'pencere', 'kapı', 'anahtar', 'bilgisayar', 'telefon', 'müzik', 'resim', 'oyun', 'spor', 'yemek', 'su', 'ateş', 'hava'];
const TRICKS = ['Bir kuş', 'Elma', 'Ay', 'Deniz', 'Kedi', 'Güneş', 'Top', 'Çiçek', 'Yıldız', 'Kitap'];

const commands = [
  {
    name: 'zar', description: 'Zar atar (1-6)', options: [],
    async execute(i) {
      const n = rand(6) + 1;
      const dice = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][n - 1];
      return ok(i, '🎲 Zar', `${dice} **${n}** attın!`);
    }
  },
  {
    name: 'tas-kagit-makas', description: 'Botla taş-kağıt-makas oyna', options: [S('secim', 'Seçimin: tas, kagit veya makas', true)],
    async execute(i) {
      const choices = ['tas', 'kagit', 'makas'];
      const user = (i.options.getString('secim') || '').toLowerCase().replace('ş', 's').replace('ı', 'i');
      if (!choices.includes(user)) return fail(i, 'Seçim: `tas`, `kagit` veya `makas` olmalı.');
      const bot = pick(choices);
      const icon = { tas: '🪨', kagit: '📄', makas: '✂️' };
      const beats = { tas: 'makas', kagit: 'tas', makas: 'kagit' };
      const result = bot === user ? '🤝 Berabere!' : beats[user] === bot ? '🏆 Kazandın!' : '💀 Kaybettin!';
      return ok(i, '✊ Taş Kağıt Makas', `Sen: ${icon[user]} **${user}**\nBot: ${icon[bot]} **${bot}**\n\n${result}`);
    }
  },
  {
    name: '8ball', description: 'Sihirli 8ball sorunu yanıtlar', options: [S('soru', 'Soru', true)],
    async execute(i) {
      const yes = ['Kesinlikle evet', 'Evet', 'Büyük ihtimalle', 'Kesinlikle', 'Olabilir', 'Sanırım evet'];
      const no = ['Kesinlikle hayır', 'Hayır', 'Büyük ihtimalle hayır', 'Asla', 'Sanırım hayır'];
      const maybe = ['Belki', 'Söyleyemem', 'Sonra tekrar sor', 'Kesin değil', 'Tahminim yok'];
      const pool = /(^|\s)(hayır|nere)/i.test(i.options.getString('soru')) ? no : pick([yes, no, maybe]);
      return ok(i, '🎱 Sihirli 8 Ball', `**Soru:** ${i.options.getString('soru')}\n**Cevap:** ${pick(pool)}`);
    }
  },
  {
    name: 'kelime-tahmin', description: 'Gizli harfli kelimeyi tahmin et', options: [S('harf', 'Tahmin ettiğin harf veya kelime', true)],
    async execute(i) {
      const st = i.client.wordGame || (i.client.wordGame = { word: pick(WORDS), guessed: [], tries: 0 });
      const guess = (i.options.getString('harf') || '').toLowerCase().trim();
      if (guess === st.word) {
        i.client.wordGame = null;
        return ok(i, '🎉 Doğru!', `Kelime **${st.word}** idi, bildin!`);
      }
      if (guess.length === 1 && !st.guessed.includes(guess)) st.guessed.push(guess);
      st.tries++;
      if (st.tries >= 8) { i.client.wordGame = null; return ok(i, '💀 Bitti', `Kelime **${st.word}** idi. Yeni oyun: /kelimeTahmin`); }
      const masked = [...st.word].map(c => (c === ' ' || st.guessed.includes(c) ? c : '⬛')).join('');
      return ok(i, '🔤 Kelime Tahmin', `Kalan hak: **${8 - st.tries}**\nŞu anki: \`${masked}\`\nDenenen harfler: ${st.guessed.join(', ') || '-'}\n(Tekrar dene ya da kelimeyi yaz)`);
    }
  },
  {
    name: 'carpim-tablosu', description: 'Carpim tablosundan soru sorar', options: [],
    async execute(i) {
      const a = rand(9) + 1, b = rand(9) + 1;
      i.client.mathQuiz = { answer: a * b, at: Date.now() };
      return ok(i, '✖️ Çarpım Tablosu', `**${a} × ${b} = ?**\n(Doğru cevabı yaz, 60 saniyen var)`);
    }
  },
  {
    name: 'sansli-sayi', description: 'Bugunun sansli sayisini verir', options: [],
    async execute(i) {
      const today = new Date().toISOString().slice(0, 10);
      const seed = [...today].reduce((s, c) => s + c.charCodeAt(0), 0);
      const lucky = (seed % 99) + 1;
      return ok(i, '🍀 Şanslı Sayı', `Bugünün şanslı sayısı: **${lucky}**\n(1-100 arası, şansına)`);
    }
  },
  {
    name: 'hafiza-emoji', description: 'Emoji hafiza oyunu — sirayi tahmin et', options: [],
    async execute(i) {
      const set = ['😀', '🍕', '🚀', '🐱', '🌈', '⚽', '🍩', '🎧'];
      const seq = Array.from({ length: 4 }, () => pick(set));
      i.client.memSeq = seq;
      return ok(i, '🧠 Hafıza', `Bu sırayı ezberle: ${seq.join(' ')}\n\nŞimdi ters sıraya göre tek tek yaz (boşlukla ayır). 60 saniyen var.`);
    }
  },
  {
    name: 'yazi-tura', description: 'Yazi-tura atar', options: [],
    async execute(i) {
      const r = rand(2) === 0 ? '🪙 **Yazı**' : '🥈 **Tura**';
      return ok(i, '🪙 Yazı Tura', `${r} geldi!`);
    }
  },
  {
    name: 'sayi-ezber', description: 'Gosterilen sayiyi ezberle, sonra gir', options: [],
    async execute(i) {
      const n = String(rand(100000));
      await reply(i, emb('🧠 Sayı Ezber', 'Ezberle: **\`' + n + '\`**\\n5 saniye sonra gizlenecek.', COLORS.info), true);
      setTimeout(() => i.deleteReply().catch(() => {}), 5000);
      i.client.memoryNum = n;
      setTimeout(() => { i.client.memoryNum = null; }, 60_000);
    }
  },
  {
    name: 'sira-bul', description: 'Siradaki sayiyi tahmin et (desen)', options: [I('tahmin', 'Tahminin', true)],
    async execute(i) {
      const st = i.client.series || (i.client.series = { start: rand(50), step: rand(9) + 2, round: 1 });
      const expected = st.start + st.step * st.round;
      const guess = i.options.getInteger('tahmin');
      if (guess === expected) {
        st.round++;
        const next = st.start + st.step * st.round;
        return ok(i, '✅ Doğru!', `Desen: adım **${st.step}**. Sıradaki: ?\n(${next - st.step} sonrası... devam!)`);
      }
      st.round = 1;
      st.start = rand(50);
      st.step = rand(9) + 2;
      return fail(i, `Yanlış! Doğrusu **${expected}** idi. Yeni tur: ${st.start}, ${st.start + st.step}, ${st.start + 2 * st.step}, ?`);
    }
  },
  {
    name: 'karisik-kelime', description: 'Karışık harfleri düzelt, kelimeyi bul', options: [],
    async execute(i) {
      const w = pick(WORDS);
      const scrambled = [...w].sort(() => Math.random() - 0.5).join('');
      i.client.scramble = w;
      i.client.scrambleAt = Date.now();
      return ok(i, '🔀 Karışık Kelime', `Bu kelimeyi çöz: \`${scrambled}\`\n(60 saniye içinde cevapla)`, COLORS.fun);
    }
  },
  {
    name: 'bilmece', description: 'Rastgele bir bilmece sorar', options: [],
    async execute(i) {
      const riddles = [
        ['Ben ne kadar yaşarsam yaşayayım, hiç büyümem. Neyim?', 'Saat'],
        ['Suyu var, canı yok; gider ağlar, gelir oynar. Neyim?', 'Bulut'],
        ['Dört ayakli, yazması yok; konuşur, cevap verir. Neyim?', 'Köpek'],
        ['Gündüz gizlenir, gece görünür. Neyim?', 'Yıldız'],
        ['Hiç düşmeyen şey nedir?', 'Hesap hatası']
      ];
      const [q, a] = pick(riddles);
      i.client.riddle = a;
      i.client.riddleAt = Date.now();
      return ok(i, '🧩 Bilmece', `**${q}**\n(Cevabı yaz, 60 saniyen var)`, COLORS.fun);
    }
  },
  {
    name: 'dogru-mi', description: 'Doğru/Yanlış sorusu — evet/hayır yaz cevapla', options: [],
    async execute(i) {
      const qs = [
        ['Gökkuşağında 7 renk vardır.', true],
        ['Su 100 derecede kaynar (deniz seviyesinde).', true],
        ['Ay, kendi ışığını üretir.', false],
        ['İnsanın 4 kolu vardır.', false],
        ['Bal araları altıgen petek yapar.', true]
      ];
      const [q, ans] = pick(qs);
      i.client.tfAnswer = ans;
      i.client.tfAt = Date.now();
      return ok(i, '✅❌ Doğru mu?', `**${q}**\n(\`evet\` veya \`hayır\` yaz, 60 saniyen var)`, COLORS.fun);
    }
  },
  {
    name: 'emoji-bil', description: 'Emoji kombinasyonunun ne olduğunu tahmin et', options: [],
    async execute(i) {
      const items = [
        ['🍕🍔🍟', 'Fast food'],
        ['⚽🏀🏈', 'Top sporları'],
        ['🐶🐱🐰', 'Evcil hayvanlar'],
        ['🌞🌧️⚡', 'Hava durumu'],
        ['🎸🥁🎺', 'Müzik aletleri'],
        ['🚀🌍👽', 'Uzay']
      ];
      const [emojis, answer] = pick(items);
      i.client.emojiQuiz = answer;
      i.client.emojiAt = Date.now();
      return ok(i, '🧩 Emoji Bil', `Şu emoji grubu neyi anlatıyor? ${emojis}\n(60 saniye içinde cevapla)`, COLORS.fun);
    }
  },
  {
    name: 'sansli-cark', description: 'Şanslı çarkı çevir', options: [],
    async execute(i) {
      const outcomes = [
        '🎉 **1000 coin!**','😺 **Bir kedi kazandın!**','💀 **Hiçbir şey**','🍀 **Tekrar dene**',
        '⭐ **500 coin!**','🎁 **Sürpriz kutu**','🔥 **Jackpot: 5000 coin!**','🐣 **Bir tavuk kazandın!**'
      ];
      return ok(i, '🎡 Şanslı Çark', `Çark döndü... ${pick(outcomes)}`, COLORS.fun);
    }
  },
  {
    name: 'kart-savas', description: 'Botla kart savaşı yap (kartını seç)', options: [S('kart', 'Kart adı: ejderha, kurt, kedi, kartal, ayi', true)],
    async execute(i) {
      const power = { ejderha: 95, kurt: 75, kartal: 70, ayi: 85, kedi: 55 };
      const pick2 = (i.options.getString('kart') || '').toLowerCase();
      if (!(pick2 in power)) return fail(i, 'Kartlar: ejderha, kurt, kedi, kartal, ayi');
      const botCard = pick(Object.keys(power));
      const p = power[pick2] + rand(30), b = power[botCard] + rand(30);
      const result = p > b ? '🏆 **Kazandın!**' : p < b ? '💀 **Kaybettin!**' : '🤝 **Berabere!**';
      return ok(i, '🃏 Kart Savaşı', `Sen: **${pick2}** (güç ${p})\nBot: **${botCard}** (güç ${b})\n\n${result}`, COLORS.fun);
    }
  },
  {
    name: 'kaplumbaga-yarisi', description: 'Kaplumbağa yarışı — kendi kaplumbağanı seç', options: [S('secim', 'Kaplumbağa: kirmizi, mavi, yesil, sari', true)],
    async execute(i) {
      const lanes = ['kirmizi', 'mavi', 'yesil', 'sari'];
      const sel = (i.options.getString('secim') || '').toLowerCase();
      if (!lanes.includes(sel)) return fail(i, 'Seçim: kirmizi, mavi, yesil veya sari');
      const scores = {};
      lanes.forEach(l => scores[l] = rand(100));
      const winner = Object.entries(scores).sort((a, b2) => b2[1] - a[1])[0][0];
      const icons = { kirmizi: '🐢', mavi: '🐢', yesil: '🐢', sari: '🐢' };
      const board = lanes.map(l => `${icons[l]} ${l}: ${'█'.repeat(Math.ceil(scores[l] / 10))} ${scores[l]}%`).join('\n');
      return ok(i, '🏁 Kaplumbağa Yarışı', `${board}\n\nKazanan: **${winner}** ${sel === winner ? '— senin seçtin! 🎉' : ''}`, COLORS.fun);
    }
  },
  {
    name: 'hizli-toplama', description: '15 saniyede cevaplaman gereken toplama sorusu', options: [],
    async execute(i) {
      const a = 10 + rand(90), b = 10 + rand(90);
      i.client.quickMath = { answer: a + b, at: Date.now() };
      return ok(i, '⚡ Hızlı Toplama', `**${a} + ${b} = ?**\n(15 saniye içinde cevapla!)`, COLORS.fun);
    }
  },
  {
    name: 'zar-yarisi', description: 'Botla zar yarışı — en yüksek toplamı kazanır', options: [],
    async execute(i) {
      const mine = [rand(6) + 1, rand(6) + 1];
      const bots = [rand(6) + 1, rand(6) + 1];
      const ms = mine[0] + mine[1], bs = bots[0] + bots[1];
      const res = ms > bs ? '🏆 **Kazandın!**' : ms < bs ? '💀 **Kaybettin!**' : '🤝 **Berabere!**';
      return ok(i, '🎲 Zar Yarışı', `Sen: ${mine[0]} + ${mine[1]} = **${ms}**\nBot: ${bots[0]} + ${bots[1]} = **${bs}**\n\n${res}`, COLORS.fun);
    }
  }
];

module.exports = { commands, WORDS, TRICKS };
