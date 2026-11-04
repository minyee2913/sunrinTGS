import { createNet, rid } from './net.js';
import { RULES } from './config.js';
import { CARDS } from './cards.js';
import { Host } from './host.js';
import { esc, cardHTML, hiddenCardHTML, avatarHTML, loadPhotos, galleryHTML } from './view.js';

const S = {
  net: null, uid: null, inst: rid(), ready: false,
  meta: {}, lobby: {}, pub: null, priv: null,
  joined: false, presenceOff: null,
  host: null, hostOffSince: null, claiming: false,
  sel: null, pickSel: null, removeSel: null, pickKey: '',
  pending: null, pendingAt: 0,
  modal: null, fxSeen: -1, fxGame: null, lastCur: undefined,
};

const $ = s => document.querySelector(s);
const app = $('#app');
const isOnline = m => !!m?.conn;
const active = () => !S.joined || S.lobby[S.uid]?.inst === S.inst;
const onlineMembers = () => Object.entries(S.lobby).filter(([, m]) => isOnline(m) && m.name).sort((a, b) => a[1].joinedAt - b[1].joinedAt);
const name = u => S.pub?.players[u]?.name ?? S.lobby[u]?.name ?? '?';

boot();

async function boot() {
  app.innerHTML = '<div class="screen center"><div class="logo">허리펴라</div><p class="muted">연결하는 중…</p></div>';
  loadPhotos(() => render(true));
  try {
    S.net = await createNet();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="screen center"><div class="logo">허리펴라</div><p class="err">서버에 연결하지 못했어요.<br><small>${esc(e.message)}</small></p></div>`;
    return;
  }
  S.uid = S.net.uid;
  S.net.on('meta', v => { S.meta = v || {}; update(); });
  S.net.on('lobby', v => { S.lobby = v || {}; update(); });
  S.net.on('pub', v => { S.pub = v?.s ? JSON.parse(v.s) : null; update(); });
  S.net.on('priv/' + S.uid, v => { S.priv = v?.s ? JSON.parse(v.s) : null; update(); });

  // 같은 브라우저에서 새로고침했으면 기존 자리로 복귀
  const mine = await S.net.get('lobby/' + S.uid);
  if (mine?.name) await join(mine.name);
  S.ready = true;

  document.addEventListener('click', onClick);
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
  try { localStorage.setItem('hp_name', nick); } catch {}
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
  if (S.pending || !S.pub) return;
  const id = rid();
  S.pending = id;
  S.pendingAt = Date.now();
  const body = { gameId: S.pub.gameId, turnNo: S.pub.turnNo, type, card: data.card ?? null, target: data.target ?? null, t: S.net.now() };
  S.net.set(`req/${S.uid}/${id}`, body).catch(e => {
    console.error(e);
    S.pending = null;
    toast('요청을 보내지 못했어요');
  });
  render();
}

function checkAck() {
  const a = S.priv?.ack;
  if (S.pending && a?.id === S.pending) {
    S.pending = null;
    if (a.err) toast(a.err);
  }
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
    if (p.cur === S.uid && S.lastCur !== undefined) flash('내 턴!');
    S.lastCur = p.cur;
  }
}

const myPriv = () => (S.priv && S.pub && S.priv.gameId === S.pub.gameId ? S.priv : null);

// 손패 카드를 지금 쓸 수 없는 이유 ('' = 사용 가능)
function blockReason(c) {
  const p = S.pub, me = p?.players[S.uid], priv = myPriv();
  const d = CARDS[c.id];
  if (!me || !priv || p.phase !== 'battle' || p.cur !== S.uid) return '내 턴에만 쓸 수 있어요';
  if (me.energy < d.cost) return '에너지가 부족해요';
  if (d.limit && (priv.plays?.[c.id] || 0) >= d.limit) return `한 턴에 ${d.limit}번까지 쓸 수 있어요`;
  if (d.type === 'react' && priv.react) return '반응 카드는 하나만 설치할 수 있어요';
  return '';
}

// ── 클릭 처리 ──
function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const p = S.pub;
  switch (act) {
    case 'join': return doJoin();
    case 'leave': return leave();
    case 'gallery': S.modal = 'gallery'; return render();
    case 'deck': S.modal = 'deck'; return render();
    case 'close': S.modal = null; return render();
    case 'takeover':
      S.net.update({ [`lobby/${S.uid}/inst`]: S.inst });
      S.presenceOff?.();
      S.presenceOff = S.net.presence(`lobby/${S.uid}/conn/${S.inst}`);
      return;
    case 'start': return startGame();
    case 'rematch': return S.host?.toLobby(null, S.lobby);
    case 'card':
      S.sel = S.sel === el.dataset.u ? null : el.dataset.u;
      return render();
    case 'cancel': S.sel = null; return render();
    case 'use': {
      const c = myPriv()?.hand.find(x => x.u === S.sel);
      if (!c) return;
      const why = blockReason(c);
      if (why) return toast(why);
      if (CARDS[c.id].scope === 'one') return toast('위에서 대상을 골라주세요');
      S.sel = null;
      return sendReq('play', { card: c.u });
    }
    case 'target': {
      const c = myPriv()?.hand.find(x => x.u === S.sel);
      const t = el.dataset.pid;
      if (!c || CARDS[c.id].scope !== 'one') return;
      const why = blockReason(c);
      if (why) return toast(why);
      if (t === S.uid) return toast('이 카드는 나에게 쓸 수 없어요');
      if (!p.players[t]?.alive) return toast('탈락한 친구예요');
      S.sel = null;
      return sendReq('play', { card: c.u, target: t });
    }
    case 'end': S.sel = null; return sendReq('end');
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
  S.host.startGame(list.map(([uid, m]) => ({ uid, name: m.name })));
}

// ── 렌더링 ──
function screen() {
  if (!S.joined) return 'entry';
  const m = S.meta;
  if (m.status === 'playing') {
    if (S.pub?.gameId === m.gameId) return S.pub.phase === 'ended' ? 'result' : 'battle';
    return 'wait';
  }
  return 'lobby';
}

let lastHTML = '';
function render(force = false) {
  if (!S.net || !S.ready) return;
  const scr = screen();
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
}

function modeBanner() {
  return S.net.mode === 'local'
    ? '<div class="banner local">로컬 테스트 모드: 같은 브라우저의 탭끼리만 연결돼요. 친구들과 하려면 <code>js/config.js</code>에 Firebase 설정을 넣어주세요.</div>'
    : '';
}

function entryHTML() {
  const playing = S.meta.status === 'playing';
  const n = onlineMembers().length;
  const saved = (() => { try { return localStorage.getItem('hp_name') || ''; } catch { return ''; } })();
  return `<div class="screen entry">
    ${modeBanner()}
    <div class="entry-box">
      <div class="logo big">허리펴라</div>
      <p class="tag">친구 사진으로 싸우는 턴제 덱빌딩 배틀로얄</p>
      <div class="join">
        <input id="nick" maxlength="10" placeholder="닉네임" autocomplete="off" value="${esc(saved)}">
        <button class="btn primary" data-act="join">참가하기</button>
      </div>
      <p class="status ${playing ? 'live' : ''}">${playing ? '🔴 게임 진행 중이에요. 지금 들어가면 관전자로 참가해요.' : `🟢 대기실에 ${n}명 있어요`}</p>
      <button class="btn ghost" data-act="gallery">카드 24종 보기</button>
    </div>
  </div>`;
}

function lobbyHTML() {
  const list = onlineMembers();
  const offline = Object.entries(S.lobby).filter(([, m]) => !isOnline(m) && m.name);
  const isHost = S.meta.hostId === S.uid && S.host;
  const n = list.length;
  const canStart = n >= RULES.minPlayers;
  const row = ([u, m], i) => `<li class="${u === S.uid ? 'me' : ''} ${i >= RULES.maxPlayers ? 'extra' : ''}">
      ${avatarHTML(u, m.name)}
      <span class="nm">${esc(m.name)}${u === S.uid ? ' <em>나</em>' : ''}</span>
      ${u === S.meta.hostId ? '<span class="crown">👑 호스트</span>' : ''}
      ${i >= RULES.maxPlayers ? '<span class="muted">다음 판 관전</span>' : ''}
    </li>`;
  return `<div class="screen lobby">
    ${modeBanner()}
    <div class="lobby-head"><div class="logo">허리펴라</div><span class="pill">대기실</span></div>
    ${S.meta.notice ? `<div class="banner warn">${esc(S.meta.notice)}</div>` : ''}
    <div class="lobby-body">
      <section class="panel plist">
        <h2>참가자 <b>${Math.min(n, RULES.maxPlayers)}</b> / ${RULES.maxPlayers}</h2>
        <ul>${list.map(row).join('')}${offline.map(([u, m]) => `<li class="off">${avatarHTML(u, m.name)}<span class="nm">${esc(m.name)}</span><span class="muted">연결 끊김</span></li>`).join('')}</ul>
      </section>
      <section class="panel howto">
        <h2>규칙 한눈에</h2>
        <ul>
          <li>체력 <b>${RULES.maxHp}</b>, 매 턴 에너지 <b>${RULES.energy}</b>, 카드 <b>${RULES.drawPerTurn}</b>장, 제한 시간 <b>${RULES.turnMs / 1000}</b>초</li>
          <li>마지막까지 살아남은 한 명이 승리</li>
          <li>라운드가 끝나면 카드 3장 중 1장을 덱에 추가</li>
          <li><b>반응 카드</b>는 내 턴에 미리 설치. 상대에겐 “준비됨”만 보여요</li>
          <li>${RULES.suddenRound}라운드부터 회복 절반 + 라운드 종료 피해</li>
        </ul>
        <button class="btn ghost" data-act="gallery">카드 24종 보기</button>
      </section>
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

function pboxHTML(u, targeting) {
  const p = S.pub, x = p.players[u];
  const can = targeting && x.alive && u !== S.uid;
  const cls = ['pbox', p.cur === u && 'cur', !x.alive && 'dead', u === S.uid && 'me', can && 'targetable', targeting && !can && 'dim'].filter(Boolean).join(' ');
  const pct = Math.max(0, (x.hp / x.maxHp) * 100);
  return `<button class="${cls}" data-act="target" data-pid="${u}">
    ${avatarHTML(u, x.name)}
    <div class="pinfo">
      <div class="pname">${esc(x.name)}${u === S.uid ? '<em>나</em>' : ''}${u === S.meta.hostId ? '<span title="호스트">👑</span>' : ''}</div>
      <div class="hp ${pct <= 30 ? 'low' : ''}"><i style="width:${pct}%"></i><span>${x.hp}/${x.maxHp}</span></div>
      <div class="badges">
        ${x.block ? `<b class="bd block">🛡 ${x.block}</b>` : ''}
        ${x.react ? '<b class="bd react">⚡ 반응 준비됨</b>' : ''}
        ${x.drawPen ? '<b class="bd pen">드로우 -1</b>' : ''}
        ${x.alive ? `<b class="bd hand">손패 ${x.hand}</b>` : ''}
      </div>
    </div>
    ${!x.alive ? `<div class="ko">탈락 · R${x.out}</div>` : ''}
    ${p.cur === u ? '<div class="turn-tag">턴</div>' : ''}
  </button>`;
}

function stageHTML(myTurn, selCard) {
  const p = S.pub, priv = myPriv();
  if (selCard) {
    const d = CARDS[selCard.id];
    const why = blockReason(selCard);
    let hint = '';
    if (selCard.id === 'whyme') hint = `지금 쓰면 추가 피해 +${Math.min(6, 2 * (priv.recent || 0))}`;
    if (selCard.id === 'rush') hint = `지금 쓰면 추가 피해 +${Math.min(9, 3 * (priv.atkCount || 0))}`;
    if (selCard.id === 'yolo') hint = p.players[S.uid].hp <= 20 ? '체력 20 이하: 피해 +6 적용' : '';
    if (selCard.id === 'wall') hint = priv.react ? '반응 설치됨: 방어도 +4 적용' : '';
    const action = why
      ? `<p class="why">${why}</p>`
      : d.scope === 'one'
        ? '<p class="pointer">👆 위에서 대상을 고르세요</p>'
        : `<button class="btn primary big" data-act="use">사용하기 <small>⚡${d.cost}</small></button>`;
    return `<div class="stage sel">
      ${cardHTML(selCard.id, { act: '', size: 'big' })}
      <div class="sel-side">
        ${hint ? `<p class="hint">${hint}</p>` : ''}
        ${action}
        <button class="btn ghost" data-act="cancel">닫기</button>
      </div>
    </div>`;
  }
  if (p.phase === 'pick' || p.phase === 'remove') {
    const done = Object.values(p.pick || {}).filter(Boolean).length;
    const all = Object.keys(p.pick || {}).length;
    return `<div class="stage note"><div class="big-emoji">🃏</div><p>${p.phase === 'pick' ? '라운드 보상 카드를 고르는 중' : '덱에서 뺄 카드를 고르는 중'}… (${done}/${all})</p><div class="timer" data-deadline="${p.deadline}"><i></i><span></span></div></div>`;
  }
  if (p.last) {
    const tg = p.last.tg.map(u => esc(name(u))).join(', ');
    return `<div class="stage last" data-last="${p.last.n}">
      <div class="who">${avatarHTML(p.last.by, name(p.last.by), 'sm')}<b>${esc(name(p.last.by))}</b></div>
      ${p.last.id ? cardHTML(p.last.id, { act: '', size: 'mid' }) : hiddenCardHTML('mid')}
      ${tg ? `<div class="tg">→ ${tg}</div>` : ''}
    </div>`;
  }
  return `<div class="stage note"><p>${myTurn ? '카드를 눌러 효과를 확인하고 사용하세요' : `${esc(name(p.cur))}의 첫 수를 기다리는 중…`}</p></div>`;
}

function battleHTML() {
  const p = S.pub, me = p.players[S.uid], priv = myPriv();
  const myTurn = p.phase === 'battle' && p.cur === S.uid;
  const selCard = S.sel && priv?.hand.find(c => c.u === S.sel);
  const targeting = !!selCard && CARDS[selCard.id].scope === 'one' && !blockReason(selCard);
  const curName = p.cur ? esc(name(p.cur)) : '';

  let dock;
  if (!me) {
    dock = '<footer class="dock spect"><b>👀 관전 중</b><span>손패와 덱 순서는 공개되지 않아요. 다음 판에 참가할 수 있어요.</span></footer>';
  } else if (!me.alive) {
    dock = `<footer class="dock spect"><b>💀 탈락</b><span>남은 경기를 관전하고 있어요.</span></footer>`;
  } else {
    const hand = priv?.hand || [];
    dock = `<footer class="dock ${myTurn ? 'my' : ''}">
      <div class="energy ${myTurn ? 'on' : ''}"><b>${me.energy}</b><small>/${RULES.energy}</small><span>에너지</span></div>
      <div class="hand ${hand.length > 6 ? 'tight' : ''}">${hand.map(c => cardHTML(c.id, { u: c.u, sel: S.sel === c.u, off: !!blockReason(c) })).join('') || `<p class="muted">${myTurn ? '손패를 다 썼어요' : `내 턴이 되면 카드 ${RULES.drawPerTurn}장을 뽑아요`}</p>`}</div>
      <div class="dock-side">
        ${myTurn ? `<div class="timer" data-deadline="${p.deadline}"><i></i><span></span></div>` : `<p class="muted small">${curName}의 턴</p>`}
        <button class="btn end" data-act="end" ${myTurn && !S.pending ? '' : 'disabled'}>턴 종료</button>
        <button class="link" data-act="deck">덱 ${me.deck} · 뽑을 ${me.draw} · 버림 ${me.discard}</button>
      </div>
    </footer>`;
  }

  const logs = p.log.slice(-8).reverse().map(l => `<li class="k-${l.k}">${esc(l.t)}</li>`).join('');
  const info = p.phase === 'battle'
    ? `<b>${p.round}라운드</b> · ${p.cur === S.uid ? '<span class="mine">내 턴</span>' : `${curName}의 턴`}`
    : `<b>${p.round}라운드</b> 종료 · 카드 선택`;

  return `<div class="screen battle ${me ? '' : 'spectating'}">
    <div class="rotate-hint">📱 가로 화면으로 돌리면 더 잘 보여요</div>
    <header class="players n${p.order.length}">${p.order.map(u => pboxHTML(u, targeting)).join('')}</header>
    <main class="mid">
      <div class="infobar">
        <span>${info}</span>
        ${p.phase === 'battle' ? `<div class="timer mini" data-deadline="${p.deadline}"><i></i><span></span></div>` : ''}
        ${p.suddenDmg ? `<span class="sudden">⚠️ 회복 절반 · 라운드 종료 피해 ${p.suddenDmg}</span>` : p.round === RULES.suddenRound - 1 ? '<span class="sudden soft">다음 라운드부터 종료 피해</span>' : ''}
        ${!me ? '<span class="pill">관전 중</span>' : ''}
      </div>
      <div class="mid-body">
        ${stageHTML(myTurn, selCard)}
        <ul class="log">${logs}</ul>
      </div>
    </main>
    ${dock}
    ${pickOverlayHTML()}
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
    return best && st(best)[key] >= min ? `<li><span class="aw">${title}</span>${avatarHTML(best, name(best), 'sm')}<b>${esc(name(best))}</b><small>${st(best)[key]}${unit}</small></li>` : '';
  };
  const isHost = S.meta.hostId === S.uid && S.host;
  return `<div class="screen result">
    <div class="win">
      ${r.draw ? '<h1>🤝 전원 탈락, 무승부!</h1>' : `<div class="crown-big">🏆</div>${avatarHTML(r.winner, name(r.winner), 'xl')}<h1>${esc(name(r.winner))} 최후의 생존자!</h1>`}
      <p class="muted">${r.round}라운드까지 진행</p>
    </div>
    <div class="result-body">
      <section class="panel">
        <h2>순위</h2>
        <ol class="rank">${rank.map((u, i) => {
          const e = p.elim.find(x => x.u === u);
          return `<li>${avatarHTML(u, name(u), 'sm')}<b>${esc(name(u))}</b><small>${i === 0 && !r.draw ? '생존' : `R${e.r} 탈락${e.by ? ` · ${esc(name(e.by))}에게` : ''}`}</small></li>`;
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
    html = `<div class="modal"><div class="modal-box"><div class="modal-head"><h2>카드 24종</h2><button class="btn ghost" data-act="close">닫기</button></div><div class="modal-body">${galleryHTML()}</div></div></div>`;
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
function spawnFx() {
  const p = S.pub;
  if (!p || screen() !== 'battle') return;
  const max = p.fx.length ? p.fx.at(-1).n : 0;
  if (S.fxGame !== p.gameId) {
    S.fxGame = p.gameId;
    S.fxSeen = max;
    return;
  }
  for (const f of p.fx) {
    if (f.n <= S.fxSeen) continue;
    const box = document.querySelector(`.pbox[data-pid="${f.u}"]`);
    if (!box) continue;
    const r = box.getBoundingClientRect();
    const t = { dmg: f.v ? `-${f.v}` : '막음!', heal: `+${f.v}`, block: `🛡+${f.v}`, nullify: '무효!', react: '⚡설치', strip: '방어도 파괴!' }[f.k];
    const el = document.createElement('div');
    el.className = `float f-${f.k} ${f.k === 'dmg' && !f.v ? 'f-zero' : ''}`;
    el.textContent = t;
    el.style.left = `${r.left + r.width / 2}px`;
    el.style.top = `${r.top + r.height * 0.4}px`;
    $('#fx').appendChild(el);
    setTimeout(() => el.remove(), 1300);
    if (f.k === 'dmg' && f.v) {
      box.classList.remove('hit');
      void box.offsetWidth;
      box.classList.add('hit');
    }
  }
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
    render();
  }
  if (S.hostOffSince || !S.meta.hostId) {
    hostDuty();
    render();
  }
  updateTimers();
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
