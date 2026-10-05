'use strict';
const { EmbedBuilder } = require('discord.js');

// FREEBUFF dark UI palette. Individual commands may still choose an accent
// colour; the embed itself is kept visually consistent with the dark theme.
const COLORS = {
  ok: 0x22c55e,
  err: 0xef4444,
  info: 0x64748b,
  warn: 0xf59e0b,
  fun: 0xa855f7
};
const UI = {
  bg: 0x0b0f14,
  footer: 'FREEBUFF • /yardim',
  icon: 'https://cdn.discordapp.com/embed/avatars/0.png'
};

function emb(title, desc, color = COLORS.info) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(String(title || 'FREEBUFF'))
    .setDescription(desc == null ? null : String(desc))
    .setFooter({ text: UI.footer })
    .setTimestamp();
}

async function reply(i, embed, ephemeral = false) {
  const payload = { embeds: [embed], ephemeral };
  if (i.deferred || i.replied) return i.followUp(payload);
  return i.reply(payload);
}

async function ok(i, title, desc) {
  return reply(i, emb(title, desc, COLORS.ok));
}

async function fail(i, msg) {
  return reply(i, emb('❌ Hata', msg, COLORS.err), true);
}

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];

module.exports = { emb, reply, ok, fail, rand, pick, COLORS, UI };