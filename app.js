/* 楊梅高中梅岡風 — 前端主程式（無外部資源） */
(() => {
'use strict';

const DATA = window.MGF_DATA || { issues: [] };
const ISSUES = DATA.issues.slice().sort((a, b) => a.no - b.no);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const main = $('#main');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const CN = '零一二三四五六七八九十';
const cnNum = n => n <= 10 ? CN[n] : n < 20 ? '十' + CN[n - 10] : CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
const thumb = pg => `img/thumb/${pg.key}.webp`;
const web = pg => `img/web/${pg.key}.webp`;
const byNo = new Map(ISSUES.map(i => [i.no, i]));
const COLORS = ['#7d4fa8', '#e0263c', '#20a99a', '#f4a01a', '#3d9be0', '#c2459a', '#6cbf3f', '#ef6c35'];

// 每版全文與行位移（檢索用）
ISSUES.forEach(iss => {
  iss.pages.sort((a, b) => a.p - b.p);
  iss.pages.forEach(pg => {
    let off = 0;
    pg.offs = pg.L.map(l => { const o = off; off += l[0].length; return o; });
    pg.text = pg.L.map(l => l[0]).join('');
    pg.no = iss.no;
  });
  iss.year = iss.date ? +iss.date.slice(0, 4) : null;
  iss.month = iss.date ? +iss.date.slice(5, 7) : null;
});
const TOTAL_PAGES = ISSUES.reduce((s, i) => s + i.pages.length, 0);
const TOTAL_CHARS = ISSUES.reduce((s, i) => s + i.pages.reduce((t, p) => t + p.text.length, 0), 0);
const dateLabel = iss => iss.date ? `${iss.year} 年 ${iss.month} 月` : '日期未標示';
const semester = iss => {
  if (!iss.date) return '';
  const y = iss.year - 1911, m = iss.month;
  return m >= 8 ? `${y} 學年度上學期` : m <= 1 ? `${y - 1} 學年度上學期` : `${y - 1} 學年度下學期`;
};

/* ================= 儲存 ================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem('mgf.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mgf.' + k, JSON.stringify(v)); } catch { } }
};
const S = Object.assign({ sound: true, petals: true, motion: true, dark: false, contrast: false, panel: true, ocrbox: false, font: 0, vol: 60 }, store.get('settings', {}));
const P = Object.assign({ read: {}, fav: [], searches: 0, history: [], badges: {}, game: { best: 0, played: 0 }, tl: false, lastq: [] }, store.get('progress', {}));
const saveS = () => store.set('settings', S);
const saveP = () => store.set('progress', P);

/* ================= 音效（WebAudio 合成） ================= */
let AC = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(freq, dur = .12, type = 'sine', gain = .25, when = 0, slide = 0) {
  if (!S.sound) return; const a = ac(); if (!a) return;
  const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  const v = gain * S.vol / 100;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
}
function noise(dur = .25, gain = .2, freq = 1800, q = .8) {
  if (!S.sound) return; const a = ac(); if (!a) return;
  const n = a.sampleRate * dur, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain * S.vol / 100;
  src.connect(f).connect(g).connect(a.destination); src.start();
}
const SFX = {
  click: () => tone(880, .07, 'triangle', .18),
  hover: () => tone(1320, .04, 'sine', .05),
  flip: () => { noise(.28, .35, 2400, .6); tone(300, .12, 'sine', .05, .02, 1.6); },
  open: () => { tone(523, .1, 'triangle', .18); tone(784, .16, 'triangle', .16, .08); },
  search: () => { noise(.35, .18, 900, 2); tone(660, .12, 'sine', .12, .15); tone(990, .16, 'sine', .12, .24); },
  none: () => { tone(330, .18, 'sawtooth', .08); tone(247, .25, 'sawtooth', .08, .15); },
  zoom: up => tone(up ? 700 : 500, .08, 'sine', .12, 0, up ? 1.4 : .7),
  ok: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, 'triangle', .18, i * .08)),
  bad: () => { tone(220, .22, 'square', .07); tone(185, .3, 'square', .07, .12); },
  dice: () => { for (let i = 0; i < 7; i++) tone(400 + Math.random() * 800, .05, 'square', .06, i * .07); },
  badge: () => [659, 784, 988, 1319, 1568].forEach((f, i) => tone(f, .3, 'triangle', .2, i * .1)),
  toggle: on => tone(on ? 988 : 660, .08, 'sine', .15),
  wind: () => { noise(1.4, .12, 500, .5); }
};

/* ================= 設定 ================= */
const TOGGLES = [
  ['sound', '🔊 音效', '點擊、翻頁、搜尋時的提示音'],
  ['petals', '🌸 梅花飄落動畫', '背景飄落的梅花花瓣'],
  ['motion', '✨ 動態效果', '關閉可減少畫面動畫'],
  ['dark', '🌙 深色模式', '夜間閱讀較不刺眼'],
  ['contrast', '◐ 高對比', '加強文字與邊框對比'],
  ['panel', '📝 閱讀器顯示文字面板', '在右側顯示辨識出的文字'],
  ['ocrbox', '🔲 顯示文字辨識框', '在版面上標出辨識到的文字位置']
];
function applySettings() {
  const r = document.documentElement;
  r.dataset.theme = S.dark ? 'dark' : 'light';
  r.dataset.contrast = S.contrast ? '1' : '0';
  r.dataset.petals = S.petals ? '1' : '0';
  r.dataset.motion = S.motion ? '1' : '0';
  r.dataset.font = S.font;
  $$('#fontSeg button').forEach(b => b.classList.toggle('on', +b.dataset.f === S.font));
  $('#vol').value = S.vol;
}
function buildSettings() {
  $('#setList').innerHTML = TOGGLES.map(([k, t, d]) => `
    <label class="set-row"><span>${t}<small>${d}</small></span>
    <span class="switch"><input type="checkbox" data-k="${k}" ${S[k] ? 'checked' : ''}><span></span></span></label>`).join('');
  $$('#setList input').forEach(inp => inp.addEventListener('change', () => {
    S[inp.dataset.k] = inp.checked; saveS(); applySettings(); SFX.toggle(inp.checked);
    if (inp.dataset.k === 'dark' && inp.checked) award('night');
    if (location.hash.startsWith('#/read')) route();
  }));
  $$('#fontSeg button').forEach(b => b.onclick = () => { S.font = +b.dataset.f; saveS(); applySettings(); SFX.click(); });
  $('#vol').oninput = e => { S.vol = +e.target.value; saveS(); };
  $('#vol').onchange = () => SFX.click();
  const dr = $('#settings');
  $('#btnSettings').onclick = () => { dr.hidden = false; SFX.open(); $('[data-close]', dr).focus(); };
  dr.addEventListener('click', e => { if (e.target === dr || e.target.closest('[data-close]')) { dr.hidden = true; SFX.click(); } });
}

/* ================= 通知 / 徽章 ================= */
function toast(html, cls = '', ms = 3200) {
  const t = document.createElement('div'); t.className = 'toast ' + cls; t.innerHTML = html;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms);
}
function confetti(n = 60) {
  if (!S.motion) return;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i'); c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw'; c.style.background = COLORS[i % COLORS.length];
    c.style.animationDuration = 1.6 + Math.random() * 1.8 + 's'; c.style.animationDelay = Math.random() * .4 + 's';
    if (i % 3 === 0) { c.textContent = '✿'; c.style.background = 'none'; c.style.color = COLORS[i % COLORS.length]; c.style.fontSize = '18px'; }
    document.body.appendChild(c); setTimeout(() => c.remove(), 4000);
  }
}
const BADGES = [
  ['first', '🌱', '初來乍到', '第一次打開梅岡風', () => true],
  ['read10', '📖', '小小讀者', '閱讀 10 個版面', () => readCount() >= 10],
  ['read50', '📚', '愛書人', '閱讀 50 個版面', () => readCount() >= 50],
  ['readAll', '👑', '梅岡風全制霸', `讀完全部 ${TOTAL_PAGES} 個版面`, () => readCount() >= TOTAL_PAGES],
  ['issue', '📰', '整期讀透', '讀完某一期的所有版面', () => ISSUES.some(i => i.pages.every(p => P.read[p.key]))],
  ['search', '🔎', '尋寶偵探', '進行 10 次搜尋', () => P.searches >= 10],
  ['fav', '⭐', '收藏家', '收藏 5 個版面', () => P.fav.length >= 5],
  ['time', '🕰️', '時光旅人', '造訪時光軸', () => P.tl],
  ['game', '🎯', '梅岡神猜', '猜期遊戲連續答對 5 題', () => P.game.best >= 5],
  ['zoom', '🔬', '放大鏡達人', '在閱讀器中放大到 300%', () => P.zoomed],
  ['old', '🏺', '考古學家', `翻閱最早的第 ${ISSUES[0]?.no} 期`, () => ISSUES[0]?.pages.some(p => P.read[p.key])],
  ['night', '🦉', '夜貓子', '開啟深色模式', () => S.dark]
];
function readCount() { return Object.keys(P.read).length; }
function award(id) {
  if (P.badges[id]) return; const b = BADGES.find(x => x[0] === id); if (!b) return;
  if (id !== 'night' && !b[4]()) return;
  P.badges[id] = Date.now(); saveP();
  setTimeout(() => { SFX.badge(); confetti(); toast(`<b>${b[1]} 獲得徽章：${b[2]}</b><br><span class="small">${b[3]}</span>`, 'badge-t', 4500); }, 350);
}
function checkBadges() { BADGES.forEach(b => { if (!P.badges[b[0]] && b[4]()) award(b[0]); }); }

/* ================= 梅花飄落 ================= */
function petals() {
  const cv = $('#petals'), cx = cv.getContext('2d'); let W, H, list = [];
  const rs = () => { W = cv.width = innerWidth * devicePixelRatio; H = cv.height = innerHeight * devicePixelRatio; };
  rs(); addEventListener('resize', rs);
  const mk = (y) => ({ x: Math.random() * W, y: y ?? -20, s: (6 + Math.random() * 9) * devicePixelRatio, vx: (-.3 + Math.random() * .9) * devicePixelRatio, vy: (.4 + Math.random() * .8) * devicePixelRatio, a: Math.random() * 6.3, va: -.03 + Math.random() * .06, c: ['#f28aa0', '#e0263c', '#ffc4d0', '#c79be6', '#ffffff'][Math.floor(Math.random() * 5)], o: .45 + Math.random() * .4 });
  for (let i = 0; i < 26; i++) list.push(mk(Math.random() * H));
  let gust = 0;
  window.gust = () => { gust = 60; };
  function flower(p) {
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.a); cx.globalAlpha = p.o; cx.fillStyle = p.c;
    for (let k = 0; k < 5; k++) { cx.rotate(Math.PI * 2 / 5); cx.beginPath(); cx.ellipse(0, -p.s * .55, p.s * .38, p.s * .55, 0, 0, 7); cx.fill(); }
    cx.fillStyle = '#f4b52a'; cx.beginPath(); cx.arc(0, 0, p.s * .18, 0, 7); cx.fill(); cx.restore();
  }
  (function loop() {
    requestAnimationFrame(loop);
    if (!S.petals || document.hidden) return;
    cx.clearRect(0, 0, W, H);
    const g = gust > 0 ? (gust--, 6 * devicePixelRatio * Math.sin(gust / 60 * Math.PI)) : 0;
    list.forEach((p, i) => {
      p.x += p.vx + g + Math.sin(p.y / 60) * .4; p.y += p.vy; p.a += p.va;
      if (p.y > H + 30 || p.x > W + 40 || p.x < -40) list[i] = mk();
      flower(p);
    });
  })();
}

/* ================= 路由 ================= */
const routes = {
  '': vHome, issues: vIssues, issue: vIssue, read: vRead, search: vSearch, timeline: vTimeline, game: vGame, me: vMe, help: vHelp
};
let cleanup = null;
function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const q = new URLSearchParams(qs || '');
  const fn = routes[parts[0] || ''] || vHome;
  $$('.nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === (parts[0] || 'home') || (parts[0] === 'issue' || parts[0] === 'read') && a.dataset.nav === 'issues'));
  main.innerHTML = '';
  const v = document.createElement('div'); v.className = 'view'; main.appendChild(v);
  fn(v, parts.slice(1), q);
  if (!['read'].includes(parts[0])) window.scrollTo({ top: 0 });
}
const go = h => { location.hash = h; };

/* ================= 共用元件 ================= */
function issueCard(iss, i = 0) {
  const n = iss.pages.filter(p => P.read[p.key]).length;
  const heads = iss.pages[0]?.heads?.slice(0, 1).join('') || '';
  return `<a class="issue-card" href="#/issue/${iss.no}" style="animation-delay:${Math.min(i, 20) * 30}ms" data-sfx>
    <div class="cover"><img loading="lazy" src="${thumb(iss.pages[0])}" alt="第 ${iss.no} 期第 1 版"><span class="no">第 ${iss.no} 期</span>
    ${n ? `<span class="seen">${n === iss.pages.length ? '✔ 已讀完' : `已讀 ${n}/${iss.pages.length}`}</span>` : ''}</div>
    <div class="info"><b>${esc(iss.title || dateLabel(iss))}</b><div class="muted">${iss.title ? dateLabel(iss) + '・' : ''}${iss.pages.length} 個版面</div>
    ${heads ? `<div class="muted small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">❀ ${esc(heads)}</div>` : ''}
    <div class="progress"><i style="width:${n / iss.pages.length * 100}%"></i></div></div></a>`;
}
function countUp(el) {
  const to = +el.dataset.to, t0 = performance.now(), d = 1300;
  const step = t => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e).toLocaleString(); if (k < 1) requestAnimationFrame(step); };
  S.motion ? requestAnimationFrame(step) : el.textContent = to.toLocaleString();
}
function randomPage() {
  const iss = ISSUES[Math.floor(Math.random() * ISSUES.length)];
  return [iss, iss.pages[Math.floor(Math.random() * iss.pages.length)]];
}
function yearsList() {
  const m = new Map(); ISSUES.forEach(i => { const y = i.year || 0; m.set(y, (m.get(y) || []).concat(i)); });
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

/* ================= 首頁 ================= */
function vHome(v) {
  const latest = ISSUES[ISSUES.length - 1];
  const first = ISSUES[0];
  if (!latest) { v.innerHTML = '<div class="empty"><span class="big">📭</span>尚無資料，請執行「更新網站.bat」。</div>'; return; }
  const picks = [ISSUES[Math.floor(ISSUES.length * .2)], latest, ISSUES[Math.floor(ISSUES.length * .6)]].map(i => i.pages[0]);
  const ys = yearsList();
  v.innerHTML = `
  <section class="hero">
    <div class="hero-deco" aria-hidden="true">
      <svg width="260" height="260" viewBox="0 0 100 100" style="right:-60px;top:-70px;opacity:.16"><g fill="#e0263c">${[0, 72, 144, 216, 288].map(r => `<ellipse cx="50" cy="26" rx="15" ry="22" transform="rotate(${r} 50 50)"/>`).join('')}</g><circle cx="50" cy="50" r="8" fill="#f4b52a"/></svg>
      <svg width="600" height="120" viewBox="0 0 600 120" style="left:0;bottom:0;opacity:.35"><path d="M0 80 Q150 30 300 70 T600 60" fill="none" stroke="#b596d6" stroke-width="3" stroke-dasharray="8 10"><animate attributeName="stroke-dashoffset" from="0" to="-180" dur="6s" repeatCount="indefinite"/></path><path d="M0 100 Q200 60 350 95 T600 85" fill="none" stroke="#ffb3bf" stroke-width="2" stroke-dasharray="4 12"><animate attributeName="stroke-dashoffset" from="0" to="160" dur="8s" repeatCount="indefinite"/></path></svg>
    </div>
    <div style="position:relative">
      <h1>楊梅高中 ・ 校刊數位典藏</h1>
      <img class="hero-logo" src="img/logo.png" alt="梅岡風">
      <p class="lead">從 <b>${first.date ? first.year + ' 年' : '第 ' + first.no + ' 期'}</b> 到 <b>${latest.date ? latest.year + ' 年' : '第 ' + latest.no + ' 期'}</b>，
      一起翻閱梅岡校園的每一陣風——活動、榮譽、青春與故事，都在這裡。</p>
      <div class="hero-cta">
        <a class="btn plum" href="#/read/${latest.no}/1" data-sfx>📰 閱讀最新一期</a>
        <a class="btn" href="#/issues" data-sfx>📚 瀏覽全部期別</a>
        <a class="btn gold" href="#/search" data-sfx>🔍 全文檢索</a>
      </div>
    </div>
    <div class="hero-stack" aria-label="精選版面">
      ${picks.map(p => `<img src="${thumb(p)}" alt="第 ${p.no} 期" data-go="#/read/${p.no}/${p.p}">`).join('')}
    </div>
  </section>

  <div class="stats">
    <div class="stat"><b data-to="${ISSUES.length}">0</b><span>期校刊</span><i>📰</i></div>
    <div class="stat"><b data-to="${TOTAL_PAGES}">0</b><span>個版面</span><i>🗞️</i></div>
    <div class="stat"><b data-to="${TOTAL_CHARS}">0</b><span>個可檢索文字</span><i>🔤</i></div>
    <div class="stat"><b data-to="${readCount()}">0</b><span>個版面你已讀過</span><i>👣</i></div>
  </div>

  <h2 class="sec-title">最新一期：第 ${latest.no} 期 <a class="more" href="#/issue/${latest.no}">看全部版面 →</a></h2>
  <div class="grid2">
    <div class="card latest">
      <img src="${thumb(latest.pages[0])}" alt="第 ${latest.no} 期封面" data-go="#/read/${latest.no}/1">
      <div>
        <span class="tag plum">第 ${latest.no} 期</span><span class="tag">${dateLabel(latest)}</span>${latest.date ? `<span class="tag gold">${semester(latest)}</span>` : ''}
        <h3 style="margin:10px 0 4px">本期焦點</h3>
        <ul class="heads">${latest.pages.flatMap(p => p.heads.slice(0, 2).map(h => `<li><a href="#/read/${latest.no}/${p.p}">${esc(h)}</a> <span class="muted small">第${p.p}版</span></li>`)).slice(0, 8).join('') || '<li>點選封面開始閱讀</li>'}</ul>
      </div>
    </div>
    <div class="card dice-card">
      <h3 style="margin:0">🎲 今天讀哪一版？</h3>
      <p class="muted" style="margin:0">擲骰子，隨機翻開一個歷史版面</p>
      <span class="dice" id="dice" role="button" tabindex="0" aria-label="擲骰子">🎲</span>
      <div id="diceOut" class="muted">點一下骰子試試手氣！</div>
    </div>
  </div>

  <h2 class="sec-title">依年份瀏覽 <a class="more" href="#/timeline">時光軸 →</a></h2>
  <div class="years">
    ${ys.map(([y, l], i) => `<a class="year-chip" style="background:${COLORS[i % COLORS.length]}" href="#/issues?y=${y}" data-sfx>${y || '未標'}<small>${l.length} 期</small></a>`).join('')}
  </div>

  <h2 class="sec-title">近期出刊 <a class="more" href="#/issues">全部 ${ISSUES.length} 期 →</a></h2>
  <div class="issue-grid">${ISSUES.slice(-8).reverse().map(issueCard).join('')}</div>

  <h2 class="sec-title">使用小撇步</h2>
  <div class="grid2">
    <div class="card"><b>⌨️ 快速鍵</b><ul class="heads">
      <li>按 <code>/</code> 立即搜尋</li><li>閱讀時 <code>←</code> <code>→</code> 換版、<code>+</code> <code>-</code> 縮放、<code>0</code> 還原</li>
      <li>滑鼠滾輪縮放、拖曳移動；手機可雙指縮放</li></ul></div>
    <div class="card"><b>🔍 檢索技巧</b><ul class="heads">
      <li>多個關鍵字用空白分隔（同時包含）</li><li>可限定期別範圍、年份或版次</li>
      <li>搜尋結果點進去，關鍵字會在版面上<mark style="background:#ffe066">亮起來</mark></li></ul></div>
  </div>`;
  $$('.stat b', v).forEach(countUp);
  const dice = $('#dice', v);
  const roll = () => {
    dice.classList.remove('roll'); void dice.offsetWidth; dice.classList.add('roll'); SFX.dice();
    const [iss, pg] = randomPage();
    setTimeout(() => {
      $('#diceOut', v).innerHTML = `<a href="#/read/${iss.no}/${pg.p}"><img src="${thumb(pg)}" alt="" style="width:120px;border-radius:6px;box-shadow:var(--shadow);display:block;margin:6px auto"></a>
      <b>第 ${iss.no} 期 第 ${pg.p} 版</b>${pg.sec ? '・' + esc(pg.sec) : ''}<br><a class="btn sm plum" href="#/read/${iss.no}/${pg.p}" style="margin-top:6px">翻開它 →</a>`;
      SFX.ok();
    }, 800);
  };
  dice.onclick = roll; dice.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); roll(); } };
}

/* ================= 歷期瀏覽 ================= */
function vIssues(v, _, q) {
  const ys = yearsList();
  let st = { y: q.get('y') || '', sort: store.get('sort', 'desc'), view: store.get('view', 'grid'), kw: '' };
  v.innerHTML = `
    <h2 class="sec-title" style="margin-top:6px">📚 歷期瀏覽</h2>
    <div class="toolbar">
      <select id="fy" aria-label="年份"><option value="">全部年份</option>${ys.map(([y, l]) => `<option value="${y}">${y || '未標示'}（${l.length} 期）</option>`).join('')}</select>
      <input type="search" id="fk" placeholder="輸入期別，例如 25" aria-label="期別篩選" style="width:220px">
      <div class="seg" id="fs"><button data-s="desc">新 → 舊</button><button data-s="asc">舊 → 新</button></div>
      <div class="seg" id="fv"><button data-v="grid">🖼️ 封面</button><button data-v="list">📋 清單</button></div>
      <span class="muted" id="fc"></span>
    </div>
    <div id="out"></div>`;
  $('#fy', v).value = st.y;
  const draw = () => {
    let l = ISSUES.filter(i => (!st.y || String(i.year || 0) === st.y) && (!st.kw || String(i.no).includes(st.kw) || (i.title || '').includes(st.kw)));
    if (st.sort === 'desc') l = l.slice().reverse();
    $$('#fs button', v).forEach(b => b.classList.toggle('on', b.dataset.s === st.sort));
    $$('#fv button', v).forEach(b => b.classList.toggle('on', b.dataset.v === st.view));
    $('#fc', v).textContent = `共 ${l.length} 期`;
    const out = $('#out', v);
    if (!l.length) { out.innerHTML = '<div class="empty"><span class="big">🍃</span>找不到符合的期別</div>'; return; }
    out.innerHTML = st.view === 'grid'
      ? `<div class="issue-grid">${l.map(issueCard).join('')}</div>`
      : `<table class="list-table"><thead><tr><th>封面</th><th>期別</th><th>出刊</th><th>版面與焦點</th></tr></thead><tbody>
        ${l.map(i => `<tr><td><a href="#/issue/${i.no}"><img loading="lazy" src="${thumb(i.pages[0])}" alt=""></a></td>
        <td><a href="#/issue/${i.no}"><b>第 ${i.no} 期</b></a>${i.title ? '<br>' + esc(i.title) : ''}</td><td>${dateLabel(i)}</td>
        <td>${i.pages.map(p => `<a class="tag" href="#/read/${i.no}/${p.p}">第${p.p}版${p.sec ? ' ' + esc(p.sec) : ''}</a>`).join('')}
        <div class="muted small">${esc(i.pages.flatMap(p => p.heads.slice(0, 1)).slice(0, 3).join('／'))}</div></td></tr>`).join('')}</tbody></table>`;
  };
  $('#fy', v).onchange = e => { st.y = e.target.value; SFX.click(); draw(); };
  $('#fk', v).oninput = e => { st.kw = e.target.value.trim(); draw(); };
  $$('#fs button', v).forEach(b => b.onclick = () => { st.sort = b.dataset.s; store.set('sort', st.sort); SFX.click(); draw(); });
  $$('#fv button', v).forEach(b => b.onclick = () => { st.view = b.dataset.v; store.set('view', st.view); SFX.click(); draw(); });
  draw();
}

/* ================= 單期 ================= */
function vIssue(v, [no]) {
  const iss = byNo.get(+no);
  if (!iss) { v.innerHTML = `<div class="empty"><span class="big">🔍</span>找不到第 ${esc(no)} 期</div>`; return; }
  const idx = ISSUES.indexOf(iss), prev = ISSUES[idx - 1], next = ISSUES[idx + 1];
  v.innerHTML = `
    <div class="issue-head">
      <div class="issue-badge"><div>第<b>${iss.no}</b>期</div></div>
      <div><h2>${esc(iss.title || '梅岡風 第 ' + iss.no + ' 期')}</h2>
      <span class="tag plum">${dateLabel(iss)}</span>${iss.date ? `<span class="tag gold">${semester(iss)}</span>` : ''}<span class="tag">${iss.pages.length} 個版面</span>
      ${iss.note ? `<p class="muted">${esc(iss.note)}</p>` : ''}</div>
      <div style="margin-left:auto;display:flex;gap:10px;flex-wrap:wrap"><a class="btn plum" href="#/read/${iss.no}/1" data-sfx>📖 從第 1 版開始讀</a>
      <a class="btn ghost" href="#/search?from=${iss.no}&to=${iss.no}" data-sfx>🔍 在本期中搜尋</a></div>
    </div>
    <div class="pages-grid">
      ${iss.pages.map((p, i) => `<a class="page-card" href="#/read/${iss.no}/${p.p}" style="animation-delay:${i * 70}ms" data-sfx>
        <img loading="lazy" src="${thumb(p)}" alt="第 ${iss.no} 期第 ${p.p} 版">
        <div class="info"><span class="pno">第 ${cnNum(p.p)} 版</span> ${p.sec ? `<span class="tag">${esc(p.sec)}</span>` : ''} ${P.read[p.key] ? '<span class="tag" style="background:#d9f7e6;color:#11643a">✔ 已讀</span>' : ''}
        <div class="h">${esc(p.heads.slice(0, 3).join('／'))}</div></div></a>`).join('')}
    </div>
    <div class="issue-nav">
      ${prev ? `<a class="btn ghost" href="#/issue/${prev.no}" data-sfx>← 第 ${prev.no} 期</a>` : '<span></span>'}
      <a class="btn teal" href="#/issues" data-sfx>📚 回歷期列表</a>
      ${next ? `<a class="btn ghost" href="#/issue/${next.no}" data-sfx>第 ${next.no} 期 →</a>` : '<span></span>'}
    </div>`;
}

/* ================= 閱讀器 ================= */
function vRead(v, [no, pn], q) {
  const iss = byNo.get(+no);
  const pg = iss && (iss.pages.find(p => p.p === +pn) || iss.pages[0]);
  if (!pg) { v.innerHTML = `<div class="empty"><span class="big">🔍</span>找不到這個版面</div>`; return; }
  const flat = ISSUES.flatMap(i => i.pages);
  const fi = flat.indexOf(pg), prevP = flat[fi - 1], nextP = flat[fi + 1];
  const terms = (q.get('q') || '').split(/\s+/).filter(Boolean);
  const isFav = () => P.fav.includes(pg.key);

  // 紀錄閱讀
  const firstTime = !P.read[pg.key];
  P.read[pg.key] = Date.now();
  P.history = [pg.key].concat(P.history.filter(k => k !== pg.key)).slice(0, 60);
  saveP(); if (firstTime) checkBadges();

  v.innerHTML = `
  <div class="reader ${S.panel ? '' : 'nopanel'}">
    <div class="stage" id="stage" tabindex="0" aria-label="版面閱讀區，可用滑鼠滾輪縮放">
      <div class="stage-title">第 ${iss.no} 期・第 ${pg.p} 版${pg.sec ? '・' + esc(pg.sec) : ''}</div>
      <div class="minimap" id="mini" title="縮圖導覽"><img src="${thumb(pg)}" alt=""><i id="miniBox"></i></div>
      <div class="canvas flip" id="cv"><img id="pimg" src="${thumb(pg)}" alt="梅岡風第 ${iss.no} 期第 ${pg.p} 版"></div>
      ${prevP ? `<button class="stage-side l" id="bPrev" aria-label="上一版" title="上一版（←）">‹</button>` : ''}
      ${nextP ? `<button class="stage-side r" id="bNext" aria-label="下一版" title="下一版（→）">›</button>` : ''}
      <div class="stage-tools">
        <button id="zOut" title="縮小（-）" aria-label="縮小">－</button><span class="zoomv" id="zv">100%</span>
        <button id="zIn" title="放大（+）" aria-label="放大">＋</button>
        <button id="zFit" title="整版（0）">整版</button><button id="zW" title="符合寬度">寬度</button>
        <button id="bFav" title="收藏">${isFav() ? '⭐' : '☆'}</button>
        <button id="bFull" title="全螢幕">⛶</button>
        <a id="bOrig" href="${encodeURI(pg.orig)}" target="_blank" rel="noopener" title="開啟原始高解析掃描檔"><button tabindex="-1">原圖</button></a>
      </div>
    </div>
    ${S.panel ? `<aside class="panel">
      <div class="panel-tabs"><button data-t="txt" class="on">📝 本版文字</button><button data-t="pages">🗞️ 本期版面</button><button data-t="info">ℹ️ 資訊</button></div>
      <div class="panel-body" id="pb"></div>
    </aside>` : ''}
  </div>`;

  // ---- 縮放平移 ----
  const stage = $('#stage', v), cv = $('#cv', v), img = $('#pimg', v);
  const IW = pg.w, IH = pg.h;
  let s = 1, tx = 0, ty = 0, fitS = 1;
  cv.style.width = IW + 'px'; cv.style.height = IH + 'px';
  const hi = new Image(); hi.src = web(pg); hi.onload = () => { img.src = hi.src; };
  const apply = () => {
    cv.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
    $('#zv', v).textContent = Math.round(s / fitS * 100) + '%';
    const r = stage.getBoundingClientRect(), mb = $('#miniBox', v);
    const x0 = Math.max(0, -tx / s / IW), y0 = Math.max(0, -ty / s / IH), x1 = Math.min(1, (r.width - tx) / s / IW), y1 = Math.min(1, (r.height - ty) / s / IH);
    Object.assign(mb.style, { left: x0 * 100 + '%', top: y0 * 100 + '%', width: (x1 - x0) * 100 + '%', height: (y1 - y0) * 100 + '%' });
    $('#mini', v).style.display = s / fitS > 1.15 ? '' : 'none';
    if (s / fitS >= 3 && !P.zoomed) { P.zoomed = true; saveP(); award('zoom'); }
  };
  const clamp = () => {
    const r = stage.getBoundingClientRect(), w = IW * s, h = IH * s;
    tx = w <= r.width ? (r.width - w) / 2 : Math.min(40, Math.max(r.width - w - 40, tx));
    ty = h <= r.height ? (r.height - h) / 2 : Math.min(40, Math.max(r.height - h - 40, ty));
  };
  const fit = (mode = 'page') => {
    const r = stage.getBoundingClientRect();
    fitS = Math.min((r.width - 40) / IW, (r.height - 90) / IH);
    s = mode === 'width' ? (r.width - 30) / IW : fitS;
    tx = (r.width - IW * s) / 2; ty = mode === 'width' ? 20 : (r.height - IH * s) / 2 - 20;
    clamp(); apply();
  };
  const zoomAt = (k, cx, cy) => {
    const ns = Math.max(fitS * .6, Math.min(fitS * 8, s * k)); if (ns === s) return;
    tx = cx - (cx - tx) * ns / s; ty = cy - (cy - ty) * ns / s; s = ns; clamp(); apply();
  };
  const zoomTo = (bx, by, bw, bh, k = 2.6) => { // 以 per-mille 區塊為中心放大
    const r = stage.getBoundingClientRect();
    s = Math.max(s, fitS * k); tx = r.width / 2 - (bx + bw / 2) / 1000 * IW * s; ty = r.height / 2 - (by + bh / 2) / 1000 * IH * s; clamp(); apply();
  };
  const center = () => { const r = stage.getBoundingClientRect(); return [r.width / 2, r.height / 2]; };
  requestAnimationFrame(() => fit(store.get('fitmode', 'page')));
  const onResize = () => fit(); addEventListener('resize', onResize);

  stage.addEventListener('wheel', e => {
    e.preventDefault(); const r = stage.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  const pts = new Map(); let last = null, pinch0 = null, moved = 0;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('button,a,.minimap')) return;
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); stage.classList.add('drag'); moved = 0;
    last = [e.clientX, e.clientY];
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s }; }
  });
  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch0) {
      const [a, b] = [...pts.values()], r = stage.getBoundingClientRect();
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomAt(pinch0.s * d / pinch0.d / s, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); return;
    }
    tx += e.clientX - last[0]; ty += e.clientY - last[1]; moved += Math.abs(e.clientX - last[0]) + Math.abs(e.clientY - last[1]);
    last = [e.clientX, e.clientY]; clamp(); apply();
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null; if (!pts.size) stage.classList.remove('drag'); };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('dblclick', e => { if (e.target.closest('button,a')) return; const r = stage.getBoundingClientRect(); SFX.zoom(true); zoomAt(s / fitS > 2.5 ? fitS / s : 2, e.clientX - r.left, e.clientY - r.top); });
  $('#mini', v).addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 1000, y = (e.clientY - r.top) / r.height * 1000;
    zoomTo(x, y, 0, 0, s / fitS); SFX.click();
  });
  $('#zIn', v).onclick = () => { SFX.zoom(true); zoomAt(1.3, ...center()); };
  $('#zOut', v).onclick = () => { SFX.zoom(false); zoomAt(1 / 1.3, ...center()); };
  $('#zFit', v).onclick = () => { SFX.click(); store.set('fitmode', 'page'); fit('page'); };
  $('#zW', v).onclick = () => { SFX.click(); store.set('fitmode', 'width'); fit('width'); };
  $('#bFav', v).onclick = e => {
    if (isFav()) P.fav = P.fav.filter(k => k !== pg.key); else { P.fav.push(pg.key); toast('⭐ 已加入收藏，可在「我的足跡」查看'); }
    saveP(); e.currentTarget.textContent = isFav() ? '⭐' : '☆'; isFav() ? SFX.ok() : SFX.click(); checkBadges();
  };
  $('#bFull', v).onclick = () => { SFX.click(); document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen?.(); };
  const onFs = () => setTimeout(() => fit(), 120); document.addEventListener('fullscreenchange', onFs);
  const goP = p => { if (!p) return; SFX.flip(); go(`#/read/${p.no}/${p.p}` + (terms.length ? '?q=' + encodeURIComponent(terms.join(' ')) : '')); };
  $('#bPrev', v) && ($('#bPrev', v).onclick = () => goP(prevP));
  $('#bNext', v) && ($('#bNext', v).onclick = () => goP(nextP));

  // ---- 標記：搜尋命中 / OCR 框 ----
  const hits = [];
  if (terms.length) {
    pg.L.forEach((l, li) => terms.forEach(t => {
      let i = l[0].indexOf(t);
      while (i >= 0) {
        const n = l[0].length, x0 = l[1] + (l[3] - l[1]) * i / n, x1 = l[1] + (l[3] - l[1]) * (i + t.length) / n;
        hits.push({ li, x: x0, y: l[2], w: x1 - x0, h: l[4] - l[2] }); i = l[0].indexOf(t, i + 1);
      }
    }));
    // 跨行關鍵字（行尾接行首）
    terms.forEach(t => {
      let i = pg.text.indexOf(t);
      while (i >= 0) {
        const li = pg.offs.findIndex((o, k) => o <= i && i < o + pg.L[k][0].length);
        if (li >= 0 && i + t.length > pg.offs[li] + pg.L[li][0].length) { const l = pg.L[li]; hits.push({ li, x: l[1], y: l[2], w: l[3] - l[1], h: l[4] - l[2] }); }
        i = pg.text.indexOf(t, i + 1);
      }
    });
  }
  const box = (cls, b, pad = 4) => { const d = document.createElement('div'); d.className = cls; Object.assign(d.style, { left: (b.x - pad / 2) / 10 + '%', top: (b.y - pad) / 10 + '%', width: (b.w + pad) / 10 + '%', height: (b.h + pad * 1.6) / 10 + '%' }); cv.appendChild(d); return d; };
  if (S.ocrbox) pg.L.forEach(l => box('ocrbox', { x: l[1], y: l[2], w: l[3] - l[1], h: l[4] - l[2] }, 0));
  const hlEls = hits.map(h => box('hl', h));
  let hcur = -1;
  const jumpHit = d => {
    if (!hits.length) return; hcur = (hcur + d + hits.length) % hits.length;
    hlEls.forEach((e, i) => e.classList.toggle('cur', i === hcur)); const h = hits[hcur]; zoomTo(h.x, h.y, h.w, h.h, 2.4); SFX.zoom(true);
    const hn = $('#hn', v); if (hn) hn.textContent = `${hcur + 1} / ${hits.length}`;
  };
  if (hits.length) {
    setTimeout(() => { toast(`🔦 本版找到 <b>${hits.length}</b> 處「${esc(terms.join(' '))}」`); }, 300);
    setTimeout(() => jumpHit(1), 700);
  }

  // ---- 側邊面板 ----
  const pb = $('#pb', v);
  const hlText = s => { let h = esc(s); terms.forEach(t => { h = h.split(esc(t)).join(`<mark>${esc(t)}</mark>`); }); return h; };
  const medH = (() => { const a = pg.L.map(l => l[4] - l[2]).sort((a, b) => a - b); return a[a.length >> 1] || 1; })();
  const tabs = {
    txt() {
      pb.innerHTML = `
        ${hits.length ? `<div class="panel-find"><button class="btn sm" id="hp">▲</button><span class="tag plum" id="hn">– / ${hits.length}</span><button class="btn sm" id="hnx">▼</button><span class="muted small">命中位置</span></div>` : ''}
        <div class="panel-find"><input id="pf" type="search" placeholder="在本版中尋找…" value="${esc(terms.join(' '))}"><button class="btn sm plum" id="pfb">找</button></div>
        <p class="muted small" style="margin:0 0 8px">以下為電腦自動辨識文字，可能有少量錯字；點選任一行可在版面上定位。</p>
        ${pg.L.length ? pg.L.map((l, i) => `<div class="ocr-line ${l[4] - l[2] >= medH * 1.8 ? 'big' : ''}" data-i="${i}">${hlText(l[0])}</div>`).join('') : '<p class="muted">（本版尚無辨識文字）</p>'}`;
      $$('.ocr-line', pb).forEach(el => el.onclick = () => {
        const l = pg.L[+el.dataset.i]; zoomTo(l[1], l[2], l[3] - l[1], l[4] - l[2], 2.2); SFX.zoom(true);
        const f = box('lineflash', { x: l[1], y: l[2], w: l[3] - l[1], h: l[4] - l[2] }); setTimeout(() => f.remove(), 2300);
      });
      const doFind = () => { const t = $('#pf', pb).value.trim(); SFX.search(); go(`#/read/${iss.no}/${pg.p}` + (t ? '?q=' + encodeURIComponent(t) : '')); };
      $('#pfb', pb).onclick = doFind; $('#pf', pb).onkeydown = e => { if (e.key === 'Enter') doFind(); };
      if (hits.length) { $('#hp', pb).onclick = () => jumpHit(-1); $('#hnx', pb).onclick = () => jumpHit(1); if (hcur >= 0) $('#hn', pb).textContent = `${hcur + 1} / ${hits.length}`; }
    },
    pages() {
      pb.innerHTML = `<div class="thumbs-strip">${iss.pages.map(p => `<a href="#/read/${iss.no}/${p.p}${terms.length ? '?q=' + encodeURIComponent(terms.join(' ')) : ''}" class="${p === pg ? 'on' : ''}" title="第${p.p}版"><img src="${thumb(p)}" alt="第${p.p}版"></a>`).join('')}</div>
        ${iss.pages.map(p => `<div style="margin:10px 0"><a href="#/read/${iss.no}/${p.p}"><b>第 ${cnNum(p.p)} 版</b></a> ${p.sec ? `<span class="tag">${esc(p.sec)}</span>` : ''}
        <ul class="heads" style="margin-top:4px">${p.heads.slice(0, 4).map(h => `<li class="small">${esc(h)}</li>`).join('')}</ul></div>`).join('')}
        <div style="display:flex;gap:8px;flex-wrap:wrap">${iss.no > ISSUES[0].no ? `<a class="btn sm ghost" href="#/read/${ISSUES[ISSUES.indexOf(iss) - 1].no}/1">← 上一期</a>` : ''}
        ${ISSUES.indexOf(iss) < ISSUES.length - 1 ? `<a class="btn sm ghost" href="#/read/${ISSUES[ISSUES.indexOf(iss) + 1].no}/1">下一期 →</a>` : ''}</div>`;
    },
    info() {
      pb.innerHTML = `<p><span class="tag plum">第 ${iss.no} 期</span><span class="tag">第 ${pg.p} 版</span>${pg.sec ? `<span class="tag gold">${esc(pg.sec)}</span>` : ''}</p>
        <p>📅 出刊：${dateLabel(iss)}${iss.date ? '<br>🎓 ' + semester(iss) : ''}</p>
        <p>🔤 本版辨識文字：${pg.text.length.toLocaleString()} 字</p>
        <p>👣 你第一次讀到這版：${firstTime ? '就是現在！🎉' : '之前已讀過'}</p>
        <p><a class="btn sm teal" href="${encodeURI(pg.orig)}" target="_blank" rel="noopener">🖼️ 開啟原始高解析掃描檔</a></p>
        <p class="muted small">操作：滾輪縮放、拖曳移動、雙擊放大；鍵盤 ← → 換版，+ − 縮放，0 還原。</p>`;
    }
  };
  if (pb) {
    const tb = $$('.panel-tabs button', v);
    tb.forEach(b => b.onclick = () => { tb.forEach(x => x.classList.toggle('on', x === b)); tabs[b.dataset.t](); SFX.click(); });
    tabs.txt();
  }

  // ---- 鍵盤 ----
  const onKey = e => {
    if (e.target.matches('input,textarea,select')) return;
    if (e.key === 'ArrowLeft') goP(prevP);
    else if (e.key === 'ArrowRight') goP(nextP);
    else if (e.key === '+' || e.key === '=') { SFX.zoom(true); zoomAt(1.3, ...center()); }
    else if (e.key === '-') { SFX.zoom(false); zoomAt(1 / 1.3, ...center()); }
    else if (e.key === '0') fit('page');
    else if (e.key === 'n' && hits.length) jumpHit(1);
    else return;
    e.preventDefault();
  };
  addEventListener('keydown', onKey);
  cleanup = () => { removeEventListener('keydown', onKey); removeEventListener('resize', onResize); document.removeEventListener('fullscreenchange', onFs); };
  // 預載相鄰版面
  [prevP, nextP].forEach(p => { if (p) { const i = new Image(); i.src = web(p); } });
}

/* ================= 全文檢索 ================= */
function vSearch(v, _, q) {
  const kw = (q.get('q') || '').trim();
  const f = { from: +q.get('from') || ISSUES[0]?.no || 1, to: +q.get('to') || ISSUES[ISSUES.length - 1]?.no || 1, y: q.get('y') || '', pg: q.get('pg') || '', sort: q.get('sort') || 'rel' };
  const ys = yearsList();
  const suggestions = ['畢業', '運動會', '校慶', '社團', '獲獎', '冠軍', '國際', '圖書館', '英語', '科展', '志工', '校長'];
  const maxP = Math.max(...ISSUES.map(i => i.pages.length));
  v.innerHTML = `
  <section class="search-hero">
    <h2>🔍 全文檢索　<span style="font-size:.9rem;font-weight:400;opacity:.9">搜尋 ${ISSUES.length} 期、${TOTAL_PAGES} 個版面的辨識文字</span></h2>
    <form class="search-box" id="sf"><input id="sq" type="search" value="${esc(kw)}" placeholder="輸入關鍵字，例如：運動會　或　校慶 班際" aria-label="關鍵字"><button>搜尋</button></form>
    <div class="filters">
      <label>期別 <input type="number" id="ff" min="1" value="${f.from}" style="width:80px"> 至 <input type="number" id="ft" min="1" value="${f.to}" style="width:80px"></label>
      <label>年份 <select id="fy"><option value="">全部</option>${ys.map(([y]) => `<option value="${y}" ${String(y) === f.y ? 'selected' : ''}>${y || '未標示'}</option>`).join('')}</select></label>
      <label>版次 <select id="fp"><option value="">全部</option>${Array.from({ length: maxP }, (_, i) => `<option value="${i + 1}" ${String(i + 1) === f.pg ? 'selected' : ''}>第 ${i + 1} 版</option>`).join('')}</select></label>
      <label>排序 <select id="fo"><option value="rel">命中次數</option><option value="new" ${f.sort === 'new' ? 'selected' : ''}>新 → 舊</option><option value="old" ${f.sort === 'old' ? 'selected' : ''}>舊 → 新</option></select></label>
    </div>
    <div class="suggest"><span>熱門：</span>${suggestions.map(s => `<button type="button" data-s="${s}">${s}</button>`).join('')}</div>
    ${P.lastq.length ? `<div class="suggest"><span>最近搜尋：</span>${P.lastq.map(s => `<button type="button" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
  </section>
  <div id="res"></div>`;
  const submit = (k = $('#sq', v).value.trim()) => {
    const p = new URLSearchParams(); if (k) p.set('q', k);
    const ff = +$('#ff', v).value, ft = +$('#ft', v).value;
    if (ff !== ISSUES[0].no) p.set('from', ff); if (ft !== ISSUES[ISSUES.length - 1].no) p.set('to', ft);
    if ($('#fy', v).value) p.set('y', $('#fy', v).value); if ($('#fp', v).value) p.set('pg', $('#fp', v).value);
    if ($('#fo', v).value !== 'rel') p.set('sort', $('#fo', v).value);
    go('#/search?' + p.toString());
  };
  $('#sf', v).onsubmit = e => { e.preventDefault(); submit(); };
  $$('#fy,#fp,#fo', v).forEach(s => s.onchange = () => { SFX.click(); kw && submit(); });
  $$('#ff,#ft', v).forEach(s => s.onchange = () => { kw && submit(); });
  $$('.suggest button', v).forEach(b => b.onclick = () => { $('#sq', v).value = b.dataset.s; SFX.click(); submit(b.dataset.s); });
  const res = $('#res', v);
  if (!kw) {
    res.innerHTML = `<div class="empty"><span class="big">🌸</span>輸入關鍵字，從歷年梅岡風中找出相關報導<br><span class="small">小提示：輸入人名、活動、社團或班級都可以喔！</span></div>`;
    setTimeout(() => $('#sq', v).focus(), 50); return;
  }
  const terms = kw.split(/\s+/).filter(Boolean);
  const t0 = performance.now();
  let rows = [];
  ISSUES.forEach(iss => {
    if (iss.no < f.from || iss.no > f.to) return;
    if (f.y && String(iss.year || 0) !== f.y) return;
    iss.pages.forEach(pg => {
      if (f.pg && pg.p !== +f.pg) return;
      let cnt = 0, first = -1;
      for (const t of terms) {
        let c = 0, i = pg.text.indexOf(t); if (i < 0) { cnt = 0; break; }
        if (first < 0 || i < first) first = i;
        while (i >= 0) { c++; i = pg.text.indexOf(t, i + t.length); }
        cnt += c;
      }
      if (cnt) rows.push({ iss, pg, cnt, first });
    });
  });
  const ms = performance.now() - t0;
  P.searches++; P.lastq = [kw].concat(P.lastq.filter(x => x !== kw)).slice(0, 6); saveP(); checkBadges();
  if (f.sort === 'rel') rows.sort((a, b) => b.cnt - a.cnt || b.iss.no - a.iss.no);
  else if (f.sort === 'new') rows.sort((a, b) => b.iss.no - a.iss.no || a.pg.p - b.pg.p);
  else rows.sort((a, b) => a.iss.no - b.iss.no || a.pg.p - b.pg.p);
  if (!rows.length) {
    SFX.none();
    res.innerHTML = `<div class="empty"><span class="big">🍃</span>找不到「${esc(kw)}」<br><span class="small">試試較短的關鍵字、減少關鍵字數量，或放寬篩選條件。<br>（文字為電腦辨識，少數字可能辨識錯誤）</span></div>`; return;
  }
  SFX.search(); if (window.gust) window.gust();
  const per = new Map(); rows.forEach(r => per.set(r.iss.no, (per.get(r.iss.no) || 0) + r.cnt));
  const inRange = ISSUES.filter(i => i.no >= f.from && i.no <= f.to);
  const mx = Math.max(...per.values());
  const snippet = pg => {
    const out = []; let i = 0; const used = [];
    for (const t of terms) {
      let k = pg.text.indexOf(t);
      while (k >= 0 && out.length < 3) {
        if (!used.some(u => Math.abs(u - k) < 40)) { used.push(k); const a = Math.max(0, k - 28), b = Math.min(pg.text.length, k + t.length + 36); out.push((a > 0 ? '…' : '') + pg.text.slice(a, b) + (b < pg.text.length ? '…' : '')); }
        k = pg.text.indexOf(t, k + t.length);
      }
    }
    return out.map(s => { let h = esc(s); terms.forEach(t => h = h.split(esc(t)).join(`<mark>${esc(t)}</mark>`)); return `<div class="snip">${h}</div>`; }).join('');
  };
  const total = rows.reduce((s, r) => s + r.cnt, 0);
  let shown = 0; const STEP = 30;
  res.innerHTML = `
    <h2 class="sec-title">「${esc(kw)}」共 ${total} 處，出現在 ${rows.length} 個版面、${per.size} 期 <span class="muted small" style="margin-left:auto">${ms.toFixed(0)} 毫秒</span></h2>
    <div class="card"><b>📊 各期出現次數</b><span class="muted small">（點長條可只看該期）</span>
      <div class="hitchart">${inRange.map((i, k) => { const c = per.get(i.no) || 0; return `<div class="bar ${c ? '' : 'zero'}" style="height:${c ? Math.max(6, c / mx * 100) : 2}%;animation-delay:${k * 15}ms" title="第 ${i.no} 期：${c} 次" data-no="${i.no}"></div>`; }).join('')}</div>
      <div class="hitchart-x">${inRange.map(i => `<span>${i.no % 5 === 0 ? i.no : ''}</span>`).join('')}</div>
    </div>
    <div class="results" id="rl"></div>
    <div style="text-align:center;margin-top:18px"><button class="btn" id="more">顯示更多結果</button></div>`;
  $$('.bar', res).forEach(b => b.onclick = () => { SFX.click(); $('#ff', v).value = b.dataset.no; $('#ft', v).value = b.dataset.no; submit(kw); });
  const more = () => {
    $('#rl', res).insertAdjacentHTML('beforeend', rows.slice(shown, shown + STEP).map((r, i) => `
      <a class="result" href="#/read/${r.iss.no}/${r.pg.p}?q=${encodeURIComponent(kw)}" style="animation-delay:${i * 30}ms" data-sfx>
        <img loading="lazy" src="${thumb(r.pg)}" alt="">
        <div><b>第 ${r.iss.no} 期・第 ${r.pg.p} 版</b> ${r.pg.sec ? `<span class="tag">${esc(r.pg.sec)}</span>` : ''}<span class="tag plum">${r.cnt} 處</span><span class="muted small">${dateLabel(r.iss)}</span>
        ${snippet(r.pg)}</div></a>`).join(''));
    shown += STEP; $('#more', res).hidden = shown >= rows.length;
  };
  $('#more', res).onclick = () => { SFX.click(); more(); };
  more();
}

/* ================= 時光軸 ================= */
function vTimeline(v) {
  if (!P.tl) { P.tl = true; saveP(); checkBadges(); }
  const ys = yearsList();
  v.innerHTML = `<h2 class="sec-title" style="margin-top:6px">🕰️ 梅岡風時光軸</h2>
  <p class="muted">沿著時間軸，看見梅岡校園一路走來的足跡。點選任一期即可閱讀。</p>
  <div class="years" style="position:sticky;top:90px;z-index:5;padding:8px 0;background:var(--bg)">${ys.map(([y], i) => `<button class="year-chip" style="background:${COLORS[i % COLORS.length]};padding:4px 14px;font-size:.95rem" data-y="${y}">${y || '未標'}</button>`).join('')}</div>
  <div class="tl">${ys.map(([y, l]) => `<div class="tl-year" id="y${y}"><h3>${y ? y + ' 年（民國 ' + (y - 1911) + ' 年）' : '日期未標示'}</h3>
    <div class="tl-items">${l.map(i => `<a class="tl-item" href="#/issue/${i.no}" data-sfx><img loading="lazy" src="${thumb(i.pages[0])}" alt=""><div><b>第 ${i.no} 期</b><br><span class="small muted">${i.month ? i.month + ' 月號' : ''}</span></div></a>`).join('')}</div></div>`).join('')}</div>`;
  $$('button[data-y]', v).forEach(b => b.onclick = () => { SFX.click(); const el = $('#y' + b.dataset.y, v); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 170, behavior: 'smooth' }); });
  if (S.motion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.style.animation = 'pop .5s ease both'; io.unobserve(e.target); } }), { threshold: .1 });
    $$('.tl-year', v).forEach(el => io.observe(el));
  }
}

/* ================= 猜猜第幾期 ================= */
function vGame(v) {
  let streak = 0, score = 0, round = 0, lock = false;
  const withDate = ISSUES.filter(i => i.year);
  const mode = withDate.length >= 4 ? 'year' : 'no';
  v.innerHTML = `<h2 class="sec-title" style="margin-top:6px">🎲 猜猜這是哪${mode === 'year' ? '一年' : '一期'}？</h2>
  <p class="muted">版面上方的日期已被遮住，畫面也有點模糊……從內容線索推理看看！答題越快、越少提示，分數越高。</p>
  <div class="game">
    <div><div class="game-img" id="gi"><img id="gimg" alt="題目版面"><div class="mask">？？？ 日期已遮蔽 ？？？</div></div>
    <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap"><button class="btn sm gold" id="hint">💡 看清楚一點（−2 分）</button></div></div>
    <div>
      <div class="score"><div>本局得分 <b id="sc">0</b></div><div>連續答對 <b id="st">0</b></div><div>最佳連勝 <b id="bs">${P.game.best}</b></div><div>第 <b id="rd">1</b> 題</div></div>
      <div class="choices" id="ch"></div>
      <div id="fb" class="card" style="min-height:90px">選出你的答案吧！</div>
    </div>
  </div>`;
  let ans, blur, pts;
  const next = () => {
    lock = false; round++; blur = 10; pts = 10;
    const iss = (mode === 'year' ? withDate : ISSUES)[Math.floor(Math.random() * (mode === 'year' ? withDate : ISSUES).length)];
    const pg = iss.pages[Math.floor(Math.random() * iss.pages.length)];
    ans = { iss, pg, v: mode === 'year' ? iss.year : iss.no };
    const pool = [...new Set((mode === 'year' ? withDate.map(i => i.year) : ISSUES.map(i => i.no)))].filter(x => x !== ans.v);
    const opts = [ans.v]; while (opts.length < 4 && pool.length) opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    opts.sort(() => Math.random() - .5);
    const gi = $('#gi', v); gi.style.setProperty('--blur', blur + 'px'); $('#gimg', v).src = thumb(pg);
    $('#rd', v).textContent = round;
    $('#ch', v).innerHTML = opts.map(o => `<button class="choice" data-v="${o}">${mode === 'year' ? o + ' 年' : '第 ' + o + ' 期'}</button>`).join('');
    $$('.choice', v).forEach(b => b.onclick = () => pick(b));
    $('#fb', v).innerHTML = '選出你的答案吧！';
  };
  const pick = b => {
    if (lock) return; lock = true;
    const ok = +b.dataset.v === ans.v;
    $$('.choice', v).forEach(x => { if (+x.dataset.v === ans.v) x.classList.add('ok'); });
    $('#gi', v).style.setProperty('--blur', '0px');
    if (ok) { streak++; score += pts; SFX.ok(); if (streak >= 3) confetti(30); }
    else { b.classList.add('bad'); streak = 0; SFX.bad(); }
    P.game.played++; if (streak > P.game.best) P.game.best = streak; saveP(); checkBadges();
    $('#sc', v).textContent = score; $('#st', v).textContent = streak; $('#bs', v).textContent = P.game.best;
    $('#fb', v).innerHTML = `${ok ? `<b style="color:#22a05a">🎉 答對了！+${pts} 分</b>` : '<b style="color:var(--plum)">😅 可惜，答錯了</b>'}<br>
      答案是 <b>第 ${ans.iss.no} 期・第 ${ans.pg.p} 版</b>（${dateLabel(ans.iss)}）<br>
      <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap"><button class="btn sm plum" id="nx">下一題 →</button><a class="btn sm ghost" href="#/read/${ans.iss.no}/${ans.pg.p}">閱讀這一版</a></div>`;
    $('#nx', v).onclick = () => { SFX.click(); next(); };
  };
  $('#hint', v).onclick = () => { if (lock || blur <= 0) return; blur = Math.max(0, blur - 5); pts = Math.max(2, pts - 2); $('#gi', v).style.setProperty('--blur', blur + 'px'); SFX.zoom(true); };
  next();
}

/* ================= 我的足跡 ================= */
function vMe(v) {
  const got = BADGES.filter(b => P.badges[b[0]]).length;
  const favs = P.fav.map(k => ISSUES.flatMap(i => i.pages).find(p => p.key === k)).filter(Boolean);
  const hist = P.history.map(k => ISSUES.flatMap(i => i.pages).find(p => p.key === k)).filter(Boolean).slice(0, 12);
  v.innerHTML = `<h2 class="sec-title" style="margin-top:6px">🏅 我的足跡</h2>
  <div class="stats">
    <div class="stat"><b data-to="${readCount()}">0</b><span>已讀版面 / ${TOTAL_PAGES}</span><i>📖</i></div>
    <div class="stat"><b data-to="${ISSUES.filter(i => i.pages.every(p => P.read[p.key])).length}">0</b><span>完整讀完的期數</span><i>📰</i></div>
    <div class="stat"><b data-to="${got}">0</b><span>徽章 / ${BADGES.length}</span><i>🏅</i></div>
    <div class="stat"><b data-to="${P.searches}">0</b><span>次搜尋</span><i>🔎</i></div>
  </div>
  <h2 class="sec-title">徽章收藏</h2>
  <div class="badges">${BADGES.map(b => `<div class="badge ${P.badges[b[0]] ? 'got' : ''}"><span class="b-ic">${b[1]}</span><b>${b[2]}</b><small>${b[3]}</small>
    ${P.badges[b[0]] ? `<small>✔ ${new Date(P.badges[b[0]]).toLocaleDateString('zh-TW')}</small>` : '<small>🔒 尚未解鎖</small>'}</div>`).join('')}</div>
  <h2 class="sec-title">閱讀熱度地圖 <span class="muted small" style="margin-left:auto">顏色越深＝該期讀過越多版</span></h2>
  <div class="card"><div class="heat">${ISSUES.map(i => { const n = i.pages.filter(p => P.read[p.key]).length, r = n / i.pages.length; return `<a href="#/issue/${i.no}" class="${r === 0 ? '' : r < .34 ? 'l1' : r < .67 ? 'l2' : r < 1 ? 'l3' : 'l4'}" title="第 ${i.no} 期：已讀 ${n}/${i.pages.length}">${i.no}</a>`; }).join('')}</div></div>
  <h2 class="sec-title">⭐ 我的收藏</h2>
  ${favs.length ? `<div class="pages-grid">${favs.map(p => `<a class="page-card" href="#/read/${p.no}/${p.p}"><img loading="lazy" src="${thumb(p)}" alt=""><div class="info"><span class="pno">第 ${p.no} 期・第 ${p.p} 版</span><div class="h">${esc(p.heads.slice(0, 2).join('／'))}</div></div></a>`).join('')}</div>`
      : '<div class="card muted">還沒有收藏。閱讀時按工具列的 ☆ 就能收藏喜歡的版面。</div>'}
  <h2 class="sec-title">👣 最近閱讀</h2>
  ${hist.length ? `<div class="tl-items">${hist.map(p => `<a class="tl-item" href="#/read/${p.no}/${p.p}"><img loading="lazy" src="${thumb(p)}" alt=""><div><b>第 ${p.no} 期</b><br><span class="small muted">第 ${p.p} 版</span></div></a>`).join('')}</div>` : '<div class="card muted">還沒有閱讀紀錄，快去翻翻看吧！</div>'}
  <p style="margin-top:28px"><button class="btn sm ghost" id="reset">🗑️ 清除我的閱讀紀錄</button> <a class="btn sm ghost" href="#/help">🛠️ 網站維護說明</a></p>`;
  $$('.stat b', v).forEach(countUp);
  $('#reset', v).onclick = () => {
    if (!confirm('確定要清除所有閱讀紀錄、收藏與徽章嗎？')) return;
    Object.assign(P, { read: {}, fav: [], searches: 0, history: [], badges: {}, game: { best: 0, played: 0 }, tl: false, lastq: [], zoomed: false }); saveP(); SFX.click(); route();
  };
}

/* ================= 維護說明 ================= */
function vHelp(v) {
  v.innerHTML = `<h2 class="sec-title" style="margin-top:6px">🛠️ 如何新增期別</h2>
  <div class="card"><ol class="help-steps">
    <li>把新一期的掃描圖放進與網站資料夾同層的 <code>梅岡風</code> 資料夾，檔名格式：<code>梅岡風45期第1版.JPG</code>、<code>梅岡風45期第2版.JPG</code>……（超過 4 版也可以）。</li>
    <li>雙擊網站資料夾中的 <code>更新網站.bat</code>，程式會自動產生網頁圖片並辨識文字（只處理新增的檔案）。</li>
    <li>完成後重新整理網頁，新的一期就會出現在首頁、歷期瀏覽、時光軸與檢索中。</li>
    <li>若自動辨識的出刊日期不正確，或想加上專刊名稱，可編輯 <code>data/meta.json</code>，例如：<code>"45": {"date": "2026-12", "title": "校慶特刊"}</code>，再執行一次 <code>更新網站.bat</code>。</li>
  </ol>
  <p class="muted small">資料建置時間：${esc(DATA.built || '')}</p></div>`;
}

/* ================= 啟動 ================= */
function init() {
  applySettings(); buildSettings(); petals();
  $('#footStat').textContent = `收錄第 ${ISSUES[0]?.no ?? '-'} 期至第 ${ISSUES[ISSUES.length - 1]?.no ?? '-'} 期，共 ${ISSUES.length} 期 ${TOTAL_PAGES} 個版面・資料更新：${DATA.built || ''}`;
  $('#quickSearch').onsubmit = e => { e.preventDefault(); const k = $('#quickQ').value.trim(); go('#/search' + (k ? '?q=' + encodeURIComponent(k) : '')); $('#quickQ').blur(); };
  addEventListener('keydown', e => {
    if (e.key === '/' && !e.target.matches('input,textarea,select')) { e.preventDefault(); $('#quickQ').focus(); }
    if (e.key === 'Escape') { $('#settings').hidden = true; }
  });
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) { SFX.open(); go(g.dataset.go); return; }
    if (e.target.closest('.nav a,[data-sfx],.tag,.btn,.tl-item,.heat a')) SFX.click();
  });
  document.addEventListener('pointerover', e => { if (e.pointerType === 'mouse' && e.target.closest('.nav a,.year-chip,.issue-card')) SFX.hover(); });
  $('.brand').addEventListener('click', () => { SFX.wind(); window.gust && window.gust(); });
  addEventListener('hashchange', route);
  route();
  award('first');
}
init();
})();
