# Freebuff Bot — Site + 7/24 Discord Botu

Tek Node.js süreci hem **web sitesini** (canlı istatistiklerle) hem **Discord botunu** (130 komut) çalıştırır.

## Komut sayısı

- **100 slash komut** (Discord'un global limiti tam olarak 100 — `src/commands/*.js`)
- **30 prefix komutu** (`!ping`, `!ban`… — `src/prefixCommands.js`)
- **Toplam 130**

## Yerel çalıştırma

```bash
npm install
npm start                # token'sız: site-only mod → http://localhost:3000
```

Token'lı çalıştırma:

```bash
# Windows (PowerShell)
$env:DISCORD_TOKEN="token"; $env:CLIENT_ID="client_id"; npm start
# Linux / macOS
DISCORD_TOKEN=token CLIENT_ID=client_id npm start
```

## Discord botu oluşturma

1. https://discord.com/developers/applications → **New Application**
2. **Bot** sekmesi → **Add Bot**
3. **Privileged Gateway Intents**: `PRESENCE INTENT`, `SERVER MEMBERS INTENT`, `MESSAGE CONTENT INTENT` → **hepsini aç** (üye sayısı ve mesaj okuma için şart)
4. **Reset Token** → token'ı kopyala (`DISCORD_TOKEN`)
5. **General Information** → `APPLICATION ID` = `CLIENT_ID`
6. Sunucuya ekleme linki (site Davet butonu):
   `https://discord.com/oauth2/authorize?client_id=CLIENT_ID&permissions=8&scope=bot%20applications.commands`

İlk açılışta 100 slash komut **global** olarak kaydedilir; Discord'un yayına alma süresi nedeniyle görünmesi **1 saate kadar** sürebilir.

## Yayına alma (Render — ücretsiz)

1. Bu klasörü bir **GitHub deposuna** itele (`git add . && git commit -m "init" && git push`).
2. https://render.com → **New +** → **Web Service** → depoyu bağla.
3. `render.yaml` otomatik tanınır; **Environment** alanına `DISCORD_TOKEN`, `CLIENT_ID`, `INVITE_URL` gir.
4. Deploy bittikten sonra çıkan `*.onrender.com` adresi siten.
5. **UptimeRobot** (ücretsiz) ekle → `https://SITEN.onrender.com/api/health` → her 5 dakikada ping at (Render ücretsiz plan 15 dk sonra uyur; ping sayesinde bot 7/24 kalır).

## API

| Uç | Açıklama |
|---|---|
| `GET /api/stats` | ping, uptime, sunucu/kullanıcı, komut sayaçları (5 sn'de bir tazelenir) |
| `GET /api/commands` | kategori kategori komut listesi |
| `GET /api/health` | sağlık kontrolü (uptime monitor için) |

Veriler `data/` altında JSON olarak saklanır (`economy.json`, `warns.json`, `usage.json`).
