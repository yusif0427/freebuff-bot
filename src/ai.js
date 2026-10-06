'use strict';

const OpenAI = require('openai');

let client = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

async function analyzeSuggestion(suggestion) {
  const openai = getClient();
  if (!openai) throw new Error('OPENAI_API_KEY ayarlanmamış.');

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-6-luna',
    instructions: [
      'Sen FREEBUFF Discord botunun teknik AI yardımcısısın.',
      'Kullanıcının Discord önerisini analiz et.',
      'Önerinin ne istediğini, mevcut botta hangi dosyaların değişmesinin muhtemel olduğunu ve uygulanabilir bir planı Türkçe açıkla.',
      'Güvenli olmayan, gizli anahtar isteyen veya belirsiz işlemleri uygulama; bunları özellikle belirt.',
      'Bu aşamada doğrudan GitHub dosyası değiştirdiğini iddia etme.'
    ].join(' '),
    input: [
      {
        role: 'user',
        content: 'Kabul edilen Discord önerisi:\n\n' + suggestion.content
      }
    ]
  });

  return response.output_text || 'AI yanıt üretmedi.';
}

module.exports = { analyzeSuggestion };
