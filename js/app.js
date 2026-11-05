import { createNet, rid } from './net.js';
import { RULES } from './config.js';
import { CARDS, TYPE, SCOPE } from './cards.js';
import { Host } from './host.js';
import { esc, cardHTML, hiddenCardHTML, avatarHTML, galleryHTML, gimmickChipsHTML, gimmickTipHTML } from './view.js';
import { GIMMICKS, linkGimmicks } from './gimmicks.js';
import { cardText, cardName, cardCost, isEdited, editCount, setCardField, resetCard, resetAll, exportJSON, exportCSV } from './editor.js';
import { CHARACTERS, charSVG, defaultChar, validChar, cycleChar } from './chars.js';
import { playReplay } from './replay.js';
import { liveMotion } from './motion.js';
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
  // 마우스를 올리면 기믹 설명
  document.addEventListener('mouseover', e => {
    const g = e.target.closest?.('[data-gk],[data-gm]');
    if (g) showTip(g);
  });
  document.addEventListener('mouseout', e => {
    const g = e.target.closest?.('[data-gk],[data-gm]');
    if (g && !g.contains(e.relatedTarget) && !tipPinned) hideTip();
  });
  document.addEventListener('input', e => {
    const id = e.target.dataset?.edit;
    if (!id) return;
    setCardField(id, e.target.dataset.f, e.target.value);
    syncEditor(id);
  });
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
  // 게임이 끝나거나 바뀌면 재생 중인 전투 연출을 바로 멈춘다 (대기실로 못 돌아가는 일이 없게)
  if (S.replay && (S.meta.status !== 'playing' || S.pub?.gameId !== S.replayGame)) S.replay.stop();
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
  D.blind = D.card.scope === 'one' && !!myPriv()?.st?.blind;
  D.aim = D.card.scope === 'one' && !D.why && !D.blind;
  S.sel = null;
  const r = D.el.getBoundingClientRect();
  D.w = r.width;
  D.h = r.height;
  D.dockTop = $('.dock')?.getBoundingClientRect().top ?? innerHeight * .6;
  D.el.classList.add('dragging-src');
  const layer = $('#drag');
  layer.innerHTML = `<div class="drag-ghost ${D.why ? 'no' : ''}">${cardHTML(D.id, { act: '' })}</div>
    <svg class="drag-arrow" width="100%" height="100%"><path class="arrow-line"/><path class="arrow-head"/></svg>
    <div class="drag-hint">${D.why ? esc(D.why) : D.aim ? '상대 캐릭터에게 끌어다 놓기' : D.blind ? '실명: 위로 끌어 올리면 무작위 상대에게' : '위로 끌어 올려 사용'}</div>`;
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
  const gEl = e.target.closest('[data-gk],[data-gm]');
  if (gEl) { e.stopPropagation(); return showTip(gEl, true); }
  if (!e.target.closest('#tip')) hideTip();
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
    case 'close':
      if (S.modal === 'editor') lastHTML = ''; // 바뀐 이름·비용·설명이 손패·도감에 보이도록 다시 그린다
      S.modal = null;
      return render(true);
    case 'takeover':
      S.net.update({ [`lobby/${S.uid}/inst`]: S.inst });
      S.presenceOff?.();
      S.presenceOff = S.net.presence(`lobby/${S.uid}/conn/${S.inst}`);
      return;
    case 'start': return startGame();
    case 'rematch': return S.host?.toLobby(null, S.lobby);
    case 'abort':
      // 실수로 누르지 않게 5초 안에 한 번 더 눌러야 종료
      if (!S.host) return;
      if (Date.now() - S.abortArm < 5000) {
        S.abortArm = 0;
        S.replay?.stop();
        return S.host.toLobby('호스트가 게임을 종료했어요', S.lobby);
      }
      S.abortArm = Date.now();
      toast('한 번 더 누르면 게임이 종료돼요');
      setTimeout(() => render(), 5100);
      return render();
    case 'charSelect':
      S.myChar = { ...S.myChar, c: +el.dataset.index };
      saveChar();
      return render();
    case 'char':
      S.myChar = cycleChar(S.myChar, el.dataset.k, +el.dataset.d);
      saveChar();
      return render();
    case 'charRandom':
      S.myChar = { c: rnd(CHARACTERS.length), hair: 0, face: 0, acc: 0 };
      saveChar();
      return render();
    case 'editor': S.modal = 'editor'; return render();
    case 'edExportJSON': return exportJSON();
    case 'edExportCSV': return exportCSV();
    case 'edReset': {
      const id = el.dataset.id;
      resetCard(id);
      document.querySelectorAll(`[data-edit="${id}"]`).forEach(inp => { inp.value = CARDS[id][inp.dataset.f]; });
      return syncEditor(id);
    }
    case 'edResetAll':
      if (!confirm('수정한 카드 이름·비용·설명을 모두 원래대로 되돌릴까요?')) return;
      resetAll();
      lastModal = '';
      return render(true);
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
    liveMotion.stop();
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
  const hist = $('.hist');
  if (hist) hist.scrollLeft = hist.scrollWidth;
  spawnFx();
  updateTimers();
  music.play(scr === 'battle' ? 'battle' : 'lobby');
}

function modeBanner() {
  return S.net.mode === 'local'
    ? '<div class="banner local"><span class="lbl amber">LOCAL</span>로컬 테스트 모드 · 같은 브라우저의 탭끼리만 연결돼요</div>'
    : '';
}

const lbl = (t, cls = '') => `<span class="lbl ${cls}">${t}</span>`;
const pad2 = n => String(n).padStart(2, '0');

const toggles = () => `<div class="toggles">
  <button class="tg ${isMuted() ? 'off' : ''}" data-act="mute" title="효과음">SFX</button>
  <button class="tg ${music.isOn() && !isMuted() ? '' : 'off'}" data-act="music" title="배경음악">BGM</button>
</div>`;

// 타이틀 키 비주얼: 카드 몇 장을 흩뿌린다
const KV = [
  { id: 'p67', x: 52, y: 50, r: -5, s: 1.3, z: 6 },
  { id: 'p12', x: 24, y: 28, r: -15, s: .95, z: 4 },
  { id: 'p29', x: 80, y: 24, r: 11, s: .92, z: 4 },
  { id: 'p60', x: 30, y: 78, r: 9, s: .88, z: 5 },
  { id: 'p44', x: 78, y: 76, r: -9, s: 1, z: 5 },
  { id: 'p56', x: 56, y: 8, r: 18, s: .72, z: 2 },
  { id: 'p05', x: 96, y: 52, r: -20, s: .76, z: 3 },
  { id: 'p26', x: 8, y: 54, r: 13, s: .72, z: 3 },
  { id: 'p90', x: 60, y: 96, r: -16, s: .7, z: 2 },
];
function keyVisualHTML() {
  return `<div class="kv" aria-hidden="true">
    <div class="kv-cards">${KV.map((k, i) => `<div class="kv-card" style="--x:${k.x}%;--y:${k.y}%;--r:${k.r}deg;--s:${k.s};--d:${(i * .37).toFixed(2)}s;z-index:${k.z}">${cardHTML(k.id, { act: '' })}</div>`).join('')}</div>
    <div class="kv-fade"></div>
  </div>`;
}

function entryHTML() {
  const playing = S.meta.status === 'playing';
  const n = onlineMembers().length;
  return `<div class="screen title">
    ${keyVisualHTML()}
    <header class="t-head">${lbl('BUILD 0.5')}${toggles()}</header>
    <main class="t-main">
      <div class="t-brand">
        <div class="eyebrow"><i></i>${lbl('DECK BUILDING BATTLE ROYALE', 'amber')}</div>
        <h1 class="t-logo">허리펴라</h1>
      </div>
      <div class="t-join">
        ${lbl('CALLSIGN · 닉네임')}
        <div class="join-row">
          <input id="nick" maxlength="10" placeholder="닉네임 입력" autocomplete="off" value="${esc(store.get('hp_name') || '')}">
          <button class="btn primary cut" data-act="join"><b>참가하기</b><span class="mono">→</span></button>
        </div>
        <div class="t-status">
          <span><i class="sq ${playing ? 'live' : ''}"></i>${playing ? '게임 진행 중 · 지금 들어가면 관전' : `대기실 <b class="mono">${n}</b>명 · 서버 정상`}</span>
          <button class="link-btn" data-act="gallery">카드 도감 <span class="mono">${Object.keys(CARDS).length} →</span></button>
        </div>
        <button class="link-btn soft" data-act="editor">카드 수정해보기 <span class="mono">EDIT →</span></button>
      </div>
      ${modeBanner()}
    </main>
    <footer class="t-foot"><span>${RULES.minPlayers}–${RULES.maxPlayers}명 · 한 판 약 10분</span>${lbl('PRESS 참가하기 TO DEPLOY', 'dim')}</footer>
  </div>`;
}

function customizeHTML() {
  return `<section class="col custom">
    <div class="col-head">${lbl('CHARACTER')}<button class="link-btn" data-act="charRandom">무작위</button></div>
    <p class="cast-note">카드 속 등장인물 ${CHARACTERS.length}명</p>
    <div class="cast-grid">${CHARACTERS.map((ch, i) => `<button type="button" class="cast-option ${S.myChar.c === i ? 'selected' : ''}" data-act="charSelect" data-index="${i}" aria-label="${ch.name} 선택" aria-pressed="${S.myChar.c === i}">
      ${charSVG({ c: i, hair: 0, face: 0, acc: 0 })}<b>${ch.name}</b><small>카드 ${ch.card.slice(1)}</small>
    </button>`).join('')}</div>
  </section>`;
}

function lobbyHTML() {
  const list = onlineMembers();
  const offline = Object.entries(S.lobby).filter(([, m]) => !isOnline(m) && m.name);
  const isHost = S.meta.hostId === S.uid && S.host;
  const n = list.length;
  const canStart = n >= RULES.minPlayers;
  const players = list.slice(0, RULES.maxPlayers);
  const slot = ([u, m], extra = '') => `<div class="slot ${u === S.uid ? 'me' : ''} ${extra}">
      <i class="bar"></i>${ava(u, 'slotava')}
      <span class="nm">${esc(m.name)}${u === S.uid ? '<em>나</em>' : ''}</span>
      ${u === S.meta.hostId ? lbl('HOST', 'amber') : ''}
      ${extra === 'off' ? lbl('OFFLINE', 'dim') : extra === 'extra' ? lbl('SPECTATE', 'dim') : lbl('READY', 'cyan')}
    </div>`;
  const empties = Array.from({ length: Math.max(0, RULES.maxPlayers - players.length) }, (_, i) =>
    `<div class="slot empty"><span class="mono">${pad2(players.length + i + 1)}</span>빈 자리 · 초대 대기 중</div>`).join('');
  const me = S.lobby[S.uid];
  return `<div class="screen lobby2">
    <header class="topbar2">
      <div class="tb-left"><div class="brand">허리펴라</div><i class="vsep"></i><div class="stack">${lbl('LOBBY', 'amber')}<b>대기실</b></div></div>
      <div class="tb-right">${toggles()}</div>
    </header>
    ${modeBanner()}
    ${S.meta.notice ? `<div class="banner warn"><span class="lbl red">NOTICE</span>${esc(S.meta.notice)}</div>` : ''}
    <div class="lobby-grid">
      <section class="col squad">
        <div class="col-head">${lbl('SQUAD')}<span class="count mono">${Math.min(n, RULES.maxPlayers)}<span class="dim"> / ${RULES.maxPlayers}</span></span></div>
        <div class="slots">
          ${players.map(e => slot(e)).join('')}
          ${list.slice(RULES.maxPlayers).map(e => slot(e, 'extra')).join('')}
          ${offline.map(e => slot(e, 'off')).join('')}
          ${empties}
        </div>
        <div class="col-foot">
          ${lbl('RULES')}
          <div class="stat-grid">
            <div><i>체력</i><b class="mono">${RULES.maxHp}</b></div>
            <div><i>에너지</i><b class="mono">${RULES.energy}</b></div>
            <div><i>카드</i><b class="mono">${RULES.drawPerTurn}</b></div>
            <div><i>제한</i><b class="mono">${RULES.turnMs / 1000}s</b></div>
          </div>
          <p class="soft">카드를 끌어서 쓰고, 턴을 끝내면 한꺼번에 실행돼요.</p>
          <button class="row-btn" data-act="gallery"><span>카드 도감</span><span class="mono dim">${Object.keys(CARDS).length} →</span></button>
          <button class="row-btn" data-act="editor"><span>카드 수정해보기</span><span class="mono dim">EDIT →</span></button>
        </div>
      </section>
      <section class="col unit">
        <div class="unit-head">${lbl('MY UNIT')}<b class="unit-name">${esc(me?.name || '')}</b><span class="soft">턴이 끝나면 이 캐릭터가 대신 싸워요.</span></div>
        <div class="unit-stage"><div class="unit-ring"></div><div class="unit-char">${charSVG(S.myChar)}</div></div>
      </section>
      ${customizeHTML()}
    </div>
    <footer class="botbar">
      <button class="btn ghost" data-act="leave">나가기</button>
      <div class="bb-right">
        <span class="soft">${n}명 준비 완료 · 최소 ${RULES.minPlayers}명</span>
        ${isHost
          ? `<button class="btn primary cut2 start" data-act="start" ${canStart ? '' : 'disabled'}><b>게임 시작</b><span class="mono">START →</span></button>`
          : `<span class="wait">${S.meta.hostId ? `${lbl('HOST', 'amber')} ${esc(name(S.meta.hostId))} 님이 시작하길 기다리는 중` : '호스트를 정하는 중…'}</span>`}
      </div>
    </footer>
  </div>`;
}

function waitHTML() {
  return `<div class="screen center">${lbl('CONNECTING', 'amber')}<div class="brand big">허리펴라</div><p class="soft">게임 정보를 받는 중…</p></div>`;
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
  const cls = ['fighter', right && 'r', u === S.uid && 'me', p.cur === u && 'cur', !x.alive && 'down dead'].filter(Boolean).join(' ');
  // 내 기믹은 개인 정보(예약 반영)로, 남의 기믹은 공개 정보로. 쉿이면 남에게는 숨겨진다.
  const priv = myPriv();
  const st = (u === S.uid && priv?.st) || x.st || {};
  const hidden = u !== S.uid && x.stHidden;
  const character = CHARACTERS[charOf(u).c];
  return `<div class="${cls}" data-u="${u}" data-pid="${u}" data-attack="${character.motion}" style="--idle-phase:-${character.number * .17}s">
    <div class="f-top">
      <div class="f-row">
        <span class="f-name">${esc(x.name)}${u === S.uid ? '<em>나</em>' : ''}${u === S.meta.hostId ? lbl('HOST', 'amber') : ''}</span>
        <span class="f-num mono">${x.hp}<span class="dim">/${x.maxHp}</span></span>
      </div>
      <div class="f-bar">
        ${x.block ? `<b class="f-shield mono">${x.block}</b>` : ''}
        <div class="f-hp ${pct <= 30 ? 'low' : ''}"><i style="width:${pct}%"></i><span>${x.hp}/${x.maxHp}</span></div>
      </div>
      <div class="f-badges">
        ${x.react ? '<b class="bd react">? 반응</b>' : ''}
        ${x.keepBlock ? '<b class="bd block">방어 유지</b>' : ''}
        ${x.enPen ? '<b class="bd pen">에너지 -1</b>' : ''}
        ${gimmickChipsHTML(st, hidden)}
      </div>
    </div>
    <div class="f-body"><div class="f-flip"><div class="f-motion">${charSVG(charOf(u))}</div></div>${st.clone && !hidden ? `<div class="clones">${Array.from({ length: st.clone }, () => `<div class="clone">${charSVG(charOf(u))}</div>`).join('')}</div>` : ''}</div>
    ${aimed ? `<div class="aimed mono">TGT${aimed > 1 ? `×${aimed}` : ''}</div>` : ''}
    ${p.cur === u && p.plan && u !== S.uid ? `<div class="f-think mono">QUEUE ${p.plan.n}</div>` : ''}
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

// 필드 위에 겹쳐 보이는 것들: 카드 크게 보기, 카드 선택 진행 상황, 예약한 카드(QUEUED), 안내
function fieldOverlayHTML(myTurn, selCard) {
  const p = S.pub, priv = myPriv();
  if (selCard) {
    const why = blockReason(selCard);
    const hint = priv ? selHint(selCard.id) : '';
    return `<div class="peek" data-act="cancel">
      ${cardHTML(selCard.id, { act: '', size: 'big' })}
      <div class="peek-side">
        ${lbl('CARD DETAIL')}
        ${hint ? `<p class="hint">${hint}</p>` : ''}
        ${why ? `<p class="why">${why}</p>` : `<p class="pointer">${CARDS[selCard.id].scope === 'one' && !priv?.st?.blind ? '카드를 상대 캐릭터에게 끌어다 놓으세요' : CARDS[selCard.id].scope === 'one' ? '실명 상태라 무작위 상대에게 날아가요. 위로 끌어 올리세요' : '카드를 위로 끌어 올리면 사용돼요'}</p>`}
        <p class="dim small">설명의 밑줄 친 기믹을 누르면 자세한 효과가 보여요.</p>
        <button class="btn ghost" data-act="cancel">닫기</button>
      </div>
    </div>`;
  }
  if (p.phase === 'pick' || p.phase === 'remove') {
    const done = Object.values(p.pick || {}).filter(Boolean).length;
    const all = Object.keys(p.pick || {}).length;
    return `<div class="field-note">${lbl(p.phase === 'pick' ? 'REWARD' : 'TRIM', 'amber')}${p.phase === 'pick' ? '보상 카드를 고르는 중' : '덱에서 뺄 카드를 고르는 중'} <b class="mono">${done}/${all}</b><div class="timer" data-deadline="${p.deadline}"><i></i><span></span></div></div>`;
  }
  if (!myTurn) return '';
  const plan = priv?.plan || [];
  if (!plan.length) return `<div class="field-hint">${lbl('HINT')}카드를 끌어서 사용 · 공격은 상대 캐릭터에게 · 턴을 끝내면 한꺼번에 실행</div>`;
  return `<div class="plan-strip">
    <div class="plan-head">${lbl(`QUEUED · ${plan.length}`)}<small>턴 종료 때 순서대로 실행</small></div>
    <div class="plan-row">${plan.map((a, i) => `<div class="plan-item">
      <span class="plan-no mono">${pad2(i + 1)}</span>
      ${cardHTML(a.id, { act: '', size: 'xs' })}
      <small>${a.target ? `→ ${esc(name(a.target))}` : ''}</small>
    </div>`).join('')}</div>
  </div>`;
}

// 지금까지 모든 플레이어가 낸 카드 (오래된 것 → 최신, 라운드마다 구분)
function histStripHTML() {
  const hist = S.pub.hist || [];
  let round = 0;
  const items = hist.map(h => {
    const sep = h.r !== round ? `<span class="hc-r mono">R${pad2(h.r)}</span>` : '';
    round = h.r;
    const art = h.id ? `<img src="img/cards/${CARDS[h.id].photo}.webp" alt="" draggable="false">` : '<span class="hc-q mono">?</span>';
    return `${sep}<span class="hc t-${h.id ? CARDS[h.id].type : 'react'}" title="${esc(name(h.by))}: ${h.id ? esc(cardName(h.id)) : '반응 카드'}">${art}<i class="hc-by">${ava(h.by, 'xs')}</i></span>`;
  }).join('');
  return `<button class="hist" data-act="log" title="지금까지 낸 카드 전체 보기">${items || '<span class="dim small">아직 낸 카드가 없어요</span>'}</button>`;
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
    dock = `<footer class="dock spect">${lbl('SPECTATE', 'cyan')}<span>관전 중 · 손패와 덱 순서는 공개되지 않아요. 다음 판에 참가할 수 있어요.</span></footer>`;
  } else if (!me.alive) {
    dock = `<footer class="dock spect">${lbl('ELIMINATED', 'red')}<span>탈선린 · 남은 경기를 관전하고 있어요.</span></footer>`;
  } else {
    const hand = (priv?.hand || []).filter(c => c.u !== S.hiddenU);
    const energy = myTurn ? priv?.energy ?? me.energy : me.energy;
    const pips = Array.from({ length: Math.max(RULES.energy, energy) }, (_, i) => `<i class="${i < energy ? 'on' : ''}"></i>`).join('');
    dock = `<footer class="dock ${myTurn ? 'my' : ''}">
      <div class="energy ${myTurn ? 'on' : ''}">
        ${lbl('ENERGY')}
        <div class="en-num mono"><b>${energy}</b><span>/${RULES.energy}</span></div>
        <div class="pips">${pips}</div>
      </div>
      ${!myTurn && hand.length ? `<div class="hand-label">${lbl('NEXT HAND')}다음 턴 손패 · 내 턴에 사용</div>` : ''}
      <div class="hand ${hand.length > 6 ? 'tight' : ''} ${myTurn ? '' : 'waiting'}">${hand.map(c => cardHTML(c.id, { u: c.u, sel: S.sel === c.u, off: !!blockReason(c) })).join('') || `<p class="dim">${myTurn ? '손패를 모두 예약했어요' : '손패 없음'}</p>`}</div>
      <div class="dock-side">
        ${p.phase === 'battle' ? `<div class="timer dockt ${myTurn ? '' : 'other'}" data-deadline="${p.deadline}">${lbl(myTurn ? 'TIME' : `${curName}의 턴`)}<span class="tv"></span><i></i></div>` : `<div class="dockt-idle">${lbl('WAIT')}</div>`}
        ${myTurn ? `<button class="btn ghost undo" data-act="undo" ${plan.length && !S.pending ? '' : 'disabled'}>되돌리기</button>` : ''}
        <button class="btn primary cut2 end" data-act="end" ${myTurn && !S.pending ? '' : 'disabled'}><b>턴 종료</b><small>${plan.length ? `${plan.length}장 실행` : ''}</small></button>
        <button class="stat3" data-act="deck" title="내 덱 보기"><span><i>덱</i><b class="mono">${me.deck}</b></span><span><i>뽑을</i><b class="mono">${me.draw}</b></span><span><i>버림</i><b class="mono">${me.discard}</b></span></button>
      </div>
    </footer>`;
  }

  const turnTag = p.phase === 'battle'
    ? (myTurn ? '<span class="turn-tag mine">내 턴</span>' : `<span class="turn-tag">${curName}의 턴</span>`)
    : p.phase === 'ended' ? '<span class="turn-tag">결과 집계</span>' : '<span class="turn-tag amber-line">카드 선택</span>';

  return `<div class="screen battle ${me ? '' : 'spectating'}">
    <div class="rotate-hint">${lbl('TIP')}가로 화면으로 돌리면 더 잘 보여요</div>
    <header class="topbar2 battle-top">
      <div class="tb-left">
        <div class="stack">${lbl('ROUND')}<b class="mono round">${pad2(p.round)}</b></div>
        ${turnTag}
        ${p.suddenDmg ? `<span class="sudden">회복 절반 · 종료 피해 <b class="mono">${p.suddenDmg}</b></span>` : p.round === RULES.suddenRound - 1 ? '<span class="sudden soft">다음 라운드부터 종료 피해</span>' : ''}
      </div>
      <div class="tb-center">
        ${lbl('ORDER', 'order-lbl')}
        ${p.order.map((u, i) => `<div class="oc ${p.cur === u ? 'cur' : ''} ${p.players[u].alive ? '' : 'dead'}"><span class="mono">${pad2(i + 1)}</span>${esc(name(u))}</div>`).join('')}
      </div>
      <div class="tb-right">
        ${!me ? '<span class="tag">관전 중</span>' : ''}
        ${toggles()}
        ${S.host ? `<button class="tg abort ${Date.now() - S.abortArm < 5000 ? 'armed' : ''}" data-act="abort">${Date.now() - S.abortArm < 5000 ? '한 번 더 누르면 종료' : 'END'}</button>` : ''}
      </div>
    </header>
    <div class="played">${lbl('PLAYED', 'played-lbl')}${histStripHTML()}</div>
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
  // 개인 정보가 공개 상태보다 먼저 도착할 수 있다. 공개 상태도 선택 단계가 된 뒤(= 전투 연출이 시작된 뒤)에만 띄운다.
  if (!s || s.done || s.stage !== p.phase || !p.players[S.uid]?.alive) return '';
  const timer = `<div class="timer" data-deadline="${p.deadline}"><i></i><span></span></div>`;
  if (s.stage === 'pick') {
    return `<div class="overlay pick">
      <div class="ov-head"><div class="stack">${lbl('ROUND REWARD', 'amber')}<h2>카드 1장을 덱에 추가하세요</h2></div>${timer}</div>
      <div class="pick-row">${s.opts.map(id => cardHTML(id, { act: 'pickSel', sel: S.pickSel === id, size: 'big' })).join('')}</div>
      <div class="ov-foot">
        <button class="btn ghost" data-act="pickSkip" ${S.pending ? 'disabled' : ''}>건너뛰기</button>
        <button class="btn primary cut" data-act="pick" ${S.pickSel && !S.pending ? '' : 'disabled'}><b>덱에 추가</b><span class="mono">→</span></button>
      </div>
      <p class="dim small">시간이 지나면 건너뛰기로 처리돼요. 고른 카드는 다음 셔플부터 나와요.</p>
    </div>`;
  }
  return `<div class="overlay pick remove">
    <div class="ov-head"><div class="stack">${lbl('DECK TRIM · 선택', 'cyan')}<h2>덱이 ${priv.deck.length}장이 됐어요. 1장 빼도 돼요</h2></div>${timer}</div>
    <div class="deck-grid">${priv.deck.map(c => cardHTML(c.id, { u: c.u, act: 'remSel', sel: S.removeSel === c.u, size: 'sm' })).join('')}</div>
    <div class="ov-foot">
      <button class="btn primary cut" data-act="remSkip" ${S.pending ? 'disabled' : ''}><b>그대로 두기</b></button>
      <button class="btn danger" data-act="remove" ${S.removeSel && !S.pending ? '' : 'disabled'}>이 카드 빼기</button>
    </div>
  </div>`;
}

function resultHTML() {
  const p = S.pub, r = p.result;
  const rank = [...(r.winner ? [r.winner] : []), ...p.elim.map(e => e.u).reverse()];
  const st = u => p.players[u].stats;
  const award = (title, key, unit, min = 1) => {
    const best = p.order.reduce((a, u) => (st(u)[key] > (a ? st(a)[key] : -1) ? u : a), null);
    return best && st(best)[key] >= min ? `<li><span class="aw">${title}</span>${ava(best, 'sm')}<b>${esc(name(best))}</b><small class="mono">${st(best)[key]}${unit}</small></li>` : '';
  };
  const isHost = S.meta.hostId === S.uid && S.host;
  return `<div class="screen result">
    <header class="topbar2"><div class="tb-left"><div class="brand">허리펴라</div><i class="vsep"></i><div class="stack">${lbl('MATCH RESULT', 'amber')}<b>${r.round}라운드 종료</b></div></div><div class="tb-right">${toggles()}</div></header>
    <div class="win">
      ${r.draw
        ? `<div class="stack center">${lbl('DRAW', 'red')}<h1>전원 탈선린, 무승부!</h1></div>`
        : `<div class="win-stage"><div class="unit-ring"></div><div class="win-char">${charSVG(charOf(r.winner))}</div></div>
           <div class="stack">${lbl('LAST SURVIVOR', 'amber')}<h1>${esc(name(r.winner))}</h1><span class="soft">최후의 생존자 · ${r.round}라운드</span></div>`}
    </div>
    <div class="result-body">
      <section class="panel">
        ${lbl('RANKING')}
        <ol class="rank">${rank.map((u, i) => {
          const e = p.elim.find(x => x.u === u);
          return `<li><span class="mono rk">${pad2(i + 1)}</span>${ava(u, 'sm')}<b>${esc(name(u))}</b><small>${i === 0 && !r.draw ? '생존' : `R${e.r} 탈선린${e.by ? ` · ${esc(name(e.by))}에게` : ''}`}</small></li>`;
        }).join('')}</ol>
      </section>
      <section class="panel">
        ${lbl('AWARDS')}
        <ul class="awards">
          ${award('딜량왕', 'dealt', ' 피해')}
          ${award('샌드백', 'taken', ' 받음')}
          ${award('자해왕', 'self', ' 자해')}
          ${award('한 방', 'maxHit', ' 최대')}
          ${award('킬러', 'kills', ' 킬')}
          ${award('철벽', 'blocked', ' 막음')}
          ${award('회복 장인', 'healed', ' 회복')}
        </ul>
      </section>
      <section class="panel stats">
        ${lbl('STATS')}
        <table><tr><th></th><th>가한 피해</th><th>받은 피해</th><th>자해</th><th>최대 한 방</th><th>카드</th></tr>
        ${p.order.map(u => `<tr><td>${esc(name(u))}</td><td class="mono">${st(u).dealt}</td><td class="mono">${st(u).taken}</td><td class="mono">${st(u).self}</td><td class="mono">${st(u).maxHit}</td><td class="mono">${st(u).cards}</td></tr>`).join('')}
        </table>
      </section>
    </div>
    <footer class="botbar">
      <span class="soft">${p.order.length}명 참가</span>
      ${isHost ? '<button class="btn primary cut2 start" data-act="rematch"><b>다시 하기</b><span class="mono">REMATCH →</span></button>' : '<span class="wait">호스트가 “다시 하기”를 누르면 대기실로 돌아가요</span>'}
    </footer>
  </div>`;
}

function overlayHTML() {
  if (S.joined && !active()) {
    return `<div class="blocker"><div class="panel">${lbl('SESSION', 'amber')}<h2>다른 탭에서 열려 있어요</h2><p class="soft">같은 브라우저의 다른 탭이 이 자리를 쓰고 있어요.</p><button class="btn primary cut" data-act="takeover"><b>여기서 계속하기</b></button></div></div>`;
  }
  const m = S.meta;
  if (S.joined && m.status === 'playing' && m.hostId !== S.uid && S.hostOffSince) {
    const left = Math.max(0, Math.ceil((RULES.hostGraceMs - (S.net.now() - S.hostOffSince)) / 1000));
    return `<div class="blocker"><div class="panel">${lbl('HOST LOST', 'red')}<h2>호스트 연결이 끊겼어요</h2><p class="soft">다시 연결되길 기다리는 중이에요. <b class="mono">${left}s</b> 안에 돌아오지 않으면 게임이 종료돼요.</p></div></div>`;
  }
  return '';
}

function editorHTML() {
  const list = Object.values(CARDS).sort((a, b) => +a.id.slice(1) - +b.id.slice(1));
  return `<div class="modal"><div class="modal-box wide editor">
    <div class="modal-head">
      <div class="stack">${lbl('CARD EDITOR', 'amber')}<h2>카드 수정해보기</h2></div>
      <div class="ed-actions">
        <span class="soft small ed-count">수정 <b class="mono">${editCount()}</b>장</span>
        <button class="btn ghost" data-act="edExportJSON">파일로 내보내기 (JSON)</button>
        <button class="btn ghost" data-act="edExportCSV">CSV</button>
        <button class="btn danger" data-act="edResetAll">모두 초기화</button>
        <button class="btn ghost" data-act="close">닫기</button>
      </div>
    </div>
    <div class="modal-body">
      <p class="soft small">카드 이름·비용·설명을 고쳐볼 수 있어요. 고친 내용은 <b>이 브라우저에만 저장</b>되고 다시 열어도 유지돼요. 게임에서 실제로 드는 에너지와 카드 효과는 바뀌지 않아요. 파일로 내보내서 전달하면 그 내용대로 반영할 수 있어요.</p>
      <div class="ed-list">${list.map(c => `<div class="ed-item ${isEdited(c.id) ? 'edited' : ''}" data-ed="${c.id}">
        ${cardHTML(c.id, { act: '', size: 'sm' })}
        <div class="ed-form">
          <div class="ed-title"><span class="mono dim">${c.id.slice(1)}</span><span class="lbl">${TYPE[c.type]} · ${SCOPE[c.scope]}</span>${lbl('EDITED', 'amber ed-flag')}</div>
          <div class="ed-row">
            <label class="ed-name"><span class="lbl">이름</span><input data-edit="${c.id}" data-f="name" maxlength="16" placeholder="${esc(c.name)}" value="${esc(cardName(c.id))}"></label>
            <label class="ed-cost"><span class="lbl">비용</span><input data-edit="${c.id}" data-f="cost" type="number" min="0" max="9" step="1" inputmode="numeric" placeholder="${c.cost}" value="${cardCost(c.id)}"></label>
          </div>
          <textarea data-edit="${c.id}" data-f="text" rows="3" placeholder="${esc(c.text)}">${esc(cardText(c.id))}</textarea>
          <div class="ed-orig"><span class="dim small">원래: ${esc(c.name)} · 비용 ${c.cost} · ${esc(c.text)}</span><button class="link-btn small" data-act="edReset" data-id="${c.id}">이 카드 되돌리기</button></div>
        </div>
      </div>`).join('')}</div>
    </div>
  </div></div>`;
}

let lastModal = '';
function renderModal() {
  let html = '';
  // 수정 창은 입력 중에 다시 그리면 커서가 사라지므로 열 때 한 번만 그린다
  if (S.modal === 'editor') {
    if (lastModal !== 'editor') { $('#modal').innerHTML = editorHTML(); lastModal = 'editor'; }
    return;
  }
  if (S.modal === 'gallery') {
    html = `<div class="modal"><div class="modal-box"><div class="modal-head"><div class="stack">${lbl('CARD INDEX', 'amber')}<h2>카드 도감 ${Object.keys(CARDS).length}</h2></div><div class="ed-actions"><button class="btn ghost" data-act="editor">카드 수정해보기</button><button class="btn ghost" data-act="close">닫기</button></div></div><div class="modal-body">${galleryHTML()}</div></div></div>`;
  } else if (S.modal === 'log' && S.pub) {
    const byRound = {};
    for (const h of S.pub.hist || []) (byRound[h.r] ||= []).push(h);
    const rounds = Object.keys(byRound).map(Number).sort((a, b) => b - a);
    html = `<div class="modal"><div class="modal-box"><div class="modal-head"><div class="stack">${lbl('PLAYED CARDS', 'amber')}<h2>지금까지 낸 카드</h2></div><button class="btn ghost" data-act="close">닫기</button></div>
      <div class="modal-body">
        ${rounds.map(r => `<h3>${lbl(`ROUND ${pad2(r)}`)}</h3><div class="hist-row">${byRound[r].map(h => `<div class="hist-item">
          <div class="hist-who">${ava(h.by, 'sm')}<b>${esc(name(h.by))}</b></div>
          ${h.id ? cardHTML(h.id, { act: '', size: 'sm' }) : hiddenCardHTML('sm')}
          <small>${h.tg?.length ? `→ ${h.tg.map(u => esc(name(u))).join(', ')}` : ''}</small>
        </div>`).join('')}</div>`).join('') || '<p class="soft">아직 낸 카드가 없어요.</p>'}
        <details class="text-log"><summary>글로 된 전투 기록</summary>
          <ul class="log full">${S.pub.log.slice().reverse().map(l => `<li class="k-${l.k}">${esc(l.t)}</li>`).join('')}</ul>
        </details>
      </div></div></div>`;
  } else if (S.modal === 'deck') {
    const priv = myPriv();
    const deck = priv?.deck || [];
    html = `<div class="modal"><div class="modal-box"><div class="modal-head"><div class="stack">${lbl('MY DECK', 'cyan')}<h2>내 덱 ${deck.length}장</h2></div><button class="btn ghost" data-act="close">닫기</button></div>
      <div class="modal-body"><p class="soft small">순서와 상관없이 카드 종류별로 정렬해서 보여줘요.</p><div class="grid">${deck.map(c => cardHTML(c.id, { act: '', size: 'sm' })).join('')}</div></div></div></div>`;
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
        liveMotion.play(box, 'hit', { power: Math.min(1, f.v / 14) });
      } else { liveMotion.play(box, 'guard'); V.text(x, y, '막음!', 'f-block'); sfx.blocked(); }
    } else if (f.k === 'ko') {
      liveMotion.play(box, 'down');
      V.eliminated(name(f.u));
      sfx.ko();
      shakePower = 20;
    } else {
      const t = { heal: `+${f.v}`, block: `🛡+${f.v}`, nullify: '무효!', react: '반응 설치', strip: '방어도 파괴!', unreact: '반응 무력화!', trigger: `${f.v}!`, debuff: f.v, gimmick: f.v }[f.k];
      if (t) V.text(x, y, t, `f-${f.k} ${f.kind ? `g-${f.kind}` : ''}`);
      if (f.k === 'heal') { liveMotion.play(box, 'heal'); V.sparkle(x, y); }
      else if (f.k === 'block' || f.k === 'nullify') liveMotion.play(box, 'guard');
      else if (f.k === 'react' || f.k === 'trigger' || f.k === 'gimmick') liveMotion.play(box, 'cast');
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
    (el.querySelector('.tv') || el.querySelector('span')).textContent = `${Math.ceil(left / 1000)}s`;
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

// 대기실에서 연결이 끊긴 사람은 호스트가 바로 내보낸다. 새로고침할 틈으로 3초만 기다린다.
// 게임 중에는 자리로 돌아올 수 있게 남겨둔다.
function pruneLobby() {
  if (!S.host || S.meta.status !== 'lobby') return;
  const now = Date.now();
  for (const [u, m] of Object.entries(S.lobby)) {
    if (isOnline(m)) { delete S.offSince[u]; continue; }
    S.offSince[u] ??= now;
    if (now - S.offSince[u] > 3000) {
      delete S.offSince[u];
      S.net.set('lobby/' + u, null);
    }
  }
}

const rnd = n => Math.floor(Math.random() * n);

// ── 기믹 툴팁 ──
let tipPinned = false;
function showTip(el, pin = false) {
  const id = el.dataset.gk || el.dataset.gm;
  if (!GIMMICKS[id]) return;
  let tip = $('#tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'tip';
    document.body.appendChild(tip);
  }
  tip.innerHTML = gimmickTipHTML(id, el.dataset.n ? +el.dataset.n : null)
    + (el.dataset.gm === 'hush' && el.querySelector('i') ? '<p class="tip-rule">이 사람의 기믹은 쉿 때문에 보이지 않아요.</p>' : '');
  tip.className = 'show';
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  let x = Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
  let y = r.top - h - 8;
  if (y < 8) y = r.bottom + 8;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
  tipPinned = pin;
}
function hideTip() {
  tipPinned = false;
  $('#tip')?.classList.remove('show');
}

// 수정 창에서 카드 미리보기·수정 표시·개수만 바꾼다 (창 전체를 다시 그리지 않는다)
function syncEditor(id) {
  const item = document.querySelector(`.ed-item[data-ed="${id}"]`);
  if (item) {
    item.classList.toggle('edited', isEdited(id));
    const set = (sel, v) => { const t = item.querySelector(sel); if (t) t.textContent = v; };
    set('.card .cname', cardName(id));
    set('.card .cost', cardCost(id));
    const t = item.querySelector('.card .ctext');
    if (t) t.innerHTML = linkGimmicks(esc(cardText(id)));
  }
  const n = document.querySelector('.ed-count b');
  if (n) n.textContent = editCount();
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
