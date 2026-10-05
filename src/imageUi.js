/**
 * FREEBUFF dynamic PNG UI for every Discord interaction.
 * The card is rendered from SVG -> PNG with sharp, then attached to the reply.
 */
'use strict';

const sharp = require('sharp');
const { AttachmentBuilder } = require('discord.js');

const ACCENTS = {
  moderation: '#ef4444',
  server: '#06b6d4',
  utility: '#3b82f6',
  games: '#f59e0b',
  fun: '#a855f7',
  economy: '#22c55e'
};

function esc(v) {
  return String(v == null ? '' : v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function plain(v) {
  return String(v == null ? '' : v)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/<@!?\d+>/g, '@üye')
    .replace(/<@&\d+>/g, '@rol')
    .replace(/<#\d+>/g, '#kanal')
    .replace(/\\n/g, '\n')
    .trim();
}

function wrap(text, width, maxLines) {
  const words = plain(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) lines[maxLines - 1] = lines[maxLines - 1].slice(0, width - 1) + '…';
  return lines;
}

function textLines(lines, x, y) {
  return lines.map((line, n) =>
    '<text x="' + x + '" y="' + (y + n * 30) + '" fill="#dbeafe" font-family="Arial, DejaVu Sans, sans-serif" font-size="20">' + esc(line) + '</text>'
  ).join('');
}

async function renderCard(meta) {
  meta = meta || {};
  const title = plain(meta.title || 'FREEBUFF');
  const desc = plain(meta.description || 'Komut başarıyla çalıştırıldı.');
  const command = meta.commandName ? '/' + meta.commandName : '/komut';
  const category = meta.category || 'FREEBUFF';
  const accent = meta.accent || ACCENTS[meta.category] || '#3b82f6';
  const user = meta.user || 'Discord üyesi';
  const guild = meta.guild || 'FREEBUFF Sunucusu';
  const detail = wrap(desc, 72, 7);

  let svg = '';
  svg += '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675">';
  svg += '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#050a14"/><stop offset="0.55" stop-color="#0a1426"/><stop offset="1" stop-color="#121a30"/></linearGradient></defs>';
  svg += '<rect width="1200" height="675" rx="28" fill="url(#bg)"/>';
  svg += '<rect x="22" y="22" width="1156" height="631" rx="24" fill="none" stroke="#21385f" stroke-width="2"/>';
  svg += '<circle cx="78" cy="70" r="28" fill="' + accent + '" opacity="0.18"/><circle cx="78" cy="70" r="18" fill="' + accent + '"/>';
  svg += '<text x="71" y="77" fill="#ffffff" font-family="Arial" font-size="18" font-weight="700">F</text>';
  svg += '<text x="120" y="66" fill="#ffffff" font-family="Arial, DejaVu Sans, sans-serif" font-size="29" font-weight="800">FREEBUFF</text>';
  svg += '<text x="120" y="91" fill="#7e98bd" font-family="Arial, DejaVu Sans, sans-serif" font-size="14">Discord Bot • Dynamic PNG Interface</text>';
  svg += '<rect x="1015" y="53" width="110" height="34" rx="17" fill="' + accent + '" opacity="0.13" stroke="' + accent + '"/>';
  svg += '<circle cx="1036" cy="70" r="5" fill="' + accent + '"/><text x="1047" y="75" fill="#dceaff" font-family="Arial" font-size="13" font-weight="700">ONLINE</text>';

  svg += '<rect x="48" y="122" width="1104" height="96" rx="20" fill="#0b1527" stroke="#21385d"/>';
  svg += '<text x="74" y="155" fill="#72a1dd" font-family="Arial, DejaVu Sans, sans-serif" font-size="13" font-weight="700">' + esc(command) + '</text>';
  svg += '<text x="74" y="193" fill="#ffffff" font-family="Arial, DejaVu Sans, sans-serif" font-size="29" font-weight="800">' + esc(title.slice(0, 46)) + '</text>';
  svg += '<rect x="1002" y="150" width="120" height="28" rx="14" fill="' + accent + '" opacity="0.12"/>';
  svg += '<text x="1021" y="169" fill="' + accent + '" font-family="Arial, DejaVu Sans, sans-serif" font-size="12" font-weight="700">' + esc(category) + '</text>';

  const boxes = [
    [48, 'DURUM', 'BAŞARILI', 'Komut yanıtı hazır'],
    [323, 'KULLANICI', user.slice(0, 20), 'İsteği gönderen'],
    [598, 'SUNUCU', guild.slice(0, 20), 'Aktif çalışma alanı'],
    [873, 'SİSTEM', 'PNG CARD', 'Dark • Neon • FREEBUFF']
  ];
  for (const box of boxes) {
    svg += '<rect x="' + box[0] + '" y="240" width="252" height="104" rx="18" fill="#0a1425" stroke="#1d3357"/>';
    svg += '<text x="' + (box[0] + 20) + '" y="268" fill="#7691ba" font-family="Arial" font-size="12">' + esc(box[1]) + '</text>';
    svg += '<text x="' + (box[0] + 20) + '" y="305" fill="#ffffff" font-family="Arial, DejaVu Sans, sans-serif" font-size="20" font-weight="800">' + esc(box[2]) + '</text>';
    svg += '<text x="' + (box[0] + 20) + '" y="328" fill="#6f89ae" font-family="Arial" font-size="12">' + esc(box[3]) + '</text>';
  }

  svg += '<rect x="48" y="368" width="1104" height="234" rx="20" fill="#081222" stroke="#21385d"/>';
  svg += '<text x="74" y="405" fill="#f4f8ff" font-family="Arial, DejaVu Sans, sans-serif" font-size="18" font-weight="800">Komut Özeti</text>';
  svg += '<text x="74" y="430" fill="#6e88ae" font-family="Arial" font-size="12">Her slash komutu için otomatik oluşturulan görsel arayüz</text>';
  svg += textLines(detail, 74, 468);
  svg += '<rect x="900" y="432" width="218" height="112" rx="18" fill="#0e1930" stroke="' + accent + '" stroke-opacity="0.45"/>';
  svg += '<text x="923" y="458" fill="#6e88ae" font-family="Arial" font-size="11">FREEBUFF VISUAL</text>';
  svg += '<text x="923" y="491" fill="#ffffff" font-family="Arial" font-size="18" font-weight="800">COMMAND CARD</text>';
  svg += '<text x="923" y="517" fill="#9bb3d8" font-family="Arial" font-size="12">1200 × 675 • PNG</text>';
  svg += '<circle cx="1080" cy="516" r="11" fill="' + accent + '" opacity="0.18"/><circle cx="1080" cy="516" r="4" fill="' + accent + '"/>';
  svg += '<text x="74" y="635" fill="#526d94" font-family="Arial" font-size="11">FREEBUFF • otomatik oluşturuldu • koyu tema</text>';
  svg += '</svg>';

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

async function toImagePayload(payload, meta) {
  const input = typeof payload === 'string' ? { content: payload } : Object.assign({}, payload || {});
  const first = Array.isArray(input.embeds) ? input.embeds[0] : null;
  const title = first && first.title ? first.title : ((meta && meta.commandName) || 'FREEBUFF');
  const description = first && first.description ? first.description : (input.content || 'Komut başarıyla çalıştırıldı.');
  const color = first && first.color ? first.color : 0x3b82f6;
  const png = await renderCard(Object.assign({}, meta, { title, description, accent: '#' + Number(color).toString(16).padStart(6, '0') }));
  const file = new AttachmentBuilder(png, { name: 'freebuff-ui.png' });
  const card = { color, image: { url: 'attachment://freebuff-ui.png' } };
  return Object.assign({}, input, {
    embeds: [card].concat(Array.isArray(input.embeds) ? input.embeds.slice(0, 9) : []),
    files: (Array.isArray(input.files) ? input.files : []).concat(file)
  });
}

function patchInteraction(i, meta) {
  if (!i || i.__freebuffUiPatched) return;
  i.__freebuffUiPatched = true;
  for (const method of ['reply', 'followUp', 'editReply', 'update']) {
    if (typeof i[method] !== 'function') continue;
    const original = i[method].bind(i);
    i[method] = async function(payload) {
      try {
        return original(await toImagePayload(payload, meta || {}));
      } catch (e) {
        console.error('[ui] PNG kart üretilemedi:', e.message);
        return original(payload);
      }
    };
  }
}

module.exports = { renderCard, toImagePayload, patchInteraction, ACCENTS };
