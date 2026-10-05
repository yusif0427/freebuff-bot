'use strict';
const { emb, ok, fail, COLORS, pick } = require('../helpers');

const U = (name, desc, required = true) => ({ name, description: desc, type: 6, required });
const S = (name, desc, required = false) => ({ name, description: desc, type: 3, required });
const fmtDate = (d) => `<t:${Math.floor(d.getTime() / 1000)}:F>`;

const commands = [
  {
    name: 'serverinfo', description: 'Sunucu hakkında bilgi verir', options: [],
    async execute(i) {
      const g = i.guild;
      const e = emb(`📡 ${g.name}`, [
        `**Sahip:** <@${g.ownerId}>`,
        `**Üye sayısı:** ${g.memberCount}`,
        `**Kanal:** ${g.channels.cache.size} (${g.channels.cache.filter(c => c.type === 0).size} metin, ${g.channels.cache.filter(c => c.type === 2).size} ses)`,
        `**Rol sayısı:** ${g.roles.cache.size}`,
        `**Emoji:** ${g.emojis.cache.size}`,
        `**Oluşturulma:** ${fmtDate(g.createdAt)}`,
        `**Boost:** ${g.premiumTier} seviye (${g.premiumSubscriptionCount || 0} boost)`,
        `**Doğrulama:** ${g.verificationLevel}`
      ].join('\n'), COLORS.info);
      e.setThumbnail(g.iconURL({ size: 256 }));
      return i.reply({ embeds: [e] });
    }
  },
  {
    name: 'userinfo', description: 'Bir üye hakkında bilgi verir', options: [U('user', 'Hakkında bilgi alınacak üye', false)],
    async execute(i) {
      const user = i.options.getUser('user') || i.user;
      const member = i.guild.members.cache.get(user.id) || await i.guild.members.fetch(user.id).catch(() => null);
      const roles = member ? member.roles.cache.filter(r => r.id !== i.guild.id).sort((a, b) => b.position - a.position).first(10).map(r => `<@&${r.id}>`).join(' ') : 'Yok';
      const e = emb(`👤 ${user.tag}`, [
        `**ID:** ${user.id}`,
        `**Katılım (sunucu):** ${member ? fmtDate(member.joinedAt) : '?'}`,
        `**Hesap oluşturulum:** ${fmtDate(user.createdAt)}`,
        `**En yüksek rol:** ${member ? `<@&${member.roles.highest.id}>` : '?'}`,
        `**Roller (${member ? member.roles.cache.size - 1 : 0}):** ${roles}`
      ].join('\n'), COLORS.info);
      e.setThumbnail(user.displayAvatarURL({ size: 256 }));
      return i.reply({ embeds: [e] });
    }
  },
  {
    name: 'avatar', description: 'Üyenin profil resmini gösterir', options: [U('user', 'Profil resmi alınacak üye', false)],
    async execute(i) {
      const user = i.options.getUser('user') || i.user;
      const url = user.displayAvatarURL({ size: 512, dynamic: true });
      const e = emb(`🖼️ ${user.tag}`, `[Büyük boyut](${url})`, COLORS.info);
      e.setImage(url);
      return i.reply({ embeds: [e] });
    }
  },
  {
    name: 'banner', description: 'Üyenin profil bannerını gösterir', options: [U('user', 'Banner alınacak üye', false)],
    async execute(i) {
      const user = i.options.getUser('user') || i.user;
      const fresh = await i.client.users.fetch(user.id, { force: true }).catch(() => user);
      if (!fresh.bannerURL()) return fail(i, 'Bu kullanıcının bannerı yok.');
      const url = fresh.bannerURL({ size: 512 });
      const e = emb(`🎏 ${fresh.tag}`, `[Büyük boyut](${url})`, COLORS.fun);
      e.setImage(url);
      return i.reply({ embeds: [e] });
    }
  },
  {
    name: 'uye-sayi', description: 'Sunucu uye sayisini gosterir', options: [],
    async execute(i) {
      const g = i.guild;
      const online = g.members.cache.filter(m => m.presence?.status && m.presence.status !== 'offline').size;
      return ok(i, '👥 Üye sayısı', `Toplam: **${g.memberCount}**\nÇevrimiçi (tahmini): **${online}**`);
    }
  },
  {
    name: 'rolbilgi', description: 'Rol hakkında bilgi verir', options: [{ name: 'rol', description: 'Bilgisi alınacak rol', type: 8, required: true }],
    async execute(i) {
      const r = i.options.getRole('rol');
      const e = emb(`🎭 ${r.name}`, [
        `**ID:** ${r.id}`,
        `**Renk:** ${r.hexColor}`,
        `**Sıra:** ${r.position}`,
        `**Üye sayısı:** ${r.members.size}`,
        `**Oluşturulma:** ${fmtDate(r.createdAt)}`,
        `**Süreli:** ${r.hoist ? 'Evet' : 'Hayır'}`,
        `**Mention edilebilir:** ${r.mentionable ? 'Evet' : 'Hayır'}`
      ].join('\n'), r.hexColor && r.hexColor !== '#000000' ? parseInt(r.hexColor.slice(1), 16) : COLORS.info);
      return i.reply({ embeds: [e] });
    }
  },
  {
    name: 'kanalbilgi', description: 'Kanal hakkında bilgi verir', options: [],
    async execute(i) {
      const c = i.channel;
      const types = { 0: 'Metin', 2: 'Ses', 4: 'Kategori', 5: 'Duyuru', 10: 'Duyuru Thread', 11: 'Thread', 13: 'Stage' };
      const e = emb(`📄 #${c.name || 'bilinmiyor'}`, [
        `**ID:** ${c.id}`,
        `**Tür:** ${types[c.type] || c.type}`,
        `**Kategori:** ${c.parent ? c.parent.name : '-'}`,
        `**Oluşturulma:** ${fmtDate(c.createdAt)}`,
        c.topic ? `**Konu:** ${c.topic}` : ''
      ].filter(Boolean).join('\n'), COLORS.info);
      return i.reply({ embeds: [e] });
    }
  },
  {
    name: 'davet-sayi', description: 'Sunucunun aktif davet sayisini gosterir', options: [],
    async execute(i) {
      const invites = await i.guild.invites.fetch().catch(() => null);
      if (!invites) return fail(i, 'Davetleri çekemedim (Invite Manager yetkim yok).');
      const total = invites.reduce((s, v) => s + (v.uses || 0), 0);
      return ok(i, '🎟️ Davetler', `Toplam tıklanma: **${total}**\nAktif davet: **${invites.size}**`);
    }
  },
  {
    name: 'anket', description: 'Hızlı anket oluşturur (evet/hayır)', options: [S('soru', 'Anket sorusu', true)],
    async execute(i) {
      const q = i.options.getString('soru');
      const e = emb('📊 Anket', `**${q}**\n\n✅ Evet\n❌ Hayır`, COLORS.warn);
      const msg = await i.reply({ embeds: [e], fetchReply: true });
      await msg.react('✅').catch(() => {});
      await msg.react('❌').catch(() => {});
    }
  },
  {
    name: 'sunucu-resim', description: 'Sunucunun ikonunu buyuk gosterir', options: [],
    async execute(i) {
      const url = i.guild.iconURL({ size: 512, dynamic: true });
      if (!url) return fail(i, 'Sunucunun ikonu yok.');
      const e = emb(`🖼️ ${i.guild.name}`, `[Büyük boyut](${url})`, COLORS.info);
      e.setImage(url);
      return i.reply({ embeds: [e] });
    }
  },
  {
    name: 'roller', description: 'Sunucudaki rolleri listeler', options: [],
    async execute(i) {
      const roles = i.guild.roles.cache.sort((a, b) => b.position - a.position).first(30);
      const desc = roles.map(r => `<@&${r.id}>`).join(', ');
      return ok(i, `🎭 Roller (${i.guild.roles.cache.size})`, desc.slice(0, 3900));
    }
  },
  {
    name: 'kanallar', description: 'Sunucudaki kanalları listeler', options: [],
    async execute(i) {
      const text = i.guild.channels.cache.filter(c => c.type === 0).sort((a, b) => a.position - b.position).map(c => `<#${c.id}>`);
      const voice = i.guild.channels.cache.filter(c => c.type === 2).sort((a, b) => a.position - b.position).map(c => `<#${c.id}>`);
      const desc = `**Metin (${text.length}):**\n${text.join(' ')}\n\n**Ses (${voice.length}):**\n${voice.join(' ')}`;
      return ok(i, '📚 Kanallar', desc.slice(0, 3900));
    }
  },
  {
    name: 'emojiler', description: 'Sunucudaki emojileri listeler', options: [],
    async execute(i) {
      const emojis = i.guild.emojis.cache.first(40);
      if (!emojis.length) return fail(i, 'Bu sunucuda emoji yok.');
      const desc = emojis.map(e => `${e} \`:${e.name}:\``).join(' ');
      return ok(i, `😀 Emojiler (${i.guild.emojis.cache.size})`, desc.slice(0, 3900));
    }
  },
  {
    name: 'sabitlenen', description: 'Kanalda sabitlenmiş mesajları gösterir', options: [],
    async execute(i) {
      const pins = await i.channel.messages.fetchPinned().catch(() => null);
      if (!pins || !pins.size) return fail(i, 'Bu kanalda sabitlenmiş mesaj yok.');
      const desc = pins.first(10).map(m => `• [mesaj](${m.url}) — ${m.author?.tag}: ${(m.content || '[ek]').slice(0, 80)}`).join('\n');
      return ok(i, `📌 Sabitlenenler (${pins.size})`, desc.slice(0, 3900));
    }
  },
  {
    name: 'ilkmesaj', description: 'Kanalın ilk mesajını gösterir', options: [],
    async execute(i) {
      await i.deferReply();
      const msgs = await i.channel.messages.fetch({ limit: 100, after: '0' }).catch(() => null);
      if (!msgs || !msgs.size) return fail(i, 'İlk mesaj bulunamadı.');
      const first = msgs.last();
      const e = emb('📜 İlk mesaj', `**${first.author?.tag}**: ${(first.content || '[ek]').slice(0, 800)}\n[Git](${first.url})\nTarih: ${fmtDate(first.createdAt)}`, COLORS.info);
      return i.editReply({ embeds: [e] });
    }
  }
];

module.exports = { commands };
