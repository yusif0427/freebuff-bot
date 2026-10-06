'use strict';
const { rand, pick } = require('./helpers');
const suggestions = require('./suggestions');

// Prefix commands: message-based fallbacks so total command count > 100
const coins = {};

const commands = {
  ping: (msg) => msg.reply(`🏓 **Pong!** WS: **${Math.round(msg.client.ws.ping)} ms** • gecikme: **${Date.now() - msg.createdTimestamp} ms**`),
  uptime: (msg) => {
    const s = Math.floor(process.uptime());
    return msg.reply(`⏱️ **${Math.floor(s / 3600)}** saat **${Math.floor((s % 3600) / 60)}** dakika açık`);
  },
  help: (msg) => msg.reply([
    '📚 **Komutlar** (prefix: `!`)',
    'Yardımcı: `!ping !uptime !help !avatar !sehir !emoji !zaman !bilgi !komutSayi`',
    'Eğlence: `!zar !yazitura !8ball !asikarsin !seviye !terscevir !saka !gif !sarki`',
    'Moderasyon: `!ban !kick !mute !uyari !temizle !kilit !yavas`',
    'Öneri: mesajı yanıtlayıp .kabul yaz (Yönetici)',
    'Ekonomi: `!bakiye !gunluk !calis !transfer !siralama`',
    'Toplam **130** komut var — tam liste için `/yardim` yaz.'
  ].join('\n')),
  avatar: async (msg) => {
    const u = msg.mentions.users.first() || msg.author;
    return msg.reply({ content: `🖼️ **${u.tag}**: ${u.displayAvatarURL({ size: 512, dynamic: true })}` });
  },
  sehir: async (msg, args) => {
    if (!args[0]) return msg.reply('Kullanım: `!sehir Istanbul`');
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(args[0])}?format=j1`);
      const d = await res.json();
      const c = d.current_condition[0];
      return msg.reply(`🌤️ **${args[0]}**: ${c.temp_C}°C (hissedilen ${c.FeelsLikeC}°C), ${c.weatherDesc[0].value}, nem %${c.humidity}`);
    } catch (_) { return msg.reply('Hava durumu alınamadı.'); }
  },
  emoji: (msg) => msg.reply(`${pick(['😀', '😂', '🥺', '😎', '🤔', '🥳', '😱', '🤩', '😴', '🙃'])}`),
  zaman: (msg) => msg.reply(`🕐 Şu an: **${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}** (İstanbul)`),
  bilgi: (msg) => msg.reply([
    `📡 **Sunucu:** ${msg.guild.name}`,
    `👥 Üye: **${msg.guild.memberCount}**`,
    `📄 Kanal: **${msg.guild.channels.cache.size}**`,
    `🎭 Rol: **${msg.guild.roles.cache.size}**`,
    `📅 Kuruluş: ${msg.guild.createdAt.toLocaleDateString('tr-TR')}`
  ].join('\n')),
  komutsayi: (msg) => msg.reply('🔢 Bu botda **100** slash + **30** prefix komutu var (toplam **130**).'),

  zar: (msg) => msg.reply(`🎲 **${rand(6) + 1}** attın!`),
  yazitura: (msg) => msg.reply(rand(2) === 0 ? '🪙 **Yazı**!' : '🪙 **Tura**!'),
  '8ball': (msg, args) => {
    if (!args.length) return msg.reply('Bir soru yaz! `!8ball bugün hava nasıl`');
    const ans = ['Kesinlikle evet', 'Evet', 'Hayır', 'Asla', 'Belki', 'Söyleyemem', 'Kesinlikle hayır', 'Olabilir'];
    return msg.reply(`🎱 ${pick(ans)}`);
  },
  asikarsin: (msg) => {
    const u = msg.mentions.users.first();
    if (!u) return msg.reply('Birini etiketle! `!asikarsin @user`');
    const pct = rand(101);
    return msg.reply(`💞 **${msg.author.username}** + **${u.username}** = **%${pct}** ${pct > 70 ? '💖' : pct > 40 ? '😊' : '💔'}`);
  },
  seviye: (msg) => {
    const u = msg.mentions.users.first() || msg.author;
    const lvl = (rand(100) + 1);
    return msg.reply(`📈 **${u.username}** seviye **${lvl}** — ${lvl > 80 ? 'Efsane ⭐' : lvl > 50 ? 'İyi 👍' : 'Gelişiyor 🌱'}`);
  },
  terscevir: (msg, args) => {
    if (!args.length) return msg.reply('Kullanım: `!terscevir merhaba`');
    return msg.reply(`🔁 **${args.join(' ').split('').reverse().join('')}**`);
  },
  saka: (msg) => msg.reply(pick([
    'Bilgisayar neden soğukta durur? Çünkü **fan**ları var! 🥶',
    'Programcı ne içer? **Java**! ☕',
    'En iyi debug aracı nedir? **println()** 😄',
    'Yazılımcıda kaç tane kahve vardır? **Bir tane, gerisi boş** ☕'
  ])),
  gif: (msg, args) => msg.reply(`🎬 **${(args[0] || 'fun')}** gif'i: https://tenor.com/search/${encodeURIComponent(args[0] || 'fun')}-gifs`),
  sarki: (msg, args) => msg.reply(`🎵 Aradığın şarkı: https://www.youtube.com/results?search_query=${encodeURIComponent(args.join(' ') || 'müzik')}`),

  ban: async (msg, args) => {
    if (!msg.member.permissions.has('BanMembers')) return msg.reply('Yetkin yok.');
    const u = msg.mentions.users.first();
    if (!u) return msg.reply('Birini etiketle. `!ban @user`');
    await msg.guild.members.ban(u.id, { reason: args.join(' ') || 'Komutla ban' }).catch(e => msg.reply('Ban başarısız: ' + e.message));
    return msg.reply(`🔨 **${u.tag}** yasaklandı.`);
  },
  kick: async (msg, args) => {
    if (!msg.member.permissions.has('KickMembers')) return msg.reply('Yetkin yok.');
    const m = msg.mentions.members.first();
    if (!m) return msg.reply('Birini etiketle. `!kick @user`');
    await m.kick(args.join(' ') || 'Komutla atıldı').catch(e => msg.reply('Atılamadı: ' + e.message));
    return msg.reply(`👢 **${m.user.tag}** atıldı.`);
  },
  mute: async (msg, args) => {
    if (!msg.member.permissions.has('ModerateMembers')) return msg.reply('Yetkin yok.');
    const m = msg.mentions.members.first();
    if (!m) return msg.reply('Birini etiketle. `!mute @user 10` (dakika)');
    const mins = parseInt(args.filter(a => /^\d+$/.test(a))[0] || '10', 10);
    await m.timeout(Math.min(mins, 40320) * 60000, 'Komutla susturuldu').catch(e => msg.reply('Susturulamadı: ' + e.message));
    return msg.reply(`🔇 **${m.user.tag}** ${mins} dk susturuldu.`);
  },
  uyari: (msg) => {
    if (!msg.member.permissions.has('ManageMessages')) return msg.reply('Yetkin yok.');
    const m = msg.mentions.users.first();
    if (!m) return msg.reply('Birini etiketle. `!uyari @user`');
    return msg.reply(`⚠️ **${m.tag}** uyarıldı. (Kayıt için /warn kullan)`);
  },
  temizle: async (msg, args) => {
    if (!msg.member.permissions.has('ManageMessages')) return msg.reply('Yetkin yok.');
    const n = parseInt(args[0] || '5', 10);
    const deleted = await msg.channel.bulkDelete(Math.min(n, 100), true).catch(() => null);
    if (!deleted) return msg.reply('Silinemedi (14 gün sınırı).');
    const m = await msg.reply(`🗑️ ${deleted.size} mesaj silindi.`);
    setTimeout(() => m.delete().catch(() => {}), 3000);
  },
  kabul: async (msg) => {
    if (!msg.guild) return msg.reply('❌ Bu komut sadece sunucuda kullanılabilir.');
    if (!msg.member.permissions.has('Administrator')) return msg.reply('❌ Bu komutu sadece sunucu yöneticisi kullanabilir.');
    if (msg.channel.name !== '💡・öneriler') return msg.reply('❌ `.kabul` sadece **💡・öneriler** kanalında kullanılabilir.');
    if (!msg.reference?.messageId) return msg.reply('❌ `.kabul` komutunu kabul etmek istediğin öneri mesajına **yanıtlayarak** yaz.');
    const target = await msg.channel.messages.fetch(msg.reference.messageId).catch(() => null);
    if (!target) return msg.reply('❌ Öneri mesajı bulunamadı.');
    if (target.author.bot) return msg.reply('❌ Bot mesajı öneri olarak kabul edilemez.');
    if (!target.content.trim()) return msg.reply('❌ Bu öneri mesajında metin yok.');
    suggestions.approve({ guildId: msg.guild.id, channelId: msg.channel.id, messageId: target.id, authorId: target.author.id, authorTag: target.author.tag, content: target.content.trim(), approvedBy: msg.author.id, approvedByTag: msg.author.tag });
    await target.react('✅').catch(() => {});
    return msg.reply({ content: '✅ **Öneri kabul edildi!**\n\n📌 Bu öneri arka planda kaydedildi ve sonraki otomasyon için hazır.', allowedMentions: { repliedUser: false } });
  },
  tlock: async (msg, args) => {
    if (!msg.member.permissions.has('ManageChannels')) return msg.reply('❌ Yetkin yok.');
    const id = String(args[0] || '').replace(/[^0-9]/g, '');
    if (!id) return msg.reply('Kullanım: `.tlock KANAL_ID`');
    const channel = await msg.guild.channels.fetch(id).catch(() => null);
    if (!channel || !channel.isTextBased()) return msg.reply('❌ Geçerli bir metin kanalı ID\'si gir.');
    await channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: false }, { reason: 'FREEBUFF .tlock' });
    return msg.reply('🔒 <#' + channel.id + '> kilitlendi.');
  },
  kilit: async (msg) => {
    if (!msg.member.permissions.has('ManageChannels')) return msg.reply('Yetkin yok.');
    await msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: false });
    return msg.reply('🔒 Kanal kilitlendi.');
  },
  yavas: async (msg, args) => {
    if (!msg.member.permissions.has('ManageChannels')) return msg.reply('Yetkin yok.');
    const s = parseInt(args[0] || '0', 10);
    await msg.channel.setRateLimitPerUser(Math.min(Math.max(s, 0), 21600));
    return msg.reply(s ? `🐢 Yavaş mod **${s}** sn.` : '🐢 Yavaş mod kapatıldı.');
  },

  bakiye: (msg) => {
    const id = msg.author.id;
    coins[id] = coins[id] ?? 100;
    return msg.reply(`💰 Bakiyen: **${coins[id]}** coin (detay için /bakiye)`);
  },
  gunluk: (msg) => {
    const id = msg.author.id;
    coins[id] = (coins[id] ?? 100) + 200;
    return msg.reply(`🎁 Günlük **200** coin aldın! Yeni bakiye: **${coins[id]}**`);
  },
  calis: (msg) => {
    const id = msg.author.id;
    const pay = 100 + rand(400);
    coins[id] = (coins[id] ?? 100) + pay;
    return msg.reply(`💼 **${pay}** coin kazandın! Bakiye: **${coins[id]}**`);
  },
  transfer: (msg, args) => {
    const u = msg.mentions.users.first();
    const amt = parseInt(args.filter(a => /^\d+$/.test(a))[0] || '0', 10);
    if (!u || amt <= 0) return msg.reply('Kullanım: `!transfer @user 100`');
    const id = msg.author.id;
    coins[id] = coins[id] ?? 100;
    if (coins[id] < amt) return msg.reply('Yetersiz bakiye.');
    coins[id] -= amt;
    coins[u.id] = (coins[u.id] ?? 100) + amt;
    return msg.reply(`💸 **${amt}** coin → **${u.username}**. Kalan: **${coins[id]}**`);
  },
  siralama: async (msg) => {
    const top = Object.entries(coins).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!top.length) return msg.reply('Henüz kimse para kazanmamış.');
    const lines = [];
    for (let k = 0; k < top.length; k++) {
      let name;
      try { name = (await msg.client.users.fetch(top[k][0])).tag; } catch (_) { name = top[k][0]; }
      lines.push(`${k + 1}. **${name}** — ${top[k][1]} coin`);
    }
    return msg.reply(`🏆 **Sıralama**\n${lines.join('\n')}`);
  }
};

module.exports = { commands, prefix: '!' };
