import { createNet, rid } from './net.js';
import { RULES } from './config.js';
import { CARDS } from './cards.js';
import { Host } from './host.js';
import { esc, cardHTML, hiddenCardHTML, avatarHTML, galleryHTML } from './view.js';
import { CHAR_OPTS, charSVG, defaultChar, validChar, cycleChar } from './chars.js';
import { playReplay } from './replay.js';
import * as V from './vfx.js';
import { sfx, music, unlockAudio, isMuted, setMuted } from './sfx.js';

const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

const S = {
  net: null, uid: null, inst: rid(), ready: false,
  meta: {}, lobby: {}, pub: null, priv: null,
  joined: false, presenceOff: null,
  host: null, hostOffSince: null, claiming: false,
  sel: null, pickSel: null, removeSel: null, pickKey: '',
  pending: null, pendingAt: 0, hiddenU: null,
  modal: null, fxSeen: -1, fxGame: null, lastCur: undefined, pendingFlash: false,
  offSince: {},
  myChar: null,
  drag: null, suppressClick: false, renderPending: false,
  replay: null, replaySeen: undefined, replayGame: null,
  resultSeen: null,
  abortArm: 0,
};

const $ = s => document.querySelector(s);
const app = $('#app');
const isOnline = m => !!m?.conn;
const active = () => !S.joined || S.lobby[S.uid]?.inst === S.inst;
const onlineMembers = () => Object.entries(S.lobby).filter(([, m]) => isOnline(m) && m.name).sort((a, b) => a[1].joinedAt - b[1].joinedAt);
const name = u => S.pub?.players[u]?.name ?? S.lobby[u]?.name ?? '?';
const charOf = u => {
  const c = S.pub?.players[u]?.char;
  if (validChar(c)) return c;
  if (u === S.uid && S.myChar) return S.myChar;
  return validChar(S.lobby[u]?.char) ? S.lobby[u].char : defaultChar(u);
};
const ava = (u, extra = '') => avatarHTML(u, name(u), extra, charOf(u));

boot();

async function boot() {
  app.innerHTML = '<div class="screen center"><div class="logo">허리펴라</div><p class="muted">연결하는 중…</p></div>';
  V.initVfx();
  try {
    S.net = await createNet();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="screen center"><div class="logo">허리펴라</div><p class="err">서버에 연결하지 못했어요.<br><small>${esc(e.message)}</small></p></div>`;
    return;
  }
  S.uid = S.net.uid;
  try { S.myChar = JSON.parse(store.get('hp_char_' + S.uid)); } catch {}
  if (!validChar(S.myChar)) S.myChar = defaultChar(S.uid);

  S.net.on('meta', v => { S.meta = v || {}; update(); });
  S.net.on('lobby', v => { S.lobby = v || {}; update(); });
  S.net.on('pub', v => { S.pub = v?.s ? JSON.parse(v.s) : null; update(); });
  S.net.on('priv/' + S.uid, v => { S.priv = v?.s ? JSON.parse(v.s) : null; update(); });

  // 같은 브라우저에서 새로고침했으면 기존 자리로 복귀
  const mine = await S.net.get('lobby/' + S.uid);
  if (mine?.name) await join(mine.name);
  S.ready = true;

  document.addEventListener('click', onClick);
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', () => endDrag(null));
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'nick') doJoin();
    if (e.key === 'Escape') { S.sel = null; S.modal = null; render(); }
  });
  setInterval(onTick, 250);
  update();
}

async function join(nick) {
  const prev = await S.net.get('lobby/' + S.uid);
  await S.net.update({
    [`lobby/${S.uid}/name`]: nick,
    [`lobby/${S.uid}/joinedAt`]: prev?.joinedAt || S.net.now(),
    [`lobby/${S.uid}/inst`]: S.inst,
  });
  S.presenceOff?.();
  S.presenceOff = S.net.presence(`lobby/${S.uid}/conn/${S.inst}`);
  S.joined = true;
  store.set('hp_name', nick);
  saveChar();
}

// 캐릭터는 따로 저장한다 (보안 규칙이 아직 char를 모르면 이 쓰기만 실패하고 참가는 그대로 된다)
function saveChar() {
  store.set('hp_char_' + S.uid, JSON.stringify(S.myChar));
  if (S.joined) S.net.set(`lobby/${S.uid}/char`, S.myChar).catch(e => console.warn('캐릭터 저장 실패', e.message));
}

async function leave() {
  const off = S.presenceOff;
  S.presenceOff = null;
  S.joined = false;
  await off?.();
  await S.net.set('lobby/' + S.uid, null);
  render();
}

function update() {
  if (!S.ready) return;
  // 내 자리가 목록에 보인 뒤에 사라졌을 때만 퇴장으로 본다 (참가 직후 아직 반영 전인 경우 제외)
  if (S.lobby[S.uid]) S.seenMe = true;
  else if (S.joined && S.seenMe) {
    S.joined = false;
    S.seenMe = false;
  }
  hostDuty();
  checkAck();
  checkReplay();
  syncSelection();
  render();
}

// ── 호스트 역할 ──
// 호스트 uid의 활성 탭 하나만 판정기를 돌린다. 호스트가 끊기면 유예 시간 뒤 가장 먼저 들어온 접속자가 이어받는다.
function hostDuty() {
  const m = S.meta;
  if (!S.joined || !active()) return stopHost();
  if (m.hostId === S.uid) {
    S.hostOffSince = null;
    if (m.hostInst !== S.inst) {
      stopHost();
      S.net.update({ 'meta/hostInst': S.inst });
      return;
    }
    if (!S.host) {
      S.host = new Host(S.net);
      S.host.start(m);
    }
    return;
  }
  stopHost();
  if (m.hostId && isOnline(S.lobby[m.hostId])) {
    S.hostOffSince = null;
    return;
  }
  const now = S.net.now();
  S.hostOffSince ??= now;
  const grace = !m.hostId ? 0 : m.status === 'playing' ? RULES.hostGraceMs : RULES.lobbyGraceMs;
  if (now - S.hostOffSince < grace) return;
  if (onlineMembers()[0]?.[0] === S.uid) claimHost(m.hostId || null);
}

function stopHost() {
  if (!S.host) return;
  S.host.stop();
  S.host = null;
}

async function claimHost(prev) {
  if (S.claiming) return;
  S.claiming = true;
  let ended = false;
  try {
    const ok = await S.net.transaction('meta', m => {
      m = m || {};
      if ((m.hostId || null) !== prev) return undefined;
      m.hostId = S.uid;
      m.hostInst = S.inst;
      if (m.status === 'playing') {
        ended = true;
        m.status = 'lobby';
        m.gameId = null;
        m.notice = '호스트 연결이 끊겨서 게임이 종료됐어요';
      }
      m.status ||= 'lobby';
      return m;
    });
    if (ok && (ended || prev)) await S.net.update({ pub: null, priv: null, req: null, hs: null });
  } catch (e) {
    console.error('호스트 지정 실패', e);
  }
  S.claiming = false;
}

// ── 행동 요청 ──
function sendReq(type, data = {}) {
  if (S.pending || !S.pub) return false;
  const id = rid();
  S.pending = id;
  S.pendingAt = Date.now();
  const body = { gameId: S.pub.gameId, turnNo: S.pub.turnNo, type, card: data.card ?? null, target: data.target ?? null, t: S.net.now() };
  S.net.set(`req/${S.uid}/${id}`, body).catch(e => {
    console.error(e);
    S.pending = null;
    S.hiddenU = null;
    toast('요청을 보내지 못했어요');
    render();
  });
  render();
  return true;
}

function checkAck() {
  const a = S.priv?.ack;
  if (S.pending && a?.id === S.pending) {
    S.pending = null;
    S.hiddenU = null;
    if (a.err) toast(a.err);
  }
}

// 새 턴 종료 기록이 오면 전투 연출을 재생한다 (처음 접속했을 때 이미 있던 기록은 건너뛴다)
function checkReplay() {
  const r = S.pub?.replay;
  if (!S.pub || S.replayGame !== S.pub.gameId) {
    S.replayGame = S.pub?.gameId ?? null;
    S.replaySeen = r?.n;
    return;
  }
  if (!r || r.n === S.replaySeen) return;
  S.replaySeen = r.n;
  const field = $('.field');
  if (!r.plays.length || document.hidden || !field) return;
  S.replay?.stop();
  S.modal = null;
  S.sel = null;
  renderModal();
  const ctl = playReplay(r, { field, shakeEl: app, players: S.pub.players, nameOf: name });
  S.replay = ctl;
  ctl.finished.then(() => {
    if (S.replay !== ctl) return;
    S.replay = null;
    S.fxSeen = S.pub?.fx.at(-1)?.n ?? S.fxSeen;
    if (S.pendingFlash) { S.pendingFlash = false; flash('내 턴!'); sfx.turn(); }
    S.renderPending = false;
    render(true);
  });
}

function syncSelection() {
  const p = S.pub, priv = myPriv();
  if (S.sel && !priv?.hand.some(c => c.u === S.sel)) S.sel = null;
  const key = p ? `${p.gameId}:${p.round}:${p.phase}` : '';
  if (key !== S.pickKey) {
    S.pickKey = key;
    S.pickSel = null;
    S.removeSel = null;
  }
  if (p && p.cur !== S.lastCur) {
    if (p.cur === S.uid && S.lastCur !== undefined) {
      if (S.replay) S.pendingFlash = true;
      else { flash('내 턴!'); sfx.turn(); }
    }
    S.lastCur = p.cur;
  }
}

const myPriv = () => (S.priv && S.pub && S.priv.gameId === S.pub.gameId ? S.priv : null);
const myTurnNow = () => S.pub?.phase === 'battle' && S.pub.cur === S.uid;

// 손패 카드를 지금 쓸 수 없는 이유 ('' = 사용 가능)
function blockReason(c) {
  const p = S.pub, me = p?.players[S.uid], priv = myPriv();
  const d = CARDS[c.id];
  if (!me || !priv || p.phase !== 'battle' || p.cur !== S.uid) return '내 턴에만 쓸 수 있어요';
  if (priv.energy < d.cost) return '에너지가 부족해요';
  if (d.limit && (priv.plays?.[c.id] || 0) >= d.limit) return `한 턴에 ${d.limit}번까지 쓸 수 있어요`;
  if (d.type === 'react' && priv.react) return '반응 카드는 하나만 설치할 수 있어요';
  return '';
}

// ── 카드 드래그 ──
// 공격(상대 1명) 카드: 화살표로 친구를 겨눠 놓으면 사용. 나머지: 손패 위로 끌어 올려 놓으면 사용.
function onPointerDown(e) {
  unlockAudio();
  const el = e.target.closest('.hand .card[data-u]');
  if (!el || e.button > 0 || S.replay) return;
  S.drag = { el, u: el.dataset.u, id: el.dataset.id, x0: e.clientX, y0: e.clientY, moved: false };
}

function onPointerMove(e) {
  const D = S.drag;
  if (!D) return;
  if (!D.moved) {
    if (Math.hypot(e.clientX - D.x0, e.clientY - D.y0) < 8) return;
    startDrag(e);
  }
  moveDrag(e);
}

function onPointerUp(e) {
  const D = S.drag;
  if (!D) return;
  if (D.moved) {
    // 같은 자리에서 놓으면 뒤따르는 click을 무시한다. 다른 곳에서 놓으면 click이 오지 않으므로 바로 해제.
    S.suppressClick = true;
    setTimeout(() => { S.suppressClick = false; });
    endDrag(e);
  } else S.drag = null;
}

function startDrag(e) {
  const D = S.drag;
  D.moved = true;
  D.card = CARDS[D.id];
  D.why = S.pending ? '처리 중이에요' : blockReason({ id: D.id });
  D.aim = D.card.scope === 'one' && !D.why;
  S.sel = null;
  const r = D.el.getBoundingClientRect();
  D.w = r.width;
  D.h = r.height;
  D.dockTop = $('.dock')?.getBoundingClientRect().top ?? innerHeight * .6;
  D.el.classList.add('dragging-src');
  const layer = $('#drag');
  layer.innerHTML = `<div class="drag-ghost ${D.why ? 'no' : ''}">${cardHTML(D.id, { act: '' })}</div>
    <svg class="drag-arrow" width="100%" height="100%"><path class="arrow-line"/><path class="arrow-head"/></svg>
    <div class="drag-hint">${D.why ? esc(D.why) : D.aim ? '🎯 친구에게 끌어다 놓기' : '⬆ 위로 끌어 올려 사용'}</div>`;
  D.ghost = layer.querySelector('.drag-ghost');
  D.ghost.style.width = `${D.w}px`;
  D.ghost.querySelector('.card').style.setProperty('--cw', `${D.w}px`);
  layer.classList.add('on');
  if (D.aim) {
    document.body.classList.add('aiming');
    for (const b of document.querySelectorAll('.fighter')) {
      const p = S.pub.players[b.dataset.pid];
      b.classList.toggle('targetable', !!p?.alive && b.dataset.pid !== S.uid);
      b.classList.toggle('dim', !p?.alive || b.dataset.pid === S.uid);
    }
    // 카드는 손패 위 가운데로 들어 올리고 화살표로 겨눈다
    D.ax = Math.min(Math.max(r.left + r.width / 2, D.w), innerWidth - D.w);
    D.ay = D.dockTop - D.h * .15;
    D.ghost.style.transform = `translate(${D.ax - D.w / 2}px, ${D.ay - D.h / 2}px) scale(1.08)`;
  }
  sfx.pickup();
}

function moveDrag(e) {
  const D = S.drag;
  const x = e.clientX, y = e.clientY;
  if (D.aim) {
    const hit = document.elementFromPoint(x, y)?.closest('.fighter.targetable');
    for (const b of document.querySelectorAll('.fighter.locked')) if (b !== hit) b.classList.remove('locked');
    if (hit && !hit.classList.contains('locked')) { hit.classList.add('locked'); sfx.click(); }
    D.lock = hit?.dataset.pid || null;
    const sx = D.ax, sy = D.ay - D.h / 2;
    const cx = sx, cy = Math.min(sy, y) - Math.abs(x - sx) * .25 - 40;
    const svg = $('#drag .drag-arrow');
    svg.classList.toggle('locked', !!D.lock);
    svg.querySelector('.arrow-line').setAttribute('d', `M${sx},${sy} Q${cx},${cy} ${x},${y}`);
    const ang = Math.atan2(y - cy, x - cx);
    const L = 22, W = .5;
    svg.querySelector('.arrow-head').setAttribute('d', `M${x + Math.cos(ang) * 6},${y + Math.sin(ang) * 6} L${x - Math.cos(ang - W) * L},${y - Math.sin(ang - W) * L} L${x - Math.cos(ang + W) * L},${y - Math.sin(ang + W) * L}Z`);
  } else {
    D.ready = !D.why && y < D.dockTop - 10;
    D.ghost.classList.toggle('ready', D.ready);
    D.ghost.style.transform = `translate(${x - D.w / 2}px, ${y - D.h * .6}px) rotate(${Math.max(-12, Math.min(12, (x - D.x0) * .05))}deg) scale(${D.ready ? 1.12 : 1})`;
  }
}

function endDrag(e) {
  const D = S.drag;
  S.drag = null;
  if (!D?.moved) return;
  document.body.classList.remove('aiming');
  for (const b of document.querySelectorAll('.fighter')) b.classList.remove('targetable', 'dim', 'locked');
  const layer = $('#drag');
  const clear = () => { layer.classList.remove('on'); layer.innerHTML = ''; D.el.classList.remove('dragging-src'); flushRender(); };
  const ok = e && !D.why && (D.aim ? !!D.lock : D.ready);
  if (!ok) {
    if (e && D.why) toast(D.why);
    // 원래 자리로 돌아가기
    const r = D.el.getBoundingClientRect();
    D.ghost.animate([{ transform: D.ghost.style.transform }, { transform: `translate(${r.left}px, ${r.top}px)` }], { duration: 180, easing: 'ease-in' }).onfinish = clear;
    return;
  }
  const target = D.aim ? D.lock : null;
  let tx = e.clientX, ty = e.clientY;
  if (target) {
    const r = document.querySelector(`.fighter[data-pid="${target}"] .f-body`).getBoundingClientRect();
    tx = r.left + r.width / 2;
    ty = r.top + r.height / 2;
    V.ring(tx, ty, { color: '#ff5d6c', r1: 70, w: 6 });
    V.burst(tx, ty, { n: 14, speed: 7, colors: ['#ff5d6c', '#ffd23f', '#fff'] });
  } else {
    V.ring(tx, ty, { color: '#ffd23f', r1: 80, w: 6 });
    V.sparkle(tx, ty, { colors: ['#ffd23f', '#fff'] });
  }
  sfx.card();
  D.ghost.animate([{ transform: D.ghost.style.transform, opacity: 1 }, { transform: `translate(${tx - D.w / 2}px, ${ty - D.h / 2}px) scale(.3)`, opacity: 0 }],
    { duration: 220, easing: 'cubic-bezier(.5,0,.9,.5)' }).onfinish = clear;
  if (sendReq('play', { card: D.u, target })) S.hiddenU = D.u;
}

// ── 클릭 처리 ──
function onClick(e) {
  if (S.suppressClick) { S.suppressClick = false; return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (el.tagName === 'BUTTON') sfx.click();
  switch (act) {
    case 'join': return doJoin();
    case 'leave': return leave();
    case 'gallery': S.modal = 'gallery'; return render();
    case 'deck': S.modal = 'deck'; return render();
    case 'log': S.modal = 'log'; return render();
    case 'close': S.modal = null; return render();
    case 'takeover':
      S.net.update({ [`lobby/${S.uid}/inst`]: S.inst });
      S.presenceOff?.();
      S.presenceOff = S.net.presence(`lobby/${S.uid}/conn/${S.inst}`);
      return;
    case 'start': return startGame();
    case 'rematch': return S.host?.toLobby(null, S.lobby);
    case 'abort':
      // 실수로 누르지 않게 3초 안에 한 번 더 눌러야 종료
      if (!S.host) return;
      if (Date.now() - S.abortArm < 3000) {
        S.abortArm = 0;
        S.replay?.stop();
        return S.host.toLobby('호스트가 게임을 종료했어요', S.lobby);
      }
      S.abortArm = Date.now();
      toast('한 번 더 누르면 게임이 종료돼요');
      setTimeout(() => render(), 3100);
      return render();
    case 'char':
      S.myChar = cycleChar(S.myChar, el.dataset.k, +el.dataset.d);
      saveChar();
      return render();
    case 'mute': setMuted(!isMuted()); return render(true);
    case 'music': music.setOn(!music.isOn()); return render(true);
    case 'card':
      // 탭하면 크게 보기만 한다. 사용은 드래그로.
      S.sel = S.sel === el.dataset.u ? null : el.dataset.u;
      return render();
    case 'cancel': S.sel = null; return render();
    case 'undo':
      if (sendReq('undo')) sfx.undo();
      return;
    case 'end':
      S.sel = null;
      if (sendReq('end')) sfx.whoosh();
      return;
    case 'pickSel': S.pickSel = el.dataset.id; return render();
    case 'pick': return sendReq('pick', { card: S.pickSel });
    case 'pickSkip': return sendReq('pick', { card: null });
    case 'remSel': S.removeSel = S.removeSel === el.dataset.u ? null : el.dataset.u; return render();
    case 'remove': return sendReq('remove', { card: S.removeSel });
    case 'remSkip': return sendReq('remove', { card: null });
  }
}

async function doJoin() {
  const nick = ($('#nick')?.value || '').trim();
  if (!nick) return toast('닉네임을 입력해주세요');
  if ([...nick].length > 10) return toast('닉네임은 10자까지예요');
  const taken = onlineMembers().some(([u, m]) => u !== S.uid && m.name === nick);
  if (taken) return toast('이미 쓰고 있는 닉네임이에요');
  await join(nick);
  update();
}

function startGame() {
  if (!S.host) return;
  const list = onlineMembers().slice(0, RULES.maxPlayers);
  if (list.length < RULES.minPlayers) return toast(`${RULES.minPlayers}명 이상 모여야 시작할 수 있어요`);
  S.host.startGame(list.map(([uid, m]) => ({ uid, name: m.name, char: charOf(uid) })));
}

// ── 렌더링 ──
function screen() {
  if (!S.joined) return 'entry';
  const m = S.meta;
  if (m.status === 'playing') {
    if (S.pub?.gameId === m.gameId) return S.pub.phase === 'ended' && !S.replay ? 'result' : 'battle';
    return 'wait';
  }
  return 'lobby';
}

function flushRender() {
  if (S.renderPending) { S.renderPending = false; render(); }
}

let lastHTML = '';
function render(force = false) {
  if (!S.net || !S.ready) return;
  // 카드를 끄는 중이거나 필드에서 전투 연출 중에는 화면을 다시 그리지 않는다
  if (S.drag?.moved || S.replay) { S.renderPending = true; return; }
  const scr = screen();
  if (scr === 'result' && S.resultSeen !== S.pub.gameId) {
    S.resultSeen = S.pub.gameId;
    sfx.win();
  }
  const html = { entry: entryHTML, lobby: lobbyHTML, battle: battleHTML, result: resultHTML, wait: waitHTML }[scr]() + overlayHTML();
  if (force || html !== lastHTML) {
    const nick = $('#nick');
    const keep = nick && { v: nick.value, f: document.activeElement === nick };
    app.innerHTML = html;
    lastHTML = html;
    const n2 = $('#nick');
    if (keep && n2) {
      n2.value = keep.v;
      if (keep.f) n2.focus();
    }
  }
  renderModal();
  spawnFx();
  updateTimers();
  music.play(scr === 'battle' ? 'battle' : 'lobby');
}

function modeBanner() {
  return S.net.mode === 'local'
    ? '<div class="banner local">로컬 테스트 모드: 같은 브라우저의 탭끼리만 연결돼요. 친구들과 하려면 <code>js/config.js</code>에 Firebase 설정을 넣어주세요.</div>'
    : '';
}

const toggles = () => `<span class="toggles">
  <button class="icon-btn" data-act="mute" title="효과음">${isMuted() ? '🔇' : '🔊'}</button>
  <button class="icon-btn ${music.isOn() ? '' : 'off'}" data-act="music" title="배경음악">🎵</button>
</span>`;

function entryHTML() {
  const playing = S.meta.status === 'playing';
  const n = onlineMembers().length;
  return `<div class="screen entry">
    ${modeBanner()}
    <div class="entry-box">
      <div class="logo big">허리펴라</div>
      <p class="tag">친구 사진으로 싸우는 턴제 덱빌딩 배틀로얄</p>
      <div class="join">
        <input id="nick" maxlength="10" placeholder="닉네임" autocomplete="off" value="${esc(store.get('hp_name') || '')}">
        <button class="btn primary" data-act="join">참가하기</button>
      </div>
      <p class="status ${playing ? 'live' : ''}">${playing ? '🔴 게임 진행 중이에요. 지금 들어가면 관전자로 참가해요.' : `🟢 대기실에 ${n}명 있어요`}</p>
      <button class="btn ghost" data-act="gallery">카드 ${Object.keys(CARDS).length}종 보기</button>
    </div>
  </div>`;
}

function charEditorHTML() {
  const ch = S.myChar;
  const row = (k, val) => `<div class="crow">
      <span class="clabel">${CHAR_OPTS[k].label}</span>
      <button class="icon-btn" data-act="char" data-k="${k}" data-d="-1" aria-label="이전">◀</button>
      <b>${val}</b>
      <button class="icon-btn" data-act="char" data-k="${k}" data-d="1" aria-label="다음">▶</button>
    </div>`;
  return `<section class="panel char-edit">
    <h2>내 캐릭터</h2>
    <div class="char-edit-body">
      <div class="char-preview">${charSVG(ch)}</div>
      <div class="crows">
        ${row('c', `<i class="swatch" style="--h:${[0, 25, 45, 120, 165, 200, 225, 265, 300, 330][ch.c]}"></i>`)}
        ${row('hair', CHAR_OPTS.hair.names[ch.hair])}
        ${row('face', CHAR_OPTS.face.names[ch.face])}
        ${row('acc', CHAR_OPTS.acc.names[ch.acc])}
      </div>
    </div>
    <p class="muted small">턴이 끝나면 이 캐릭터가 대신 싸워요.</p>
  </section>`;
}

function lobbyHTML() {
  const list = onlineMembers();
  const offline = Object.entries(S.lobby).filter(([, m]) => !isOnline(m) && m.name);
  const isHost = S.meta.hostId === S.uid && S.host;
  const n = list.length;
  const canStart = n >= RULES.minPlayers;
  const row = ([u, m], i) => `<li class="${u === S.uid ? 'me' : ''} ${i >= RULES.maxPlayers ? 'extra' : ''}">
      ${ava(u)}
      <span class="nm">${esc(m.name)}${u === S.uid ? ' <em>나</em>' : ''}</span>
      ${u === S.meta.hostId ? '<span class="crown">👑 호스트</span>' : ''}
      ${i >= RULES.maxPlayers ? '<span class="muted">다음 판 관전</span>' : ''}
    </li>`;
  return `<div class="screen lobby">
    ${modeBanner()}
    <div class="lobby-head"><div class="logo">허리펴라</div><span class="pill">대기실</span>${toggles()}</div>
    ${S.meta.notice ? `<div class="banner warn">${esc(S.meta.notice)}</div>` : ''}
    <div class="lobby-body">
      <section class="panel plist">
        <h2>참가자 <b>${Math.min(n, RULES.maxPlayers)}</b> / ${RULES.maxPlayers}</h2>
        <ul>${list.map(row).join('')}${offline.map(([u, m]) => `<li class="off">${ava(u)}<span class="nm">${esc(m.name)}</span><span class="muted">연결 끊김</span></li>`).join('')}</ul>
        <div class="howto">
          <p>체력 <b>${RULES.maxHp}</b> · 에너지 <b>${RULES.energy}</b> · 카드 <b>${RULES.drawPerTurn}</b>장 · <b>${RULES.turnMs / 1000}</b>초. 카드를 <b>끌어서</b> 쓰고, 턴을 끝내면 한꺼번에 실행돼요.</p>
          <button class="btn ghost" data-act="gallery">카드 ${Object.keys(CARDS).length}종 보기</button>
        </div>
      </section>
      ${charEditorHTML()}
    </div>
    <div class="lobby-foot">
      <button class="btn ghost" data-act="leave">나가기</button>
      ${isHost
        ? `<button class="btn primary big" data-act="start" ${canStart ? '' : 'disabled'}>${canStart ? '게임 시작' : `${RULES.minPlayers}명 이상 필요 (${n}명)`}</button>`
        : `<p class="muted">${S.meta.hostId ? `👑 ${esc(name(S.meta.hostId))} 님이 시작하길 기다리는 중…` : '호스트를 정하는 중…'}</p>`}
    </div>
  </div>`;
}

function waitHTML() {
  return '<div class="screen center"><div class="logo">허리펴라</div><p class="muted">게임 정보를 받는 중…</p></div>';
}

// 내가 참가 중이면 나는 왼쪽, 상대는 오른쪽(내 다음 순서부터). 관전 중이면 반씩 나눈다.
function sides() {
  const order = S.pub.order;
  const i = order.indexOf(S.uid);
  if (i >= 0) return { l: [S.uid], r: [...order.slice(i + 1), ...order.slice(0, i)] };
  const h = Math.ceil(order.length / 2);
  return { l: order.slice(0, h), r: order.slice(h) };
}

function fighterHTML(u, right, plan) {
  const p = S.pub, x = p.players[u];
  const pct = Math.max(0, (x.hp / x.maxHp) * 100);
  const aimed = plan.filter(a => a.target === u).length;
  const cls = ['fighter', right && 'r', u === S.uid && 'me', p.cur === u && 'cur', !x.alive && 'ko dead'].filter(Boolean).join(' ');
  return `<div class="${cls}" data-u="${u}" data-pid="${u}">
    <div class="f-top">
      <div class="f-name">${esc(x.name)}${u === S.uid ? '<em>나</em>' : ''}${u === S.meta.hostId ? '<span title="호스트">👑</span>' : ''}</div>
      <div class="f-bar">
        ${x.block ? `<b class="f-shield">🛡${x.block}</b>` : ''}
        <div class="f-hp ${pct <= 30 ? 'low' : ''}"><i style="width:${pct}%"></i><span>${x.hp}/${x.maxHp}</span></div>
      </div>
      <div class="f-badges">
        ${x.react ? '<b class="bd react">⚡반응</b>' : ''}
        ${x.keepBlock ? '<b class="bd block">방어 유지</b>' : ''}
        ${x.drawPen ? '<b class="bd pen">드로우-1</b>' : ''}
        ${x.enPen ? '<b class="bd pen">에너지-1</b>' : ''}
      </div>
    </div>
    <div class="f-body"><div class="f-flip">${charSVG(charOf(u))}</div></div>
    ${aimed ? `<div class="aimed">🎯${aimed > 1 ? aimed : ''}</div>` : ''}
    ${p.cur === u && p.plan && u !== S.uid ? `<div class="f-think">🃏×${p.plan.n}</div>` : ''}
    ${!x.alive ? '<div class="f-out">탈선린</div>' : ''}
  </div>`;
}

function selHint(id) {
  const p = S.pub, priv = myPriv(), me = p.players[S.uid];
  return ({
    p50: () => `지금 쓰면 추가 피해 +${Math.min(6, 2 * (priv.recent || 0))}`,
    p11: () => `지금 쓰면 추가 피해 +${Math.min(9, 3 * (priv.atkCount || 0))}`,
    p49: () => (me.hp <= 20 ? '체력 20 이하: 피해 +6 적용' : ''),
    p19: () => (priv.react ? '반응 설치됨: 방어도 +4 적용' : ''),
    p51: () => (me.hp <= 20 ? '체력 20 이하: 방어도 +5 적용' : ''),
    p73: () => (me.hp <= 10 ? '체력 10 이하: 방어도 15 적용' : ''),
    p90: () => `턴 시작 방어도 ${me.block} 기준`,
    p23: () => `지금 쓰면 방어도 ${3 + 2 * (priv.hand.length - 1)}`,
    p81: () => `지금 쓰면 체력 ${3 * priv.energy} 회복`,
  }[id]?.() || '');
}

// 필드 위에 겹쳐 보이는 것들: 카드 크게 보기, 카드 선택 진행 상황, 예약한 카드 줄, 안내
function fieldOverlayHTML(myTurn, selCard) {
  const p = S.pub, priv = myPriv();
  if (selCard) {
    const why = blockReason(selCard);
    const hint = priv ? selHint(selCard.id) : '';
    return `<div class="peek" data-act="cancel">
      ${cardHTML(selCard.id, { act: '', size: 'big' })}
      <div class="peek-side">
        ${hint ? `<p class="hint">${hint}</p>` : ''}
        ${why ? `<p class="why">${why}</p>` : `<p class="pointer">${CARDS[selCard.id].scope === 'one' ? '🎯 카드를 상대 캐릭터에게 끌어다 놓으세요' : '⬆ 카드를 위로 끌어 올리면 사용돼요'}</p>`}
        <button class="btn ghost" data-act="cancel">닫기</button>
      </div>
    </div>`;
  }
  if (p.phase === 'pick' || p.phase === 'remove') {
    const done = Object.values(p.pick || {}).filter(Boolean).length;
    const all = Object.keys(p.pick || {}).length;
    return `<div class="field-note">🃏 ${p.phase === 'pick' ? '라운드 보상 카드를 고르는 중' : '덱에서 뺄 카드를 고르는 중'}… (${done}/${all})<div class="timer" data-deadline="${p.deadline}"><i></i><span></span></div></div>`;
  }
  if (!myTurn) return '';
  const plan = priv?.plan || [];
  if (!plan.length) return '<div class="field-hint">카드를 <b>끌어서</b> 사용 · 공격은 상대 캐릭터에게 · 턴을 끝내면 한꺼번에 실행</div>';
  return `<div class="plan-strip">
    <div class="plan-head"><b>예약 ${plan.length}장</b><small>턴 종료 때 실행</small></div>
    <div class="plan-row">${plan.map((a, i) => `<div class="plan-item">
      <span class="plan-no">${i + 1}</span>
      ${cardHTML(a.id, { act: '', size: 'xs' })}
      <small>${a.target ? `→ ${esc(name(a.target))}` : ''}</small>
    </div>`).join('')}</div>
  </div>`;
}

function battleHTML() {
  const p = S.pub, me = p.players[S.uid], priv = myPriv();
  const myTurn = myTurnNow();
  const selCard = S.sel && priv?.hand.find(c => c.u === S.sel);
  const curName = p.cur ? esc(name(p.cur)) : '';
  const plan = myTurn ? priv?.plan || [] : [];
  const { l, r } = sides();

  let dock;
  if (!me) {
    dock = '<footer class="dock spect"><b>👀 관전 중</b><span>손패와 덱 순서는 공개되지 않아요. 다음 판에 참가할 수 있어요.</span></footer>';
  } else if (!me.alive) {
    dock = '<footer class="dock spect"><b>💀 탈선린</b><span>남은 경기를 관전하고 있어요.</span></footer>';
  } else {
    const hand = (priv?.hand || []).filter(c => c.u !== S.hiddenU);
    const energy = myTurn ? priv?.energy ?? me.energy : me.energy;
    dock = `<footer class="dock ${myTurn ? 'my' : ''}">
      <div class="energy ${myTurn ? 'on' : ''}"><b>${energy}</b><small>/${RULES.energy}</small><span>에너지</span></div>
      <div class="hand ${hand.length > 6 ? 'tight' : ''}">${hand.map(c => cardHTML(c.id, { u: c.u, sel: S.sel === c.u, off: !!blockReason(c) })).join('') || `<p class="muted">${myTurn ? '손패를 다 썼어요' : `내 턴이 되면 카드 ${RULES.drawPerTurn}장을 뽑아요`}</p>`}</div>
      <div class="dock-side">
        ${myTurn ? `<div class="timer" data-deadline="${p.deadline}"><i></i><span></span></div>` : `<p class="muted small">${curName ? `${curName}의 턴` : ''}</p>`}
        ${myTurn ? `<button class="btn undo" data-act="undo" ${plan.length && !S.pending ? '' : 'disabled'}>↶ 되돌리기</button>` : ''}
        <button class="btn end" data-act="end" ${myTurn && !S.pending ? '' : 'disabled'}>${plan.length ? `⚔️ 턴 종료 <small>${plan.length}장 실행</small>` : '턴 종료'}</button>
        <button class="link" data-act="deck">덱 ${me.deck} · 뽑을 ${me.draw} · 버림 ${me.discard}</button>
      </div>
    </footer>`;
  }

  const info = p.phase === 'battle'
    ? `<b>${p.round}R</b> · ${myTurn ? '<span class="mine">내 턴</span>' : `${curName}의 턴`}`
    : p.phase === 'ended' ? `<b>${p.round}R</b> · 결과 집계 중` : `<b>${p.round}R</b> 종료 · 카드 선택`;
  const lastLog = p.log.at(-1)?.t || '';

  return `<div class="screen battle ${me ? '' : 'spectating'}">
    <div class="rotate-hint">📱 가로 화면으로 돌리면 더 잘 보여요</div>
    <div class="topbar">
      <span class="tb-info">${info}</span>
      ${p.phase === 'battle' ? `<div class="timer mini" data-deadline="${p.deadline}"><i></i><span></span></div>` : ''}
      ${p.suddenDmg ? `<span class="sudden">⚠️ 회복 절반 · 종료 피해 ${p.suddenDmg}</span>` : p.round === RULES.suddenRound - 1 ? '<span class="sudden soft">다음 라운드부터 종료 피해</span>' : ''}
      <button class="log-line" data-act="log" title="전체 기록">📜 ${esc(lastLog)}</button>
      ${!me ? '<span class="pill">관전 중</span>' : ''}
      ${toggles()}
      ${S.host ? `<button class="icon-btn abort ${Date.now() - S.abortArm < 3000 ? 'armed' : ''}" data-act="abort">${Date.now() - S.abortArm < 3000 ? '한 번 더 누르면 종료' : '⏹ 종료'}</button>` : ''}
    </div>
    <main class="field n${p.order.length}">
      <div class="field-floor"></div>
      <div class="side l">${l.map(u => fighterHTML(u, false, plan)).join('')}</div>
      <div class="side r">${r.map(u => fighterHTML(u, true, plan)).join('')}</div>
      ${fieldOverlayHTML(myTurn, selCard)}
    </main>
    ${dock}
    ${S.replay ? '' : pickOverlayHTML()}
  </div>`;
}

function pickOverlayHTML() {
  const p = S.pub, priv = myPriv(), s = priv?.pick;
  if (!s || s.done || !p.players[S.uid]?.alive) return '';
  const timer = `<div class="timer" data-deadline="${p.deadline}"><i></i><span></span></div>`;
  if (s.stage === 'pick') {
    return `<div class="overlay pick">
      <div class="ov-head"><h2>카드 1장을 덱에 추가하세요</h2>${timer}</div>
      <div class="pick-row">${s.opts.map(id => cardHTML(id, { act: 'pickSel', sel: S.pickSel === id, size: 'big' })).join('')}</div>
      <div class="ov-foot">
        <button class="btn ghost" data-act="pickSkip" ${S.pending ? 'disabled' : ''}>건너뛰기</button>
        <button class="btn primary big" data-act="pick" ${S.pickSel && !S.pending ? '' : 'disabled'}>덱에 추가</button>
      </div>
      <p class="muted small">시간이 지나면 건너뛰기로 처리돼요. 고른 카드는 다음 셔플부터 나와요.</p>
    </div>`;
  }
  return `<div class="overlay pick remove">
    <div class="ov-head"><h2>덱에서 뺄 카드 1장 (선택)</h2>${timer}</div>
    <div class="deck-grid">${priv.deck.map(c => cardHTML(c.id, { u: c.u, act: 'remSel', sel: S.removeSel === c.u, size: 'sm' })).join('')}</div>
    <div class="ov-foot">
      <button class="btn ghost" data-act="remSkip" ${S.pending ? 'disabled' : ''}>건너뛰기</button>
      <button class="btn danger big" data-act="remove" ${S.removeSel && !S.pending ? '' : 'disabled'}>이 카드 빼기</button>
    </div>
  </div>`;
}

function resultHTML() {
  const p = S.pub, r = p.result;
  const rank = [...(r.winner ? [r.winner] : []), ...p.elim.map(e => e.u).reverse()];
  const st = u => p.players[u].stats;
  const award = (title, key, unit, min = 1) => {
    const best = p.order.reduce((a, u) => (st(u)[key] > (a ? st(a)[key] : -1) ? u : a), null);
    return best && st(best)[key] >= min ? `<li><span class="aw">${title}</span>${ava(best, 'sm')}<b>${esc(name(best))}</b><small>${st(best)[key]}${unit}</small></li>` : '';
  };
  const isHost = S.meta.hostId === S.uid && S.host;
  return `<div class="screen result">
    <div class="win">
      ${r.draw ? '<h1>🤝 전원 탈선린, 무승부!</h1>' : `<div class="crown-big">🏆</div><div class="win-char">${charSVG(charOf(r.winner))}</div><h1>${esc(name(r.winner))} 최후의 생존자!</h1>`}
      <p class="muted">${r.round}라운드까지 진행</p>
    </div>
    <div class="result-body">
      <section class="panel">
        <h2>순위</h2>
        <ol class="rank">${rank.map((u, i) => {
          const e = p.elim.find(x => x.u === u);
          return `<li>${ava(u, 'sm')}<b>${esc(name(u))}</b><small>${i === 0 && !r.draw ? '생존' : `R${e.r} 탈선린${e.by ? ` · ${esc(name(e.by))}에게` : ''}`}</small></li>`;
        }).join('')}</ol>
      </section>
      <section class="panel">
        <h2>오늘의 기록</h2>
        <ul class="awards">
          ${award('🗡️ 딜량왕', 'dealt', ' 피해')}
          ${award('🥊 샌드백', 'taken', ' 받음')}
          ${award('🤕 자해왕', 'self', ' 자해')}
          ${award('💥 한 방', 'maxHit', ' 최대 피해')}
          ${award('☠️ 킬러', 'kills', '킬')}
          ${award('🧱 철벽', 'blocked', ' 막음')}
          ${award('💊 회복 장인', 'healed', ' 회복')}
        </ul>
      </section>
      <section class="panel stats">
        <h2>전체 기록</h2>
        <table><tr><th></th><th>가한 피해</th><th>받은 피해</th><th>자해</th><th>최대 한 방</th><th>카드</th></tr>
        ${p.order.map(u => `<tr><td>${esc(name(u))}</td><td>${st(u).dealt}</td><td>${st(u).taken}</td><td>${st(u).self}</td><td>${st(u).maxHit}</td><td>${st(u).cards}</td></tr>`).join('')}
        </table>
      </section>
    </div>
    <div class="lobby-foot">
      ${isHost ? '<button class="btn primary big" data-act="rematch">다시 하기</button>' : '<p class="muted">호스트가 “다시 하기”를 누르면 대기실로 돌아가요</p>'}
    </div>
  </div>`;
}

function overlayHTML() {
  if (S.joined && !active()) {
    return `<div class="blocker"><div class="panel"><h2>다른 탭에서 열려 있어요</h2><p class="muted">같은 브라우저의 다른 탭이 이 자리를 쓰고 있어요.</p><button class="btn primary" data-act="takeover">여기서 계속하기</button></div></div>`;
  }
  const m = S.meta;
  if (S.joined && m.status === 'playing' && m.hostId !== S.uid && S.hostOffSince) {
    const left = Math.max(0, Math.ceil((RULES.hostGraceMs - (S.net.now() - S.hostOffSince)) / 1000));
    return `<div class="blocker"><div class="panel"><h2>호스트 연결이 끊겼어요</h2><p class="muted">다시 연결되길 기다리는 중이에요. ${left}초 안에 돌아오지 않으면 게임이 종료돼요.</p></div></div>`;
  }
  return '';
}

let lastModal = '';
function renderModal() {
  let html = '';
  if (S.modal === 'gallery') {
    html = `<div class="modal"><div class="modal-box"><div class="modal-head"><h2>카드 ${Object.keys(CARDS).length}종</h2><button class="btn ghost" data-act="close">닫기</button></div><div class="modal-body">${galleryHTML()}</div></div></div>`;
  } else if (S.modal === 'log' && S.pub) {
    html = `<div class="modal"><div class="modal-box"><div class="modal-head"><h2>전투 기록</h2><button class="btn ghost" data-act="close">닫기</button></div>
      <div class="modal-body"><ul class="log full">${S.pub.log.slice().reverse().map(l => `<li class="k-${l.k}">${esc(l.t)}</li>`).join('')}</ul></div></div></div>`;
  } else if (S.modal === 'deck') {
    const priv = myPriv();
    const deck = priv?.deck || [];
    html = `<div class="modal"><div class="modal-box"><div class="modal-head"><h2>내 덱 ${deck.length}장</h2><button class="btn ghost" data-act="close">닫기</button></div>
      <div class="modal-body"><p class="muted small">순서와 상관없이 카드 종류별로 정렬해서 보여줘요.</p><div class="grid">${deck.map(c => cardHTML(c.id, { act: '', size: 'sm' })).join('')}</div></div></div></div>`;
  }
  if (html !== lastModal) {
    $('#modal').innerHTML = html;
    lastModal = html;
  }
}

// ── 연출 ──
// 전투 연출로 재생하지 못한 효과(백그라운드 탭에서 돌아온 경우 등)는 상단 참가자 칸에 바로 보여준다
function spawnFx() {
  const p = S.pub;
  if (!p || screen() !== 'battle') return;
  const max = p.fx.length ? p.fx.at(-1).n : 0;
  if (S.fxGame !== p.gameId || S.replay) {
    S.fxGame = p.gameId;
    S.fxSeen = max;
    return;
  }
  let shakePower = 0;
  for (const f of p.fx) {
    if (f.n <= S.fxSeen) continue;
    const box = document.querySelector(`.fighter[data-pid="${f.u}"]`);
    if (!box) continue;
    const r = box.querySelector('.f-body').getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height * .4;
    if (f.k === 'dmg') {
      if (f.v) {
        V.impact(x, y, f.v);
        V.text(x, y, `-${f.v}`, 'f-dmg');
        sfx.hit(f.v);
        shakePower = Math.max(shakePower, 3 + f.v * .6);
        if (f.u === S.uid) V.flash('rgba(255,40,70,.3)', 260);
        box.classList.remove('hit');
        void box.offsetWidth;
        box.classList.add('hit');
      } else { V.text(x, y, '막음!', 'f-block'); sfx.blocked(); }
    } else if (f.k === 'ko') {
      V.eliminated(name(f.u));
      sfx.ko();
      shakePower = 20;
    } else {
      const t = { heal: `+${f.v}`, block: `🛡+${f.v}`, nullify: '무효!', react: '⚡설치', strip: '방어도 파괴!', unreact: '반응 무력화!', trigger: `⚡${f.v}!`, debuff: f.v }[f.k];
      if (t) V.text(x, y, t, `f-${f.k}`);
      if (f.k === 'heal') V.sparkle(x, y);
    }
  }
  if (shakePower) V.shake(app, Math.min(20, shakePower));
  S.fxSeen = max;
}

function updateTimers() {
  const now = S.net?.now() ?? Date.now();
  const total = S.pub?.phase === 'battle' ? RULES.turnMs : RULES.pickMs;
  for (const el of document.querySelectorAll('[data-deadline]')) {
    const left = Math.max(0, +el.dataset.deadline - now);
    el.querySelector('span').textContent = `${Math.ceil(left / 1000)}초`;
    el.querySelector('i').style.width = `${Math.min(100, (left / total) * 100)}%`;
    el.classList.toggle('urgent', left < 8000);
  }
}

function onTick() {
  if (!S.ready) return;
  if (S.pending && Date.now() - S.pendingAt > 6000) {
    S.pending = null;
    S.hiddenU = null;
    render();
  }
  if (S.hostOffSince || !S.meta.hostId) {
    hostDuty();
    render();
  }
  pruneLobby();
  updateTimers();
}

// 대기실에서 1분 넘게 연결이 끊긴 사람은 호스트가 목록에서 정리한다 (게임 중에는 복귀할 수 있게 남겨둔다)
function pruneLobby() {
  if (!S.host || S.meta.status !== 'lobby') return;
  const now = Date.now();
  for (const [u, m] of Object.entries(S.lobby)) {
    if (isOnline(m)) { delete S.offSince[u]; continue; }
    S.offSince[u] ??= now;
    if (now - S.offSince[u] > 60000) {
      delete S.offSince[u];
      S.net.set('lobby/' + u, null);
    }
  }
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function flash(msg) {
  const el = document.createElement('div');
  el.className = 'flash';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}
