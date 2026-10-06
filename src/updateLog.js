'use strict';

const CURRENT_UPDATE = 11;

const UPDATES = [
  {
    version: 11,
    title: 'Müzik + Ticket + Kilit + gelişmiş sunucu kurulumu',
    items: [
      'YouTube müzik altyapısı güncellendi ve hata mesajları iyileştirildi.',
      'Küçük ve şık /ticket-panel sistemi eklendi.',
      'Ticket açılınca özel kanal ve kilitle/aç/kapat kontrol paneli gelir.',
      '.tlock KANAL_ID ile istenen kanal doğrudan kilitlenebilir.',
      '/sunucu-kur artık roller, izinler, ticket kategorisi ve çoklu ses odaları kuruyor.',
      'FREEBUFF Üye rolü yeni katılanlara otomatik veriliyor.'
    ]
  },

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
