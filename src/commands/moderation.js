'use strict';
const { PermissionFlagsBits } = require('discord.js');
const { ok, fail, emb, COLORS } = require('../helpers');
const moderationStats = require('../moderationStats');

// per-channel last deleted message, filled by bot.js (messageDelete)
const snipeMap = new Map();
function storeSnipe(msg) { if (msg.content || msg.attachments.size) snipeMap.set(msg.channel.id, msg); }
function getSnipe(channelId) { return snipeMap.get(channelId); }

const U = (name, desc, required = true) => ({ name, description: desc, type: 6, required });
const S = (name, desc, required = false) => ({ name, description: desc, type: 3, required });
const I = (name, desc, required = false) => ({ name, description: desc, type: 4, required });

const commands = [
  {
    name: 'ban', description: 'Üyeyi sunucudan yasaklar', options: [U('user', 'Yasaklanacak üye'), S('sebep', 'Yasak sebebi')],
    default_member_permissions: String(PermissionFlagsBits.BanMembers),
    async execute(i) {
      const user = i.options.getUser('user');
      const reason = i.options.getString('sebep') || 'Sebep belirtilmedi';
      const member = i.guild.members.cache.get(user.id) || await i.guild.members.fetch(user.id).catch(() => null);
      if (member && !member.bannable) return fail(i, 'Bu üyeyi yasaklayamam (rolü benden yüksek olabilir).');
      await i.guild.members.ban(user.id, { reason }).catch(e => fail(i, 'Yasaklama başarısız: ' + e.message));
      moderationStats.record('bans', i.guild.id, { userId: user.id, user: user.tag, by: i.user.id, reason });
      return ok(i, '🔨 Yasaklandı', `**${user.tag}** yasaklandı.\nSebep: ${reason}`);
    }
  },
  {
    name: 'unban', description: 'Yasaklı bir üyeyi geri alır', options: [S('user_id', 'Yasaktan alınacak kullanıcı ID', true)],
    default_member_permissions: String(PermissionFlagsBits.BanMembers),
    async execute(i) {
      const id = i.options.getString('user_id').trim();
      const ban = await i.guild.bans.fetch(id).catch(() => null);
      if (!ban) return fail(i, 'Bu ID\'ye sahip yasaklı kullanıcı bulunamadı.');
      await i.guild.members.unban(id);
      return ok(i, '🕊️ Yasak kaldırıldı', `**${ban.user.tag}** sunucuya geri alınabilir.`);
    }
  },
  {
    name: 'kick', description: 'Üyeyi sunucudan atar', options: [U('user', 'Atılacak üye'), S('sebep', 'Atma sebebi')],
    default_member_permissions: String(PermissionFlagsBits.KickMembers),
    async execute(i) {
      const member = i.options.getMember('user');
      if (!member) return fail(i, 'Bu üye sunucuda değil.');
      if (!member.kickable) return fail(i, 'Bu üyeyi atamam (rolü benden yüksek).');
      const reason = i.options.getString('sebep') || 'Sebep belirtilmedi';
      await member.kick(reason);
      moderationStats.record('kicks', i.guild.id, { userId: member.id, user: member.user.tag, by: i.user.id, reason });
      return ok(i, '👢 Atıldı', `**${member.user.tag}** atıldı.\nSebep: ${reason}`);
    }
  },
  {
    name: 'timeout', description: 'Üyeyi süreli susturur (timeout)', options: [U('user', 'Susturulacak üye'), I('dakika', 'Süre (dakika)', true), S('sebep', 'Sebep')],
    default_member_permissions: String(PermissionFlagsBits.ModerateMembers),
    async execute(i) {
      const member = i.options.getMember('user');
      const mins = i.options.getInteger('dakika');
      if (!member) return fail(i, 'Bu üye sunucuda değil.');
      if (mins < 1 || mins > 40320) return fail(i, 'Süre 1 dakika ile 40320 dakika (28 gün) arasında olmalı.');
      if (!member.moderatable) return fail(i, 'Bu üyeyi susturamam.');
      const timeoutReason = i.options.getString('sebep') || 'Susturuldu';
      await member.timeout(mins * 60_000, timeoutReason);
      moderationStats.record('timeouts', i.guild.id, { userId: member.id, user: member.user.tag, by: i.user.id, reason: timeoutReason, minutes: mins });
      return ok(i, '🔇 Susturuldu', `**${member.user.tag}** ${mins} dakika susturuldu.`);
    }
  },
  {
    name: 'untimeout', description: 'Üyenin timeoutunu kaldırır', options: [U('user', 'Timeoutu kaldırılacak üye')],
    default_member_permissions: String(PermissionFlagsBits.ModerateMembers),
    async execute(i) {
      const member = i.options.getMember('user');
      if (!member) return fail(i, 'Bu üye sunucuda değil.');
      await member.timeout(null).catch(() => fail(i, 'Timeout kaldırılamadı.'));
      return ok(i, '🔊 Susturma kaldırıldı', `**${member.user.tag}** artık konuşabilir.`);
    }
  },
  {
    name: 'purge', description: 'Belirtilen sayıda mesajı siler', options: [I('adet', 'Silinecek mesaj sayısı (1-100)', true)],
    default_member_permissions: String(PermissionFlagsBits.ManageMessages),
    async execute(i) {
      const n = i.options.getInteger('adet');
      if (n < 1 || n > 100) return fail(i, '1 ile 100 arasında bir sayı seç.');
      await i.deferReply({ ephemeral: true });
      const deleted = await i.channel.bulkDelete(n, true).catch(() => null);
      if (!deleted) return fail(i, 'Mesajlar silinemedi (14 günden eski mesajlar silinemez).');
      return ok(i, '🗑️ Silindi', `${deleted.size} mesaj silindi.`);
    }
  },
  {
    name: 'slowmode', description: 'Kanalın yavaş modunu ayarlar', options: [I('saniye', 'Yavaş mod süresi (saniye, 0 = kapat)', true)],
    default_member_permissions: String(PermissionFlagsBits.ManageChannels),
    async execute(i) {
      const s = i.options.getInteger('saniye');
      if (s < 0 || s > 21600) return fail(i, '0 ile 21600 saniye arasında olmalı.');
      await i.channel.setRateLimitPerUser(s);
      return ok(i, '🐢 Yavaş mod', s === 0 ? 'Yavaş mod kapatıldı.' : `Kanalda **${s} sn** yavaş mod aktif.`);
    }
  },
  {
    name: 'lock', description: 'Kanalı herkese kapatır', options: [],
    default_member_permissions: String(PermissionFlagsBits.ManageChannels),
    async execute(i) {
      await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false });
      return ok(i, '🔒 Kilitlendi', `<#${i.channel.id}> kilitlendi, artık kimse yazamaz.`);
    }
  },
  {
    name: 'unlock', description: 'Kanalın kilidini kaldırır', options: [],
    default_member_permissions: String(PermissionFlagsBits.ManageChannels),
    async execute(i) {
      await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: null });
      return ok(i, '🔓 Kilit açıldı', `<#${i.channel.id}> yeniden açıldı.`);
    }
  },
  {
    name: 'warn', description: 'Üyeye uyarı verir', options: [U('user', 'Uyarılacak üye'), S('sebep', 'Uyarı sebebi')],
    default_member_permissions: String(PermissionFlagsBits.ManageMessages),
    async execute(i) {
      const { addWarn } = require('../warns');
      const user = i.options.getUser('user');
      const reason = i.options.getString('sebep') || 'Sebep belirtilmedi';
      const count = addWarn(i.guild.id, user.id, reason, i.user.id);
      moderationStats.record('warns', i.guild.id, { userId: user.id, user: user.tag, by: i.user.id, reason });
      return ok(i, '⚠️ Uyarı verildi', `**${user.tag}** uyarıldı. (Toplam uyarı: **${count}**)\nSebep: ${reason}`);
    }
  },
  {
    name: 'warns', description: 'Üyenin uyarılarını gösterir', options: [U('user', 'Uyarıları görüntülenecek üye', false)],
    default_member_permissions: String(PermissionFlagsBits.ManageMessages),
    async execute(i) {
      const { getWarns } = require('../warns');
      const user = i.options.getUser('user') || i.user;
      const list = getWarns(i.guild.id, user.id);
      if (!list.length) return ok(i, '📋 Uyarılar', `**${user.tag}** hiçbir uyarı almamış.`);
      const desc = list.map((w, k) => `\`${k + 1}.\` ${w.reason} — <@${w.by}> • <t:${Math.floor(w.at / 1000)}:R>`).join('\n');
      return ok(i, `📋 Uyarılar (${list.length})`, desc.slice(0, 3900));
    }
  },
  {
    name: 'unwarn', description: 'Üyenin son uyarısını kaldırır', options: [U('user', 'Uyarısı kaldırılacak üye')],
    default_member_permissions: String(PermissionFlagsBits.ManageMessages),
    async execute(i) {
      const { removeLastWarn } = require('../warns');
      const user = i.options.getUser('user');
      const left = removeLastWarn(i.guild.id, user.id);
      if (left === null) return fail(i, 'Bu üyeyin uyarısı yok.');
      return ok(i, '✅ Uyarı kaldırıldı', `**${user.tag}** için son uyarı silindi. Kalan uyarı: **${left}**`);
    }
  },
  {
    name: 'mod-rapor', description: 'Son 7 günün moderasyon raporunu gösterir', options: [],
    default_member_permissions: String(PermissionFlagsBits.ModerateMembers),
    async execute(i) {
      const ms = require('../moderationStats');
      const sum = ms.summary(i.guild.id);
      const lines = [`🔨 Ban: **${sum.bans}**`,`👢 Kick: **${sum.kicks}**`,`🔇 Timeout: **${sum.timeouts}**`,`⚠️ Uyarı: **${sum.warns}**`];
      const bans = ms.week(i.guild.id, 'bans').slice(-10).reverse();
      if (bans.length) lines.push('', '**Son banlar:**', ...bans.map(x => `• ${x.user} — <@${x.by}> — ${x.reason}`));
      return ok(i, '🛡️ Haftalık Moderasyon Raporu', lines.join('\\n'));
    }
  },
  {
    name: 'snipe', description: 'Kanalda son silinen mesajı gösterir', options: [],
    default_member_permissions: String(PermissionFlagsBits.ManageMessages),
    async execute(i) {
      const msg = getSnipe(i.channel.id);
      if (!msg) return fail(i, 'Bu kanalda silinecek bir mesaj yok (veya kayıt tutulmamış).');
      const e = emb('🎯 Snipe', `**Yazar:** ${msg.author?.tag || '?'}\n**İçerik:**\n${(msg.content || '[mesaj yok]').slice(0, 1500)}`, COLORS.warn);
      return i.reply({ embeds: [e] });
    }
  },
  {
    name: 'rolver', description: 'Üyeye rol verir', options: [U('user', 'Rol verilecek üye'), { name: 'rol', description: 'Verilecek rol', type: 8, required: true }],
    default_member_permissions: String(PermissionFlagsBits.ManageRoles),
    async execute(i) {
      const member = i.options.getMember('user');
      const role = i.options.getRole('rol');
      if (!member) return fail(i, 'Bu üye sunucuda değil.');
      if (role.position >= i.guild.members.me.roles.highest.position) return fail(i, 'Bu rol benden yüksek.');
      await member.roles.add(role);
      return ok(i, '➕ Rol verildi', `**${member.user.tag}** kullanıcısına **${role.name}** rolü verildi.`);
    }
  },
  {
    name: 'rolal', description: 'Üyenin rolünü alır', options: [U('user', 'Rolü alınacak üye'), { name: 'rol', description: 'Alınacak rol', type: 8, required: true }],
    default_member_permissions: String(PermissionFlagsBits.ManageRoles),
    async execute(i) {
      const member = i.options.getMember('user');
      const role = i.options.getRole('rol');
      if (!member) return fail(i, 'Bu üye sunucuda değil.');
      if (role.position >= i.guild.members.me.roles.highest.position) return fail(i, 'Bu rol benden yüksek.');
      await member.roles.remove(role);
      return ok(i, '➖ Rol alındı', `**${member.user.tag}** kullanıcısından **${role.name}** rolü alındı.`);
    }
  },
  {
    name: 'sesat', description: 'Üyeyi seste kanala taşır', options: [U('user', 'Taşınacak üye'), { name: 'kanal', description: 'Hedef ses kanalı', type: 7, required: true }],
    default_member_permissions: String(PermissionFlagsBits.MoveMembers),
    async execute(i) {
      const member = i.options.getMember('user');
      const channel = i.options.getChannel('kanal');
      if (!member || !member.voice.channelId) return fail(i, 'Bu üye bir ses kanalında değil.');
      if (channel.type !== 2) return fail(i, 'Hedef kanal bir ses kanalı olmalı.');
      await member.voice.setChannel(channel.id);
      return ok(i, '🚚 Taşındı', `**${member.user.tag}** → **${channel.name}**`);
    }
  },
  {
    name: 'kilitall', description: 'Tüm metin kanallarını kilitler', options: [],
    default_member_permissions: String(PermissionFlagsBits.Administrator),
    async execute(i) {
      await i.deferReply({ ephemeral: true });
      const channels = i.guild.channels.cache.filter(c => c.type === 0 && c.viewable);
      let done = 0;
      for (const c of channels.values()) {
        await c.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false }).then(() => done++).catch(() => {});
      }
      return ok(i, '🔒 Hepsi kilitlendi', `${done} kanal kilitlendi.`);
    }
  },
  {
    name: 'kilitallac', description: 'Tüm metin kanallarının kilidini kaldırır', options: [],
    default_member_permissions: String(PermissionFlagsBits.Administrator),
    async execute(i) {
      await i.deferReply({ ephemeral: true });
      const channels = i.guild.channels.cache.filter(c => c.type === 0 && c.viewable);
      let done = 0;
      for (const c of channels.values()) {
        await c.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: null }).then(() => done++).catch(() => {});
      }
      return ok(i, '🔓 Hepsi açıldı', `${done} kanalın kilidi kaldırıldı.`);
    }
  },
  {
    name: 'sunucu-kur',
    description: 'Roller, izinler, kategoriler, ticket ve çoklu ses odalarını kurar',
    options: [],
    default_member_permissions: String(PermissionFlagsBits.Administrator),
    async execute(i) {
      const { ChannelType } = require('discord.js');
      await i.deferReply({ ephemeral: true });

      const rolePlan = [
        {
          name: 'FREEBUFF Yönetim',
          color: 0xef4444,
          permissions: [
            PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.KickMembers,
            PermissionFlagsBits.BanMembers,
            PermissionFlagsBits.ModerateMembers,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.ViewAuditLog
          ]
        },
        {
          name: 'FREEBUFF Moderatör',
          color: 0xf59e0b,
          permissions: [
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.KickMembers,
            PermissionFlagsBits.ModerateMembers,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.ViewAuditLog
          ]
        },
        {
          name: '🎫 Destek',
          color: 0x5865f2,
          permissions: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },
        {
          name: '🎵 DJ',
          color: 0x8b5cf6,
          permissions: [
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.UseVAD
          ]
        },
        {
          name: 'FREEBUFF Üye',
          color: 0x64748b,
          permissions: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak
          ]
        }
      ];

      const roles = {};
      let rolesCreated = 0;
      for (const plan of rolePlan) {
        let role = i.guild.roles.cache.find(r => r.name === plan.name);
        if (!role) {
          role = await i.guild.roles.create({
            name: plan.name,
            color: plan.color,
            permissions: plan.permissions,
            reason: 'FREEBUFF /sunucu-kur UPDATE 11'
          }).catch(() => null);
          if (role) rolesCreated++;
        }
        if (role) roles[plan.name] = role;
      }

      const everyone = i.guild.roles.everyone;
      const modRoles = [roles['FREEBUFF Yönetim'], roles['FREEBUFF Moderatör']].filter(Boolean);
      const support = roles['🎫 Destek'];
      const dj = roles['🎵 DJ'];

      const createCategory = async (name, overwrites = []) => {
        let cat = i.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
        if (cat) return { channel: cat, created: false };
        const channel = await i.guild.channels.create({
          name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: overwrites,
          reason: 'FREEBUFF /sunucu-kur UPDATE 11'
        }).catch(() => null);
        return { channel, created: Boolean(channel) };
      };

      const normalOverwrites = [
        { id: everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
      ];
      const managementOverwrites = [
        { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        ...modRoles.map(r => ({ id: r.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }))
      ];
      const ticketOverwrites = [
        { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        ...(support ? [{ id: support.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
        { id: i.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
      ];

      const groups = [
        {
          name: '📁 FREEBUFF • ANA',
          overwrites: normalOverwrites,
          channels: [
            ['📜・kurallar', ChannelType.GuildText],
            ['📢・duyurular', ChannelType.GuildText],
            ['👋・hosgeldin', ChannelType.GuildText],
            ['💬・genel', ChannelType.GuildText],
            ['🤖・bot-komut', ChannelType.GuildText],
            ['💡・öneriler', ChannelType.GuildText]
          ]
        },
        {
          name: '🎮 OYUN • EĞLENCE',
          overwrites: normalOverwrites,
          channels: [
            ['🎮・oyun', ChannelType.GuildText],
            ['😂・meme', ChannelType.GuildText],
            ['🎵・müzik', ChannelType.GuildText],
            ['🔊・Lobi', ChannelType.GuildVoice],
            ['🔊・Oyun 1', ChannelType.GuildVoice],
            ['🔊・Oyun 2', ChannelType.GuildVoice]
          ]
        },
        {
          name: '🛡️ YÖNETİM • LOG',
          overwrites: managementOverwrites,
          channels: [
            ['📊・istatistik', ChannelType.GuildText],
            ['🛡️・mod-log', ChannelType.GuildText],
            ['📋・uyarı-log', ChannelType.GuildText],
            ['🔊・Yönetim Odası', ChannelType.GuildVoice]
          ]
        },
        {
          name: '🌙 SES • SOHBET',
          overwrites: normalOverwrites,
          channels: [
            ['🔊・Sohbet 1', ChannelType.GuildVoice],
            ['🔊・Sohbet 2', ChannelType.GuildVoice],
            ['🔊・Sohbet 3', ChannelType.GuildVoice],
            ['🔊・AFK', ChannelType.GuildVoice]
          ]
        },
        {
          name: '🎫・TICKETS',
          overwrites: ticketOverwrites,
          channels: []
        }
      ];

      let created = 0, existing = 0, failed = 0;
      for (const group of groups) {
        const result = await createCategory(group.name, group.overwrites);
        if (!result.channel) { failed += group.channels.length + 1; continue; }
        result.created ? created++ : existing++;
        for (const [name, type] of group.channels) {
          const found = i.guild.channels.cache.find(x => x.name === name && x.parentId === result.channel.id);
          if (found) { existing++; continue; }
          const overwrite = type === ChannelType.GuildVoice && dj
            ? [
                { id: everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
                { id: dj.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.UseVAD] }
              ]
            : group.overwrites;
          const made = await i.guild.channels.create({
            name,
            type,
            parent: result.channel.id,
            permissionOverwrites: overwrite,
            reason: 'FREEBUFF /sunucu-kur UPDATE 11',
            ...(type === ChannelType.GuildVoice ? { userLimit: 0 } : {})
          }).catch(() => null);
          if (made) created++;
          else failed++;
        }
      }

      return ok(
        i,
        '🏗️ Sunucu Kurulumu • UPDATE 11',
        '🧩 **Roller:** ' + rolesCreated + ' yeni rol\\n' +
        '📦 **Kanallar/kategoriler:** ' + created + ' yeni, ' + existing + ' mevcut\\n' +
        '⚠️ **Başarısız:** ' + failed + '\\n\\n' +
        '🛡️ Yönetim + Moderatör + 🎫 Destek + 🎵 DJ + Üye rolleri hazır.\\n' +
        '🎫 Ticket kategorisi + 🔊 4 ses odası + yönetim izinleri + oyun/ana kanallar hazır.'
      );
    }
  },
];

module.exports = { commands, storeSnipe, getSnipe };
