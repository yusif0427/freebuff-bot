'use strict';

const $ = (id) => document.getElementById(id);

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}g ${h}sa`;
  if (h > 0) return `${h}sa ${m}dk`;
  if (m > 0) return `${m}dk ${s}sn`;
  return `${s}sn`;
}

function fmtNum(n) {
  return typeof n === 'number' ? n.toLocaleString('tr-TR') : '—';
}

let botOnline = false;
const termLog = [];

function logTerm(line) {
  termLog.push('> ' + line);
  while (termLog.length > 9) termLog.shift();
  $('term-log').textContent = termLog.join('\n');
}

async function pollStats() {
  try {
    const res = await fetch('/api/stats', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const s = await res.json();

    // branding
    if (s.botName) {
      $('brand-name').textContent = s.botName;
      $('hero-name').textContent = s.botName;
      $('foot-name').textContent = s.botName;
      document.title = `${s.botName} — ${s.counts.total}+ Komutlu Discord Botu`;
    }
    if (s.inviteUrl) {
      $('davet').href = s.inviteUrl;
      $('davet-2').href = s.inviteUrl;
    }

    // status badge
    botOnline = s.online;
    const badge = $('status-badge');
    const dot = badge.querySelector('.dot');
    if (s.mode === 'site-only') {
      badge.innerHTML = '<span class="dot off"></span> Bakım modu (bot token yok)';
      $('mode-note').innerHTML = '<strong>Site-only mod:</strong> bot DISCORD_TOKEN tanımlı olduğunda canlı istatistikler görünecek.';
    } else if (s.online) {
      badge.innerHTML = '<span class="dot on"></span> Çevrimiçi · 7/24 aktif';
      $('mode-note').textContent = '';
    } else {
      badge.innerHTML = '<span class="dot"></span> Bağlanıyor…';
      $('mode-note').textContent = '';
    }

    // stat cards
    $('s-ping').textContent = s.pingMs == null ? '—' : s.pingMs;
    $('s-uptime').textContent = fmtUptime(s.uptimeSec);
    $('s-servers').textContent = s.online ? fmtNum(s.servers) : '—';
    $('s-users').textContent = s.online ? fmtNum(s.users) : '—';
    $('s-used').textContent = fmtNum(s.commandsUsed);
    $('s-mem').textContent = fmtNum(s.memoryMB);

    // command counts
    const total = s.counts.total;
    $('hero-count').textContent = total + '+';
    $('cmd-total').textContent = `${total} komut`;

    if (s.mode === 'site-only' && termLog.length < 2) {
      logTerm('site hazir — site-only mod (token bekleniyor)');
    }
    if (!s.online && s.mode === 'bot' && termLog.length === 0) {
      logTerm('bot gateway\'e baglaniyor…');
    }
    if (s.online && termLog[termLog.length - 1] !== `uptime: ${s.uptimeSec}s`) {
      logTerm(`uptime: ${s.uptimeSec}s`);
      logTerm(`sunucu: ${s.servers} · kullanici: ${s.users}`);
      logTerm(`ping: ${s.pingMs} ms · komut: ${s.counts.total}`);
      logTerm('bot hazir. /yardim yaz.');
    }
  } catch (e) {
    logTerm('api hatasi: ' + e.message);
  }
}

async function loadCommands() {
  try {
    const res = await fetch('/api/commands');
    const data = await res.json();
    const wrap = $('cmd-groups');
    wrap.innerHTML = '';

    for (const [label, list] of Object.entries(data.slash)) {
      const group = document.createElement('div');
      group.className = 'cmd-group';
      const h = document.createElement('h3');
      h.textContent = `${label} (${list.length})`;
      group.appendChild(h);
      const chips = document.createElement('div');
      chips.className = 'chip-list';
      for (const c of list) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.dataset.q = (c.name + ' ' + c.description).toLowerCase();
        chip.title = c.description;
        const b = document.createElement('b');
        b.textContent = '/' + c.name;
        chip.appendChild(b);
        chips.appendChild(chip);
      }
      group.appendChild(chips);
      wrap.appendChild(group);
    }

    const pre = $('prefix-list');
    pre.innerHTML = '';
    for (const name of data.prefix) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.dataset.q = name.toLowerCase();
      chip.textContent = '!' + name;
      pre.appendChild(chip);
    }
  } catch (e) {
    $('cmd-groups').innerHTML = '<p>Komut listesi yüklenemedi.</p>';
  }
}

function bindSearch() {
  $('cmd-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.chip').forEach(chip => {
      const hay = chip.dataset.q || chip.textContent.toLowerCase();
      chip.classList.toggle('hide', q.length > 0 && !hay.includes(q));
    });
    document.querySelectorAll('.cmd-group').forEach(group => {
      const visible = group.querySelectorAll('.chip:not(.hide)').length;
      group.style.display = visible ? '' : 'none';
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  $('year').textContent = new Date().getFullYear();
  logTerm('sunucu baslatiliyor…');
  pollStats();
  loadCommands();
  bindSearch();
  loadDashboard();
  setInterval(pollStats, 5000);
});


function escapeHtml(v) { return String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

async function loadDashboard() {
  const card = $('dashboard-card'), link = $('login-link');
  try {
    const res = await fetch('/api/me', { cache: 'no-store' });
    if (!res.ok) { link.textContent = 'Discord ile Giriş'; return;}
    const d = await res.json();
    link.textContent = 'Dashboard';
    const avatar = d.user.avatar ? `https://cdn.discordapp.com/avatars/${d.user.id}/${d.user.avatar}.png?size=64` : '';
    card.innerHTML = `
      <div class="feature"><span>👤</span><h3>${escapeHtml(d.user.global_name || d.user.username)}</h3><p>Discord hesabınla giriş yaptın.</p><button class="btn btn-ghost" id="logout-btn">Çıkış yap</button></div>
      <div class="feature"><span>🏠</span><h3>Sunucuların (${d.guilds.length})</h3><p>${d.guilds.slice(0,12).map(g => `${g.botPresent ? '🟢' : '⚪'} <strong>${escapeHtml(g.name)}</strong>${g.botPresent ? ' — Bot aktif' : ' — Bot ekli değil'}`).join('<br>') || 'Sunucu bulunamadı.'}</p></div>`;
    $('logout-btn').onclick = async () => { await fetch('/auth/logout',{method:'POST'}); location.reload(); };
  } catch (_) {}
}
