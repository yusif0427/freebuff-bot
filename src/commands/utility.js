'use strict';
const crypto = require('crypto');
const { emb, ok, fail, reply, COLORS, pick } = require('../helpers');
const { renderCommandList } = require('../imageUi');
const { snapshot: getSnapshot } = require('../stats');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const play = require('play-dl');
const musicState = new Map();
function getMusic(guildId) { return musicState.get(guildId) || null; }
function requireVoice(i) { const ch = i.member?.voice?.channel; if (!ch) { fail(i, '🔊 Önce bir ses kanalına gir.'); return null; } return ch; }
async function playYoutube(i, url) {
  const ch = requireVoice(i); if (!ch) return;
  if (!/^https?:\\/\\/(www\\.)?(youtube\\.com|youtu\\.be)\\//i.test(url)) return fail(i, '❌ Sadece YouTube linki kabul ediyorum.');
  await i.deferReply();
  try {
    const info = await play.video_info(url); const title = info.video_details?.title || 'YouTube';
    const stream = await play.stream(url, { discordPlayerCompatibility: true });
    const old = musicState.get(i.guild.id); if (old?.player) old.player.stop();
    const connection = joinVoiceChannel({ channelId: ch.id, guildId: ch.guild.id, adapterCreator: ch.guild.voiceAdapterCreator, selfDeaf: true });
    const player = createAudioPlayer(); const resource = createAudioResource(stream.stream, { inputType: stream.type });
    player.play(resource); connection.subscribe(player); musicState.set(i.guild.id, { connection, player, title, url });
    player.once(AudioPlayerStatus.Idle, () => { if (musicState.get(i.guild.id)?.player === player) musicState.delete(i.guild.id); });
    connection.on(VoiceConnectionStatus.Disconnected, () => { if (musicState.get(i.guild.id)?.connection === connection) musicState.delete(i.guild.id); });
    return i.editReply({ embeds: [emb('🎵 FREEBUFF Müzik', '▶️ **' + title + '**\\n🔗 ' + url + '\\n🔊 **' + ch.name + '** kanalında çalıyor.', COLORS.info)] });
  } catch (e) { console.error('[music] YouTube oynatma hatası:', e.message); return i.editReply({ embeds: [emb('❌ Müzik Hatası', 'YouTube videosu oynatılamadı. Linki kontrol et veya başka bir video dene.', COLORS.err)] }); }
}


const U = (name, desc, required = true) => ({ name, description: desc, type: 6, required });
const S = (name, desc, required = false) => ({ name, description: desc, type: 3, required });
const I = (name, desc, required = false) => ({ name, description: desc, type: 4, required });

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const commands = [
  {
    name: 'ses-cek', description: 'Bir üyeyi bulunduğun ses kanalına çeker', options: [U('user', 'Çekilecek üye')],
    async execute(i) {
      const channel = requireVoice(i); if (!channel) return;
      if (!i.memberPermissions?.has('MoveMembers')) return fail(i, '❌ Üyeleri taşıma yetkin yok.');
      const user = i.options.getMember('user');
      if (!user?.voice?.channel) return fail(i, '❌ Bu üye bir ses kanalında değil.');
      if (user.id === i.user.id) return fail(i, '😄 Kendini çekemezsin.');
      try { await user.voice.setChannel(channel, 'FREEBUFF /ses-cek'); return ok(i, '🔊 Ses Çekildi', '**' + user.user.username + '** → **' + channel.name + '**'); }
      catch (_) { return fail(i, '❌ Üye taşınamadı. Botun **Move Members** yetkisini kontrol et.'); }
    }
  },
  {
    name: 'muzik', description: 'YouTube linkini ses kanalında oynatır', options: [S('link', 'YouTube video linki', true)],
    async execute(i) { return playYoutube(i, i.options.getString('link')); }
  },
  {
    name: 'muzik-durdur', description: 'Çalan müziği durdurur', options: [],
    async execute(i) { const s=getMusic(i.guild.id); if(!s) return fail(i,'🎵 Şu anda müzik çalmıyor.'); s.player.stop(); s.connection.destroy(); musicState.delete(i.guild.id); return ok(i,'⏹️ Müzik Durduruldu','Bot ses kanalından çıktı.'); }
  },
  {
    name: 'muzik-cikis', description: 'Botu ses kanalından çıkarır', options: [],
    async execute(i) { const s=getMusic(i.guild.id); if(!s) return fail(i,'🔊 Bot bir ses kanalında değil.'); s.player.stop(); s.connection.destroy(); musicState.delete(i.guild.id); return ok(i,'👋 Müzik Botu Çıktı','Ses kanalından ayrıldım.'); }
  },

  {
    name: 'yeniden-baslat', description: 'Sadece Freebuff sunucusunda botu yeniden başlatır', options: [],
    async execute(i) {
      const TARGET_GUILD_ID = '1383133767945945219';

      if (!i.guild || i.guild.id !== TARGET_GUILD_ID) {
        return fail(i, '❌ Bu komut sadece yetkili Freebuff sunucusunda kullanılabilir.');
      }

      if (!i.memberPermissions?.has('Administrator')) {
        return fail(i, '❌ Bu komutu sadece sunucu yöneticisi kullanabilir.');
      }

      await reply(i, emb('🔄 Bot yeniden başlatılıyor', 'Render üzerindeki süreç yeniden başlatılacak. Lütfen birkaç saniye bekle.', COLORS.warn));

      setTimeout(() => {
        console.log('[bot] /yeniden-baslat kullanıldı — süreç kapatılıyor.');
        process.exit(0);
      }, 1500);
    }
  },
  {
    name: 'ping', description: 'Botun gecikmesini (ping) gösterir', options: [],
    async execute(i) {
      const t0 = Date.now();
      const msg = await i.reply({ embeds: [emb('🏓 Ping', 'Ölçülüyor...', COLORS.info)], fetchReply: true });
      const ws = Math.round(i.client.ws.ping);
      const api = Date.now() - t0;
      await msg.edit({ embeds: [emb('🏓 Ping Sonucu', `Websocket: **${ws} ms**\\nAPI: **${api} ms**`, COLORS.ok)] });
    }
  },
  {
    name: 'uptime', description: 'Botun ne kadar süredir açık olduğunu gösterir', options: [],
    async execute(i) {
      const s = process.uptime();
      const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
      return ok(i, '⏱️ Uptime', `**${d}** gün **${h}** saat **${m}** dakika **${sec}** saniye`);
    }
  },
  {
    name: 'yardim', description: 'Komut listesini ve yardım menüsünü gösterir', options: [S('komut', 'Belirli bir komut hakkında bilgi')],
    async execute(i) {
      const disabled = i.client.DISABLED_SLASH_COMMANDS || new Set();
      const active = [...i.client.commands.values()].filter(c => !disabled.has(c.name)).sort((a,b) => a.name.localeCompare(b.name, 'tr'));
      const q = i.options.getString('komut');
      if (q) {
        const key = q.trim().toLowerCase().replace(/^\//, '');
        const c = active.find(x => x.name === key);
        if (!c) return fail(i, '**' + q + '** adlı aktif komut bulunamadı.');
        return ok(i, '🧭 /' + c.name, c.description + (c.options?.length ? '\nParametreler: ' + c.options.map(o => '`' + o.name + '`').join(', ') : ''));
      }
      const groups = {};
      for (const c of active) { const label = i.client.CATEGORY_LABELS?.[c.category] || '📚 Diğer'; (groups[label] ||= []).push(c); }
      const png = await renderCommandList(groups, i.guild?.name || 'FREEBUFF Sunucusu');
      return i.reply({ __skipFreebuffUi: true, content: '📚 **FREEBUFF KOMUTLARI** — Tüm aktif komutlar görselde.', files: [{ attachment: png, name: 'freebuff-komutlar.png' }] });
    }
  },
  {
    name: 'hatirlat', description: 'Seni belirtilen sürede hatırlatır', options: [S('sure', 'Süre (örn: 10m, 2h, 1d)', true), S('neden', 'Hatırlatma sebebi', true)],
    async execute(i) {
      const raw = i.options.getString('sure').trim().toLowerCase();
      const m = raw.match(/^(\d+)\s*(s|m|h|d|sn|dk)?$/);
      if (!m) return fail(i, 'Süre biçimi yanlış. Örnekler: `10m` (10 dk), `2h` (2 saat), `1d` (1 gün).');
      const mult = { s: 1, sn: 1, m: 60, dk: 60, h: 3600, d: 86400 }[m[2] || 'm'];
      const ms = parseInt(m[1], 10) * mult * 1000;
      if (ms < 5000 || ms > 7 * 86400_000) return fail(i, 'Süre 5 saniye ile 7 gün arasında olmalı.');
      const neden = i.options.getString('neden');
      setTimeout(() => {
        i.followUp({ content: `⏰ <@${i.user.id}> **Hatırlatma:** ${neden}` }).catch(() => {
          i.user.send(`⏰ **Hatırlatma:** ${neden}`).catch(() => {});
        });
      }, ms);
      return ok(i, '⏰ Hatırlatıcı kuruldu', `**${raw}** sonra hatırlatacağım.\nSebep: ${neden}`);
    }
  },
  {
    name: 'hesapla', description: 'Basit matematiksel ifadeyi hesaplar', options: [S('ifade', 'Hesaplanacak ifade (örn: 12*4+sqrt(9))', true)],
    async execute(i) {
      const expr = i.options.getString('ifade');
      if (!/^[\d\s+\-*/().%^sqrtcbrt]{1,80}$/i.test(expr)) return fail(i, 'Sadece sayı ve temel operatörler kullanabilirsin.');
      try {
        const safe = expr.replace(/\bqrt\(/g, 'Math.sqrt(').replace(/\^/g, '**');
        const result = Function(`"use strict"; return (${safe})`)();
        if (result === undefined || Number.isNaN(result)) throw new Error('geçersiz');
        return ok(i, '🧮 Sonuç', `\`${expr}\` = **${result}**`);
      } catch (_) {
        return fail(i, 'İfade hesaplanamadı.');
      }
    }
  },
  {
    name: 'cevir', description: 'Metni otomatik olarak çevirir (TR-EN)', options: [S('metin', 'Çevrilecek metin', true)],
    async execute(i) {
      await i.deferReply({ ephemeral: true });
      const text = i.options.getString('metin');
      try {
        const data = await fetchJson('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 480)) + '&langpair=tr|en');
        const out = data.responseData?.translatedText;
        if (!out) throw new Error('boş');
        return i.editReply({ embeds: [emb('🌐 Çeviri', `**Girdi:** ${text}\n**Çıktı:** ${out}`, COLORS.info)] });
      } catch (_) {
        return i.editReply({ embeds: [emb('❌ Hata', 'Çeviri servisine ulaşılamadı.', COLORS.err)] });
      }
    }
  },
  {
    name: 'hava', description: 'Bir şehrin hava durumunu gösterir', options: [S('sehir', 'Şehir adı (örn: Istanbul)', true)],
    async execute(i) {
      await i.deferReply();
      const sehir = i.options.getString('sehir');
      try {
        const data = await fetchJson(`https://wttr.in/${encodeURIComponent(sehir)}?format=j1`);
        const cur = data.current_condition?.[0];
        if (!cur) throw new Error('yok');
        return i.editReply({ embeds: [emb(`🌤️ ${sehir} Hava`, [
          `**Sıcaklık:** ${cur.temp_C}°C (hissedilen ${cur.FeelsLikeC}°C)`,
          `**Durum:** ${cur.weatherDesc?.[0]?.value || '?'}`,
          `**Nem:** ${cur.humidity}%`,
          `**Rüzgar:** ${cur.windspeedKmph} km/s`
        ].join('\n'), COLORS.info)] });
      } catch (_) {
        return i.editReply({ embeds: [emb('❌ Hata', 'Hava durumu alınamadı. Şehir adını kontrol et.', COLORS.err)] });
      }
    }
  },
  {
    name: 'sozluk', description: 'Ingilizce kelime tanimi gosterir', options: [S('kelime', 'Kelime (İngilizce)', true)],
    async execute(i) {
      await i.deferReply({ ephemeral: true });
      const word = i.options.getString('kelime').trim().toLowerCase().replace(/[^a-z-]/g, '');
      if (!word) return i.editReply({ embeds: [emb('❌ Hata', 'Geçerli bir İngilizce kelime gir.', COLORS.err)] });
      try {
        const data = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        const meaning = data[0]?.meanings?.[0];
        const def = meaning?.definitions?.[0]?.definition;
        const ex = meaning?.definitions?.[0]?.example;
        if (!def) throw new Error('yok');
        return i.editReply({ embeds: [emb(`📖 ${word} (${meaning.partOfSpeech})`, `${def}${ex ? `\n*Örnek: ${ex}*` : ''}`, COLORS.info)] });
      } catch (_) {
        return i.editReply({ embeds: [emb('❌ Bulunamadı', `**${word}** kelimesi sözlükte bulunamadı.`, COLORS.err)] });
      }
    }
  },
  {
    name: 'sehir-saat', description: 'Bir sehrin saatini gosterir', options: [S('sehir', 'Şehir (örn: Istanbul, London)', true)],
    async execute(i) {
      const sehir = i.options.getString('sehir');
      const zones = { istanbul: 'Europe/Istanbul', ankara: 'Europe/Istanbul', izmir: 'Europe/Istanbul', london: 'Europe/London', paris: 'Europe/Paris', berlin: 'Europe/Berlin', moscow: 'Europe/Moscow', tokyo: 'Asia/Tokyo', newyork: 'America/New_York', washington: 'America/New_York', la: 'America/Los_Angeles', seoul: 'Asia/Seoul', dubai: 'Asia/Dubai' };
      const tz = zones[sehir.toLowerCase().replace(/\s/g, '')];
      if (!tz) return fail(i, 'Bilinen şehirler: ' + Object.keys(zones).join(', ') + '. Saat dilimini kendin de yazabilirsin (örn: `Europe/Istanbul`).');
      const now = new Date();
      const time = now.toLocaleString('tr-TR', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' });
      return ok(i, `🕐 ${sehir}`, `**${time}**\nDilim: \`${tz}\``);
    }
  },
  {
    name: 'rastgele', description: 'İki sayı arasında rastgele bir sayı seçer', options: [I('min', 'En küçük sayı', true), I('max', 'En büyük sayı', true)],
    async execute(i) {
      let a = i.options.getInteger('min'), b = i.options.getInteger('max');
      if (a > b) [a, b] = [b, a];
      if (b - a > 1e9) return fail(i, 'Aralık çok büyük.');
      const n = a + Math.floor(Math.random() * (b - a + 1));
      return ok(i, '🎲 Rastgele Sayı', `**${n}** (aralık: ${a}-${b})`);
    }
  },
  {
    name: 'sayi-tahmin', description: '1-100 arasi gizli sayiyi tahmin et', options: [I('tahmin', 'Tahminin (1-100)', true)],
    async execute(i) {
      const g = i.options.getInteger('tahmin');
      const secret = i.client.gameSecret || (i.client.gameSecret = Math.floor(Math.random() * 100) + 1);
      if (g === secret) {
        i.client.gameSecret = null;
        return ok(i, '🎉 Doğru!', `Sayı **${secret}** imiş. Bildin!`);
      }
      return ok(i, g < secret ? '⬆️ Yukarı' : '⬇️ Aşağı', `\`${g}\` tahmini ${g < secret ? 'düşük': 'yüksek'}. Gizli sayı ${g < secret ? 'daha büyük': 'daha küçük'}.`);
    }
  },
  {
    name: 'renk-kod', description: 'Hex rengi RGB olarak gosterir', options: [S('hex', 'Hex kodu (örn: #3b82f6)', true)],
    async execute(i) {
      const hex = i.options.getString('hex').replace(/[^#0-9a-fA-F]/g, '');
      const full = hex.startsWith('#') ? hex : '#' + hex;
      if (!/^#[0-9a-fA-F]{6}$/.test(full)) return fail(i, 'Geçerli bir hex kodu gir (#3b82f6 gibi).');
      const r = parseInt(full.slice(1, 3), 16), g = parseInt(full.slice(3, 5), 16), b = parseInt(full.slice(5, 7), 16);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const e = emb('🎨 Renk', `**Hex:** \`${full}\`\n**RGB:** \`${r}, ${g}, ${b}\`\n**Parlaklık:** %${Math.round(lum * 100)} (${lum > 0.5 ? 'açık' : 'koyu'} renk)`, parseInt(full.slice(1), 16));
      e.setColor(parseInt(full.slice(1), 16));
      return i.reply({ embeds: [e] });
    }
  },
  {
    name: 'not', description: 'Kendine not kaydeder / notunu gösterir', options: [S('metin', 'Not (boş bırakırsan notunu gösterir)')],
    async execute(i) {
      const key = i.user.id;
      const store = i.client.noteStore || (i.client.noteStore = {});
      const text = i.options.getString('metin');
      if (text) {
        store[key] = { text, at: Date.now() };
        return ok(i, '📝 Not kaydedildi', text.slice(0, 1500));
      }
      if (!store[key]) return fail(i, 'Kayıtlı notun yok. `/not metin:` ile kaydedebilirsin.');
      return ok(i, '📝 Notun', store[key].text);
    }
  },
  {
    name: 'istatistik', description: 'Botun canlı istatistiklerini gösterir', options: [],
    async execute(i) {
      const s = getSnapshot();
      return ok(i, '📊 Bot İstatistikleri', [
        `**Durum:** ${s.online ? '🟢 Çevrimiçi' : '🔴 Çevrimdışı'}`,
        `**Ping:** ${s.pingMs == null ? '?' : s.pingMs + ' ms'}`,
        `**Uptime:** ${Math.floor(s.uptimeSec / 3600)}s ${Math.floor((s.uptimeSec % 3600) / 60)}d ${s.uptimeSec % 60}sn`,
        `**Sunucu:** ${s.servers} • **Kullanıcı:** ${s.users}`,
        `**Kullanılan komut:** ${s.commandsUsed}`,
        `**Bellek:** ${s.memoryMB} MB`
      ].join('\n'));
    }
  },
  {
    name: 'boostlar', description: 'Sunucu boost bilgisini gösterir', options: [],
    async execute(i) {
      const g = i.guild;
      return ok(i, '💎 Boost', `**Seviye:** ${g.premiumTier}\n**Boost sayısı:** ${g.premiumSubscriptionCount || 0}\n**Faydalar:** ${['yok', '50 emoji/128kb', '100 emoji/256kb', '150 emoji/384kb'][g.premiumTier] || '?'}`);
    }
  },
  {
    name: 'tesekkur', description: 'Bir uyeye tesekkur etmeni kaydeder', options: [U('user', 'Teşekkür edilecek üye'), S('neden', 'Teşekkür sebebi')],
    async execute(i) {
      const user = i.options.getUser('user');
      if (user.id === i.user.id) return fail(i, 'Kendine teşekkür edemezsin 😄');
      const store = i.client.thanksStore || (i.client.thanksStore = {});
      const k = user.id;
      store[k] = (store[k] || 0) + 1;
      return ok(i, '💖 Teşekkür', `<@${user.id}> artık **${store[k]}** teşekkür aldı.${i.options.getString('neden') ? `\nSebep: ${i.options.getString('neden')}` : ''}`);
    }
  }
];

module.exports = { commands };
