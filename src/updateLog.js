'use strict';

const CURRENT_UPDATE = 10;

const UPDATES = [
  {
    version: 10,
    title: 'Temiz arayüz + gelişmiş sunucu kurulumu',
    items: [
      'Her komutta görünen otomatik PNG kart kaldırıldı.',
      '/yardim komutları düzenli, okunaklı PNG içinde gösteriyor.',
      '/sunucu-kur artık birden fazla kategori ve çoklu ses odası oluşturuyor.',
      'Yönetim, sohbet, bot, oyun ve ses kanalları için hazır altyapı eklendi.',
      'Güncelleme numarası ve eklenen özellikler komut görselinde gösteriliyor.'
    ]
  },
  {
    version: 9,
    title: 'Ses ve YouTube müzik sistemi',
    items: [
      '/ses-cek ile üyeyi bulunduğun ses kanalına taşıma.',
      '/muzik ile YouTube linkinden ses oynatma.',
      '/muzik-durdur ve /muzik-cikis kontrolleri.'
    ]
  }
];

function latestUpdate() {
  return UPDATES.find(x => x.version === CURRENT_UPDATE) || UPDATES[0];
}

module.exports = { CURRENT_UPDATE, UPDATES, latestUpdate };
