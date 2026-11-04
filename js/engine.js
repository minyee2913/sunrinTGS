// 전투 규칙. 호스트 브라우저에서만 실행된다.
// 상태 G는 JSON으로 그대로 저장할 수 있는 평범한 객체로 유지한다 (호스트 새로고침 복구용).
import { CARDS, STARTER, REWARD_POOL, REACT_NAME } from './cards.js';
import { RULES } from './config.js';

// ── 난수 (mulberry32, 상태를 G.rng에 보관) ──
function rand(G) {
  let t = (G.rng = (G.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(G, a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(G) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const mk = (G, id) => ({ u: 'c' + (++G.uidSeq), id });
const P = (G, uid) => G.players[uid];
const alive = G => G.order.filter(u => G.players[u].alive);

function log(G, t, k = '') {
  G.log.push({ n: ++G.logSeq, t, k });
  if (G.log.length > RULES.logKeep) G.log.shift();
}
function fx(G, u, k, v) {
  G.fx.push({ n: ++G.fxSeq, u, k, v });
  if (G.fx.length > 30) G.fx.shift();
}

export function createGame({ gameId, players, seed, now }) {
  const G = {
    gameId, rng: seed | 0, uidSeq: 0,
    round: 1, turnNo: 0, turnIdx: -1, cur: null, phase: 'battle', deadline: 0,
    order: [], players: {}, log: [], logSeq: 0, fx: [], fxSeq: 0, last: null, lastSeq: 0,
    elim: [], pick: null, result: null, done: {}, ack: {}, startedAt: now,
  };
  G.order = shuffle(G, players.map(p => p.uid));
  for (const { uid, name } of players) {
    G.players[uid] = {
      uid, name, hp: RULES.maxHp, maxHp: RULES.maxHp, block: 0, energy: 0, alive: true,
      draw: shuffle(G, STARTER.map(id => mk(G, id))), hand: [], discard: [],
      react: null, drawPen: 0, atkSince: [], atkRecent: [], plays: {}, atkCount: 0, out: null,
      stats: { dealt: 0, taken: 0, self: 0, maxHit: 0, healed: 0, cards: 0, blocked: 0, kills: 0 },
    };
  }
  log(G, `게임 시작! 선공은 ${P(G, G.order[0]).name}`, 'sys');
  nextTurn(G, now);
  return G;
}

// ── 턴 진행 ──
function nextTurn(G, now) {
  let i = G.turnIdx + 1;
  while (i < G.order.length && !P(G, G.order[i]).alive) i++;
  if (i >= G.order.length) return endRound(G, now);
  G.turnIdx = i;
  beginTurn(G, G.order[i], now);
}

function beginTurn(G, uid, now) {
  const p = P(G, uid);
  G.turnNo++;
  G.cur = uid;
  G.phase = 'battle';
  p.block = 0;
  if (p.react) {
    p.react = null;
    log(G, `${p.name}의 반응 카드가 발동 없이 만료됐다`);
  }
  p.atkRecent = p.atkSince;
  p.atkSince = [];
  p.energy = RULES.energy;
  p.plays = {};
  p.atkCount = 0;
  draw(G, p, RULES.drawPerTurn - p.drawPen);
  p.drawPen = 0;
  G.deadline = now + RULES.turnMs;
}

export function endTurn(G, uid, now, reason = '') {
  if (G.phase !== 'battle' || G.cur !== uid) return '내 턴이 아니에요';
  const p = P(G, uid);
  if (reason === 'timeout') log(G, `${p.name}의 시간 초과`);
  if (p.alive) {
    for (const c of p.hand) {
      const n = CARDS[c.id].endInHand;
      if (n && p.alive) {
        log(G, `${p.name}, 손에 남은 ${CARDS[c.id].name} 때문에 피해 ${n}`);
        hurt(G, p, n, { src: p });
      }
    }
  }
  p.discard.push(...p.hand);
  p.hand = [];
  p.energy = 0;
  if (checkWin(G)) return null;
  nextTurn(G, now);
  return null;
}

function draw(G, p, n) {
  for (let k = 0; k < n; k++) {
    if (p.hand.length >= RULES.handMax) return;
    if (!p.draw.length) {
      if (!p.discard.length) return;
      p.draw = shuffle(G, p.discard);
      p.discard = [];
    }
    p.hand.push(p.draw.pop());
  }
}

// ── 피해 처리 ──
// 방어도부터 깎고 나머지를 체력에 적용한다. pierce면 방어도 무시.
function hurt(G, p, n, { src = null, pierce = false } = {}) {
  if (n <= 0) return 0;
  let blocked = 0;
  if (!pierce) {
    blocked = Math.min(p.block, n);
    p.block -= blocked;
  }
  const dmg = n - blocked;
  p.hp -= dmg;
  p.stats.blocked += blocked;
  if (src && src !== p) {
    src.stats.dealt += dmg;
    src.stats.maxHit = Math.max(src.stats.maxHit, dmg);
    p.stats.taken += dmg;
  } else if (src === p) {
    p.stats.self += dmg;
  } else {
    p.stats.taken += dmg;
  }
  fx(G, p.uid, 'dmg', dmg);
  if (p.alive && p.hp <= 0) kill(G, p, src);
  return dmg;
}

function kill(G, p, src) {
  p.alive = false;
  p.hp = 0;
  p.block = 0;
  p.react = null;
  p.out = G.round;
  G.elim.push({ u: p.uid, r: G.round, by: src && src !== p ? src.uid : null });
  if (src && src !== p) src.stats.kills++;
  log(G, `💀 ${p.name} 탈락!`, 'out');
}

// 공격 → 방어·반응 판정 → 최종 피해 → 반격 부가 효과. 반격 피해는 다시 반응을 일으키지 않는다.
function attack(G, src, tgt, n) {
  if (!tgt.alive) return;
  const r = tgt.react;
  let reflect = 0;
  if (r) tgt.react = null;
  if (r === 'ignore') {
    log(G, `${tgt.name}의 반응 발동: ${REACT_NAME.ignore}! 피해 무효`, 'react');
    fx(G, tgt.uid, 'nullify', 0);
    n = 0;
  } else if (r === 'mirror') {
    reflect = Math.floor(n / 2);
    n -= reflect;
    log(G, `${tgt.name}의 반응 발동: ${REACT_NAME.mirror}! 피해 ${reflect} 되돌림`, 'react');
  }
  hurt(G, tgt, n, { src });
  if (src !== tgt && !tgt.atkSince.includes(src.uid)) tgt.atkSince.push(src.uid);

  if (r === 'glare') {
    log(G, `${tgt.name}의 반응 발동: ${REACT_NAME.glare} ${src.name}에게 피해 6`, 'react');
    if (src.alive) hurt(G, src, 6, { src: tgt });
  } else if (r === 'snitch') {
    log(G, `${tgt.name}의 반응 발동: ${REACT_NAME.snitch} ${src.name}의 손패에 현타 2장`, 'react');
    if (src.alive) addCards(G, src, 'hyeonta', 2, 'hand');
  } else if (reflect > 0 && src.alive) {
    hurt(G, src, reflect, { src: tgt });
  }
}

function addCards(G, p, id, n, where) {
  for (let k = 0; k < n; k++) {
    const c = mk(G, id);
    if (where === 'hand' && p.hand.length < RULES.handMax) p.hand.push(c);
    else p.discard.push(c);
  }
}

// 내 다음 순서부터 도는 생존한 상대들
function othersOf(G, p) {
  const i = G.order.indexOf(p.uid);
  const rot = [...G.order.slice(i + 1), ...G.order.slice(0, i)];
  return rot.map(u => P(G, u)).filter(t => t.alive);
}

function makeCtx(G, p, target) {
  const c = {
    G, me: p, target, ended: false,
    attacksThisTurn: p.atkCount,
    recentAttackers: p.atkRecent.length,
    others: () => othersOf(G, p),
    attack: (t, n) => attack(G, p, t, n),
    attackOthers: n => othersOf(G, p).forEach(t => attack(G, p, t, n)),
    selfDamage: (n, pierce = false) => hurt(G, p, n, { src: p, pierce }),
    block: n => { p.block += n; fx(G, p.uid, 'block', n); },
    heal: n => {
      const amt = G.round >= RULES.suddenRound ? Math.floor(n / 2) : n;
      const got = Math.max(0, Math.min(p.maxHp - p.hp, amt));
      p.hp += got;
      p.stats.healed += got;
      fx(G, p.uid, 'heal', got);
    },
    draw: n => draw(G, p, n),
    gainEnergy: n => { p.energy += n; },
    drawPenalty: t => { if (t.alive) t.drawPen = 1; }, // 중첩되지 않음
    installReact: kind => { p.react = kind; fx(G, p.uid, 'react', 0); },
    addCards: (t, id, n, where) => addCards(G, t, id, n, where),
    stripBlock: t => { if (t.block) fx(G, t.uid, 'strip', t.block); t.block = 0; },
    endTurn: () => { c.ended = true; },
  };
  return c;
}

export function targetsOf(G, p, card, target) {
  if (card.scope === 'one') return [target.uid];
  if (card.scope === 'self') return [p.uid];
  const o = othersOf(G, p).map(t => t.uid);
  return card.scope === 'all' ? [p.uid, ...o] : o;
}

// 카드 사용. 거부하면 사유 문자열을 돌려주고 비용은 소모하지 않는다.
export function playCard(G, uid, cardU, targetUid, now) {
  if (G.phase !== 'battle') return '지금은 카드를 쓸 수 없어요';
  if (G.cur !== uid) return '내 턴이 아니에요';
  const p = P(G, uid);
  const i = p.hand.findIndex(c => c.u === cardU);
  if (i < 0) return '손패에 없는 카드예요';
  const inst = p.hand[i];
  const card = CARDS[inst.id];
  if (p.energy < card.cost) return '에너지가 부족해요';
  if (card.limit && (p.plays[inst.id] || 0) >= card.limit) return `이 카드는 한 턴에 ${card.limit}번까지 쓸 수 있어요`;
  if (card.type === 'react' && p.react) return '반응 카드는 하나만 설치할 수 있어요';
  let target = null;
  if (card.scope === 'one') {
    target = G.players[targetUid];
    if (!target || !target.alive || target === p) return '대상을 다시 골라주세요';
  }

  p.energy -= card.cost;
  p.hand.splice(i, 1);
  p.plays[inst.id] = (p.plays[inst.id] || 0) + 1;
  p.stats.cards++;
  if (!card.exhaust) p.discard.push(inst);

  const tg = targetsOf(G, p, card, target);
  G.last = { n: ++G.lastSeq, by: uid, id: inst.id, tg: card.scope === 'self' ? [] : tg, round: G.round };
  const tname = target ? ` → ${target.name}` : card.scope === 'others' ? ' → 모든 상대' : card.scope === 'all' ? ' → 전원' : '';
  // 반응 카드는 무엇을 설치했는지 숨긴다
  log(G, card.type === 'react' ? `${p.name} ▶ 반응 카드 설치` : `${p.name} ▶ ${card.name}${tname}`, 'play');
  if (card.type === 'react') G.last.id = null;

  const ctx = makeCtx(G, p, target);
  card.play(ctx);
  if (card.type === 'atk') p.atkCount++;

  if (checkWin(G)) return null;
  if (!p.alive || ctx.ended) endTurn(G, uid, now);
  return null;
}

// ── 라운드 종료와 덱 성장 ──
function endRound(G, now) {
  if (G.round >= RULES.suddenRound) {
    const n = RULES.suddenBase + (G.round - RULES.suddenRound);
    log(G, `⚠️ 라운드 종료 피해! 전원 방어도 무시 피해 ${n}`, 'sys');
    // 전원 동시에 적용
    for (const u of alive(G)) hurt(G, P(G, u), n, { pierce: true });
    if (checkWin(G)) return;
  }
  G.cur = null;
  G.phase = 'pick';
  G.pick = {};
  for (const u of alive(G)) {
    const pool = shuffle(G, [...REWARD_POOL]);
    G.pick[u] = { opts: pool.slice(0, 3), done: false };
  }
  G.deadline = now + RULES.pickMs;
  log(G, `${G.round}라운드 종료. 카드 선택 시간!`, 'sys');
}

export function pickCard(G, uid, cardId, now) {
  const s = G.phase === 'pick' && G.pick?.[uid];
  if (!s || s.done) return '지금은 카드를 고를 수 없어요';
  if (cardId && !s.opts.includes(cardId)) return '제시된 카드가 아니에요';
  if (cardId) P(G, uid).discard.push(mk(G, cardId));
  s.done = true;
  s.chose = cardId || null;
  if (Object.values(G.pick).every(x => x.done)) afterPick(G, now);
  return null;
}

export function removeCard(G, uid, cardU, now) {
  const s = G.phase === 'remove' && G.pick?.[uid];
  if (!s || s.done) return '지금은 카드를 뺄 수 없어요';
  if (cardU) {
    const p = P(G, uid);
    if (deckOf(p).length <= RULES.minDeck) return `덱은 ${RULES.minDeck}장보다 적어질 수 없어요`;
    let found = false;
    for (const pile of ['draw', 'discard', 'hand']) {
      const i = p[pile].findIndex(c => c.u === cardU);
      if (i >= 0) { p[pile].splice(i, 1); found = true; break; }
    }
    if (!found) return '덱에 없는 카드예요';
  }
  s.done = true;
  if (Object.values(G.pick).every(x => x.done)) finishRound(G, now);
  return null;
}

function afterPick(G, now) {
  if (G.round % RULES.removeEvery === 0) {
    G.phase = 'remove';
    for (const u of Object.keys(G.pick)) G.pick[u] = { done: false };
    G.deadline = now + RULES.pickMs;
    log(G, '덱에서 카드 1장을 뺄 수 있어요', 'sys');
  } else finishRound(G, now);
}

function finishRound(G, now) {
  G.pick = null;
  G.round++;
  G.turnIdx = -1;
  log(G, `── ${G.round}라운드 시작 ──`, 'sys');
  if (G.round === RULES.suddenRound) log(G, '⚠️ 이번 라운드부터 회복량 절반, 라운드 종료 피해 시작', 'sys');
  nextTurn(G, now);
}

function checkWin(G) {
  if (G.phase === 'ended') return true;
  const a = alive(G);
  if (a.length > 1) return false;
  G.phase = 'ended';
  G.cur = null;
  G.pick = null;
  G.result = { winner: a[0] || null, draw: a.length === 0, round: G.round };
  log(G, a.length ? `🏆 ${P(G, a[0]).name} 최후의 생존자!` : '전원 탈락… 무승부!', 'sys');
  return true;
}

// 시간 초과 처리. 상태가 바뀌었으면 true.
export function tick(G, now) {
  if (now < G.deadline) return false;
  if (G.phase === 'battle') {
    endTurn(G, G.cur, now, 'timeout');
    return true;
  }
  if (G.phase === 'pick' || G.phase === 'remove') {
    for (const s of Object.values(G.pick)) s.done = true;
    if (G.phase === 'pick') afterPick(G, now);
    else finishRound(G, now);
    return true;
  }
  return false;
}

const deckOf = p => [...p.draw, ...p.discard, ...p.hand];
const byCard = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// ── 공개 정보 / 개인 정보 ──
export function publicView(G) {
  const players = {};
  for (const [u, p] of Object.entries(G.players)) {
    players[u] = {
      name: p.name, hp: p.hp, maxHp: p.maxHp, block: p.block, energy: p.energy, alive: p.alive,
      react: !!p.react, hand: p.hand.length, draw: p.draw.length, discard: p.discard.length,
      deck: deckOf(p).length, drawPen: p.drawPen, out: p.out, stats: p.stats,
    };
  }
  const sudden = G.round >= RULES.suddenRound;
  return {
    gameId: G.gameId, round: G.round, turnNo: G.turnNo, cur: G.cur, phase: G.phase,
    deadline: G.deadline, order: G.order, players, log: G.log, fx: G.fx, last: G.last,
    elim: G.elim, result: G.result, startedAt: G.startedAt,
    pick: G.pick ? Object.fromEntries(Object.entries(G.pick).map(([u, s]) => [u, s.done])) : null,
    suddenDmg: sudden ? RULES.suddenBase + (G.round - RULES.suddenRound) : null,
  };
}

export function privateView(G, uid) {
  const p = G.players[uid];
  const s = G.pick?.[uid];
  return {
    gameId: G.gameId,
    hand: p.hand,
    react: p.react,
    plays: p.plays,
    atkCount: p.atkCount,
    recent: p.atkRecent.length,
    deck: deckOf(p).sort(byCard),
    pick: s ? { stage: G.phase, opts: s.opts || null, done: s.done } : null,
    ack: G.ack[uid] || null,
  };
}

// 행동 요청 처리. 중복·이전 판·지난 턴 요청은 거부한다.
export function handleRequest(G, uid, reqId, r, now) {
  if (r.gameId !== G.gameId || !G.players[uid]) return false;
  const done = (G.done[uid] ||= []);
  if (done.includes(reqId)) return false;
  done.push(reqId);
  if (done.length > 20) done.shift();

  let err = null;
  if ((r.type === 'play' || r.type === 'end') && r.turnNo !== G.turnNo) err = '이미 지나간 턴의 요청이에요';
  else if (r.type === 'play') err = playCard(G, uid, r.card, r.target, now);
  else if (r.type === 'end') err = endTurn(G, uid, now);
  else if (r.type === 'pick') err = pickCard(G, uid, r.card || null, now);
  else if (r.type === 'remove') err = removeCard(G, uid, r.card || null, now);
  else err = '알 수 없는 요청';
  G.ack[uid] = { id: reqId, err };
  return true;
}
