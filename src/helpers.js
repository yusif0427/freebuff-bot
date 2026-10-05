'use strict';
const { EmbedBuilder } = require('discord.js');

const COLORS = { ok: 0x22c55e, err: 0xef4444, info: 0x3b82f6, warn: 0xf59e0b, fun: 0xa855f7 };

function emb(title, desc, color = COLORS.info) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc == null ? null : String(desc));
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

module.exports = { emb, reply, ok, fail, rand, pick, COLORS };
