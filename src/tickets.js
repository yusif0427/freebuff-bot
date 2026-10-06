'use strict';

const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const TICKET_CATEGORY = '🎫・TICKETS';
const SUPPORT_ROLE = '🎫 Destek';
const PREFIX = 'freebuff:ticket:';

function getSupportRole(guild) {
  return guild.roles.cache.find(r => r.name === SUPPORT_ROLE) || null;
}

async function ensureTicketCategory(guild) {
  let category = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && c.name === TICKET_CATEGORY
  );
  if (category) return category;

  const support = getSupportRole(guild);
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: guild.client.user.id, allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageChannels
    ] }
  ];
  if (support) {
    overwrites.push({
      id: support.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  return guild.channels.create({
    name: TICKET_CATEGORY,
    type: ChannelType.GuildCategory,
    permissionOverwrites: overwrites,
    reason: 'FREEBUFF ticket sistemi'
  });
}

function panelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PREFIX + 'open')
      .setLabel('Ticket Aç')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary)
  );
}

function controlRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PREFIX + 'lock')
      .setLabel('Kilitle')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(PREFIX + 'unlock')
      .setLabel('Kilidi Aç')
      .setEmoji('🔓')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(PREFIX + 'close')
      .setLabel('Ticket Kapat')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger)
  );
}

function isStaff(i) {
  return Boolean(
    i.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
    i.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    i.member?.roles?.cache?.some(r => r.name === SUPPORT_ROLE)
  );
}

async function openTicket(i) {
  const guild = i.guild;
  const category = await ensureTicketCategory(guild);
  const support = getSupportRole(guild);

  const existing = guild.channels.cache.find(
    c => c.type === ChannelType.GuildText &&
      c.parentId === category.id &&
      c.topic === 'FREEBUFF-TICKET:' + i.user.id
  );
  if (existing) {
    return i.reply({
      content: '🎫 Zaten açık ticketın var: ' + existing,
      ephemeral: true
    });
  }

  const safeName = i.user.username.toLowerCase()
    .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ-]/gi, '-')
    .replace(/-+/g, '-')
    .slice(0, 28) || 'uye';

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: i.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages
      ]
    }
  ];

  if (support) {
    overwrites.push({
      id: support.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  const channel = await guild.channels.create({
    name: 'ticket-' + safeName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: 'FREEBUFF-TICKET:' + i.user.id,
    permissionOverwrites: overwrites,
    reason: 'FREEBUFF ticket açıldı'
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎫 FREEBUFF • Ticket Kontrol Paneli')
    .setDescription(
      'Merhaba <@' + i.user.id + '>! Destek ekibi birazdan ilgilenecek.\n\n' +
      'Bu küçük panelden ticketı **kilitleyebilir, tekrar açabilir veya kapatabilirsin.**'
    )
    .addFields(
      { name: '👤 Açan', value: '<@' + i.user.id + '>', inline: true },
      { name: '🛡️ Destek', value: support ? '<@&' + support.id + '>' : 'Yönetim', inline: true },
      { name: '📌 Durum', value: '🟢 Açık', inline: true }
    )
    .setFooter({ text: 'FREEBUFF • Ticket Sistemi' })
    .setTimestamp();

  await channel.send({
    content: support ? '<@&' + support.id + '>' : '🛡️ Yönetim',
    embeds: [embed],
    components: [controlRow()]
  });

  return i.reply({
    content: '🎫 Ticket oluşturuldu: ' + channel,
    ephemeral: true
  });
}

async function handleInteraction(i) {
  if (!i.isButton() || !i.customId.startsWith(PREFIX)) return false;
  if (!i.guild) return true;

  const action = i.customId.slice(PREFIX.length);

  if (action === 'open') {
    await openTicket(i).catch(async e => {
      console.error('[ticket] open:', e);
      if (!i.replied && !i.deferred) await i.reply({ content: '❌ Ticket açılamadı. Botun **Manage Channels** yetkisini kontrol et.', ephemeral: true });
    });
    return true;
  }

  if (!i.channel || i.channel.type !== ChannelType.GuildText) {
    await i.reply({ content: '❌ Bu kontrol sadece ticket kanalında kullanılabilir.', ephemeral: true });
    return true;
  }

  const ownerId = String(i.channel.topic || '').startsWith('FREEBUFF-TICKET:')
    ? String(i.channel.topic).slice('FREEBUFF-TICKET:'.length)
    : null;

  if (!isStaff(i) && i.user.id !== ownerId) {
    await i.reply({ content: '❌ Bu ticketı yönetme yetkin yok.', ephemeral: true });
    return true;
  }

  if (action === 'lock') {
    await i.channel.permissionOverwrites.edit(ownerId, { SendMessages: false });
    await i.channel.send('🔒 Ticket kilitlendi. Destek ekibi tekrar açabilir.');
    await i.reply({ content: '🔒 Ticket kilitlendi.', ephemeral: true });
    return true;
  }

  if (action === 'unlock') {
    await i.channel.permissionOverwrites.edit(ownerId, { SendMessages: true });
    await i.channel.send('🔓 Ticket tekrar açıldı.');
    await i.reply({ content: '🔓 Ticket açıldı.', ephemeral: true });
    return true;
  }

  if (action === 'close') {
    await i.reply({ content: '🗑️ Ticket kapatılıyor...', ephemeral: true });
    await i.channel.permissionOverwrites.edit(ownerId, { SendMessages: false, ViewChannel: false }).catch(() => {});
    setTimeout(() => i.channel.delete('FREEBUFF ticket kapatıldı').catch(() => {}), 1200);
    return true;
  }

  return true;
}

async function sendPanel(i) {
  const category = await ensureTicketCategory(i.guild);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎫 FREEBUFF • DESTEK')
    .setDescription(
      '**Desteğe mi ihtiyacın var?**\n\n' +
      'Aşağıdaki butona basarak sana özel bir ticket aç.\n' +
      'Ticketı sadece sen ve destek ekibi görebilir.'
    )
    .addFields(
      { name: '⚡ Hızlı', value: 'Tek tıkla ticket açılır.', inline: true },
      { name: '🔐 Özel', value: 'Kanal sadece yetkililere görünür.', inline: true },
      { name: '🎛️ Panel', value: 'Kilitle / aç / kapat.', inline: true }
    )
    .setFooter({ text: 'FREEBUFF • Ticket Sistemi' });

  await i.reply({
    embeds: [embed],
    components: [panelRow()],
    ephemeral: false
  });
  return category;
}

module.exports = {
  TICKET_CATEGORY,
  SUPPORT_ROLE,
  sendPanel,
  handleInteraction
};
