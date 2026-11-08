// 전투 규칙. 호스트 브라우저에서만 실행된다.
// 상태 G는 JSON으로 그대로 저장할 수 있는 평범한 객체로 유지한다 (호스트 새로고침 복구용).
//
// 턴 진행: 내 턴에 쓴 카드는 G.plan.acts에 예약만 된다. G 자체는 턴 시작 상태 그대로다.
//   예약 중 내 손패·에너지는 상대 반응을 무시한 가상 진행(provisional)으로 보여준다.
//   반응 결과를 미리 보고 되돌리는 일을 막기 위해서다.
//   턴 종료(commitTurn) 때 예약한 카드를 반응까지 포함해 실제로 처리한다.
//   단, 환전·상점·거래는 예약하지 않고 바로 G에 적용한다 (되돌릴 수 없다).
import { CARDS, STARTER, REWARD_POOL, CURSE, RARITY } from './cards.js';
import { GIMMICKS, CHANGE_CHANCE } from './gimmicks.js';
import { RULES } from './config.js';
import { EX_NAMES, exRate, buyPrice, sellPrice } from './economy.js';

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
// 덱 셔플은 플레이어마다 따로 둔 난수를 쓴다. 예약 단계와 실제 처리에서 뽑는 카드가 같아야 하기 때문이다.
const deckShuffle = (p, a) => shuffle(p, a);
const clone = o => JSON.parse(JSON.stringify(o));

const mk = (G, id) => ({ u: 'c' + (++G.uidSeq), id });
const P = (G, uid) => G.players[uid];
const alive = G => G.order.filter(u => G.players[u].alive);

function log(G, t, k = '') {
  G.log.push({ n: ++G.logSeq, t, k });
  if (G.log.length > RULES.logKeep) G.log.shift();
}
// 효과 기록. 실시간 표시용(G.fx)과 턴 종료 전투 연출용(현재 카드 묶음 G.grp)에 함께 쌓는다.
function fx(G, u, k, v, extra) {
  const f = { n: ++G.fxSeq, u, k, v, ...extra };
  G.fx.push(f);
  if (G.fx.length > 30) G.fx.shift();
  G.grp?.fx.push(f);
}

// 한 턴 동안 일어난 일을 카드(또는 턴 종료 피해 등) 단위로 묶는다
function group(G, g) {
  G.grp = { ...g, fx: [] };
  G.turnPlays.push(G.grp);
  return G.grp;
}

// 턴 종료 연출 길이. 클라이언트도 같은 값으로 연출 속도를 맞춘다.
export function replayMs(plays) {
  const n = plays?.length || 0;
  return n ? Math.min(RULES.replayMaxMs, RULES.replayBaseMs + n * RULES.replayPerMs) : 0;
}

function sealReplay(G) {
  if (G.replay?.turnNo === G.turnNo) return;
  // 턴 시작 효과(낙원으로 쓰러짐 등)만 담긴, 아직 나가지 않은 연출을 빈 연출로 덮어쓰지 않는다
  if (G.replay && G.delayUsed !== G.replay.n && !G.turnPlays.length) return;
  G.replay = { n: ++G.replaySeq, turnNo: G.turnNo, by: G.cur, plays: G.turnPlays };
}

// 라운드 보상 후보: 등급을 비중대로 먼저 뽑고, 그 등급에서 겹치지 않게 한 장씩
function rewardOpts(G, k) {
  const left = {};
  for (const id of REWARD_POOL) (left[CARDS[id].rarity] ||= []).push(id);
  const out = [];
  while (out.length < k) {
    const tiers = Object.keys(left).filter(r => left[r].length);
    if (!tiers.length) break;
    let x = rand(G) * tiers.reduce((a, r) => a + RARITY[r].w, 0);
    const r = tiers.find(t => (x -= RARITY[t].w) < 0) || tiers.at(-1);
    out.push(left[r].splice(Math.floor(rand(G) * left[r].length), 1)[0]);
  }
  return out;
}

// 다음 제한 시간에 연출 시간을 한 번만 더해준다
function delayOnce(G) {
  if (!G.replay || G.delayUsed === G.replay.n) return 0;
  G.delayUsed = G.replay.n;
  return replayMs(G.replay.plays);
}

export function createGame({ gameId, players, seed, now }) {
  const G = {
    gameId, rng: seed | 0, uidSeq: 0,
    round: 1, turnNo: 0, turnIdx: -1, cur: null, phase: 'battle', deadline: 0,
    order: [], players: {}, log: [], logSeq: 0, fx: [], fxSeq: 0, last: null, lastSeq: 0,
    elim: [], pick: null, result: null, done: {}, ack: {}, startedAt: now,
    turnPlays: [], grp: null, replay: null, replaySeq: 0, delayUsed: 0, hist: [],
  };
  G.order = shuffle(G, players.map(p => p.uid));
  for (const { uid, name, char } of players) {
    G.players[uid] = {
      uid, name, char: char || null, hp: RULES.maxHp, maxHp: RULES.maxHp, block: 0, energy: 0, alive: true,
      rng: (seed ^ [...uid].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)) | 0,
      draw: [], hand: [], discard: [],
      react: null, drawBonus: 0, enPen: 0, enBonus: 0, enCap: 0, keepBlock: false, st: {}, clean: true,
      atkSince: [], atkRecent: [], plays: {}, atkCount: 0, out: null,
      gold: RULES.startGold, shop: [], exEn: 0, tradeN: 0, sellN: 0,
      stats: { dealt: 0, taken: 0, self: 0, maxHit: 0, healed: 0, cards: 0, blocked: 0, kills: 0 },
    };
  }
  for (const p of Object.values(G.players)) {
    p.draw = deckShuffle(p, STARTER.map(id => mk(G, id)));
    draw(G, p, RULES.drawPerTurn);
  }
  rollShop(G);
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
  // 턴 시작 기믹 효과는 직전 턴 연출 끝에 붙인다 (이미 재생된 연출이면 새 연출로).
  // 아직 제한 시간에 연출 시간을 더하지 않은 연출 = 아직 클라이언트에 나가지 않은 연출
  // (낙원으로 쓰러져 다음 사람 턴으로 바로 넘어가는 경우에도 이어 붙는다)
  const fresh = G.replay && G.delayUsed !== G.replay.n;
  const startGrp = { k: 'start', by: uid, id: null, tg: [], fx: [] };
  const oldTurn = G.turnNo;
  G.turnNo++;
  G.cur = uid;
  G.phase = 'battle';
  G.turnPlays = [];
  G.plan = { acts: [] };
  G.grp = startGrp; // 턴 시작 효과(낙원 등)를 연출에 담는다
  if (p.keepBlock) p.keepBlock = false;
  else p.block = 0;
  if (p.react) {
    p.react = null;
    log(G, `${p.name}의 반응 카드가 발동 없이 만료됐다`);
  }
  p.atkRecent = p.atkSince;
  p.atkSince = [];
  p.energy = Math.max(0, RULES.energy - p.enPen + (p.enBonus || 0) - (p.enDebt || 0));
  p.enPen = 0;
  p.enBonus = 0;
  p.enDebt = 0;
  p.plays = {};
  p.atkCount = 0;
  p.drawBonus = 0;
  p.exEn = 0;
  p.tradeN = 0;
  p.sellN = 0;
  turnStartGimmicks(G, p);
  // 꼼짝 마!: 이번 턴 에너지 최대치 고정 (AI로 얻은 에너지까지 포함해서)
  if (p.enCap) {
    p.energy = Math.min(p.energy, p.enCap);
    p.enCap = 0;
  }
  G.grp = null;
  if (startGrp.fx.length) {
    if (fresh) G.replay.plays.push(startGrp);
    else G.replay = { n: ++G.replaySeq, turnNo: oldTurn, by: uid, start: true, plays: [startGrp] };
  }
  if (!p.alive) { // 낙원으로 쓰러진 경우
    if (checkWin(G)) return;
    return nextTurn(G, now);
  }
  G.deadline = now + RULES.turnMs + delayOnce(G);
}

// ── 기믹 ──
const gname = id => GIMMICKS[id].name;

// n만큼 쌓는다 (음수면 줄인다). 최대치가 있으면 그 이상 쌓이지 않는다.
export function addGimmick(G, t, id, n) {
  if (!t?.alive || !n) return;
  const g = GIMMICKS[id];
  const before = t.st[id] || 0;
  const after = Math.max(0, Math.min(g.max ?? Infinity, before + n));
  if (after === before) return;
  if (after) t.st[id] = after; else delete t.st[id];
  // 남의 턴에 받은 중첩은 바로 다음 내 턴 시작 감소에서 빼 준다 (1중첩이 내 턴이 오자마자 사라지지 않게)
  const fresh = (t.stNew ||= {});
  if (after > before && G.cur !== t.uid) fresh[id] = (fresh[id] || 0) + after - before;
  if (fresh[id] > after) fresh[id] = after;
  if (!fresh[id]) delete fresh[id];
  if (id === 'rice' && after > before) t.clean = true;
  const hidden = t.st.hush && id !== 'hush';
  fx(G, t.uid, 'gimmick', hidden ? '기믹 ?' : `${g.name} ${after > before ? '+' : ''}${after - before}`, { g: hidden ? null : id, kind: g.kind });
  if (id === 'jjdeath' && after) dieByJjdeath(G, t);
}

function dieByJjdeath(G, t) {
  log(G, `${t.name}의 ${gname('jjdeath')}: 사망`, 'out');
  kill(G, t, null);
}

// 예? → 엄 → 티~원 → 줴줴이야~. 효과를 낸 뒤 5% 확률로 다음 단계로 바뀐다 (중첩은 그대로).
// 바뀐 기믹이 같은 턴에 또 효과를 내지 않도록 뒤 단계부터 처리한다.
function chainGimmicks(G, p) {
  const st = p.st;
  for (const id of ['tione', 'eom', 'ye']) {
    const n = st[id];
    if (!n || !p.alive) continue;
    if (id === 'tione') {
      log(G, `${p.name}의 ${gname(id)}: 체력 ${5 * n} 회복`);
      healP(G, p, 5 * n);
    } else {
      const loss = (id === 'ye' ? 1 : 2) * n;
      log(G, `${p.name}의 ${gname(id)}: 체력 -${loss}`);
      hurt(G, p, loss, { pierce: true });
    }
    if (!p.alive || rand(G) >= CHANGE_CHANCE) continue;
    const to = GIMMICKS[id].next;
    delete st[id];
    st[to] = (st[to] || 0) + n;
    const hidden = st.hush;
    fx(G, p.uid, 'gimmick', hidden ? '기믹 ?' : `${gname(id)} → ${gname(to)}!`, { g: hidden ? null : to, kind: GIMMICKS[to].kind });
    log(G, `${p.name}의 ${gname(id)}이(가) ${gname(to)}(으)로 바뀌었다`);
    if (to === 'jjdeath') dieByJjdeath(G, p);
  }
}

function turnStartGimmicks(G, p) {
  const st = p.st;
  if (st.paradise) {
    const good = rand(G) < .5;
    // 동전 던지기 연출: 결과(good)를 먼저 알리고, 이어서 회복/피해를 보여준다
    fx(G, p.uid, 'roll', good ? 1 : -1, { g: st.hush ? null : 'paradise', name: st.hush ? '기믹 ?' : gname('paradise'), amt: 5, kind: 'mixed' });
    if (good) {
      const got = Math.min(5, p.maxHp - p.hp);
      p.hp += got;
      fx(G, p.uid, 'heal', got, { h: p.hp });
      log(G, `${p.name}의 ${gname('paradise')}: 체력 +${got}`);
    } else {
      log(G, `${p.name}의 ${gname('paradise')}: 체력 -5`);
      hurt(G, p, 5, { pierce: true });
    }
  }
  if (!p.alive) return;
  chainGimmicks(G, p);
  if (!p.alive) return;
  if (st.rice) {
    if (p.clean) {
      log(G, `${p.name}의 ${gname('rice')}: 피해를 받지 않아 체력 10 회복`);
      healP(G, p, 10);
    }
    p.clean = true;
  }
  if (st.ai) {
    p.energy += 1;
    fx(G, p.uid, 'gimmick', `${gname('ai')}: 에너지 +1`, { g: 'ai', kind: 'buff' });
  }
  if (st.slow && p.hand.length) {
    const n = Math.min(st.slow, p.hand.length);
    p.draw.push(...p.hand.splice(-n).reverse());
    fx(G, p.uid, 'gimmick', `${gname('slow')}: 드로우 -${n}`, { g: 'slow', kind: 'debuff' });
    log(G, `${p.name}의 ${gname('slow')}: 드로우 -${n}`);
  }
  const fresh = p.stNew || {};
  for (const id of Object.keys(st)) {
    if (GIMMICKS[id].keep) continue; // 예?·엄·티~원은 줄지 않는다
    if ((fresh[id] || 0) >= st[id]) continue; // 전부 지난 내 턴 뒤에 받은 중첩이면 이번에는 줄지 않는다
    st[id]--;
    if (st[id] <= 0) delete st[id];
  }
  p.stNew = {};
}

export function endTurn(G, uid, now, reason = '') {
  if (G.phase !== 'battle' || G.cur !== uid) return '내 턴이 아니에요';
  const p = P(G, uid);
  if (reason === 'timeout') log(G, `${p.name}의 시간 초과`);
  if (G.trade) closeTrade(G, '턴이 끝나 거래 제안이 사라졌다');
  // 이 턴에 몰래 쓴 회방 카드가 마지막에 한꺼번에 발동한다
  resolveAmbush(G);
  if (G.phase !== 'battle') return null;
  if (p.alive) {
    for (const c of p.hand) {
      const n = CARDS[c.id].endInHand;
      if (n && p.alive) {
        log(G, `${p.name}, 손에 남은 ${CARDS[c.id].name} 때문에 피해 ${n}`);
        group(G, { k: 'curse', by: uid, id: c.id, tg: [] });
        hurt(G, p, n, { src: p });
      }
    }
  }
  G.grp = null;
  // 보존 카드는 손에 남긴다
  p.discard.push(...p.hand.filter(c => !CARDS[c.id].retain));
  p.hand = p.hand.filter(c => CARDS[c.id].retain);
  p.energy = 0;
  // 다음 턴 손패를 미리 뽑아 둔다 (내 턴에만 쓸 수 있다). 이번 턴에 걸린 내 드로우 증감을 여기서 반영한다.
  if (p.alive) draw(G, p, RULES.drawPerTurn + p.drawBonus);
  p.drawBonus = 0;
  sealReplay(G);
  if (checkWin(G)) return null;
  // 회방으로 얻은 추가 턴: 순서와 상관없이 바로 그 사람의 턴. 끝나면 원래 순서(turnIdx)대로 이어간다.
  while (G.extra?.length) {
    const q = P(G, G.extra.shift());
    if (!q?.alive) continue;
    log(G, `⏩ ${q.name}의 추가 턴!`, 'sys');
    beginTurn(G, q.uid, now);
    return null;
  }
  nextTurn(G, now);
  return null;
}

function draw(G, p, n) {
  for (let k = 0; k < n; k++) {
    if (p.hand.length >= RULES.handMax) return;
    if (!p.draw.length) {
      if (!p.discard.length) return;
      p.draw = deckShuffle(p, p.discard);
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
  if (dmg > 0) p.clean = false;
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
  fx(G, p.uid, 'dmg', dmg, { s: src?.uid || null, b: blocked, h: Math.max(0, p.hp) });
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
  fx(G, p.uid, 'ko', 0);
  log(G, `💀 ${p.name} 탈락!`, 'out');
  // 쓰러뜨린 사람이 돈을 모두 가져간다
  if (src && src !== p && src.alive && p.gold > 0) {
    src.gold += p.gold;
    fx(G, src.uid, 'gimmick', `돈 +${p.gold}`, { kind: 'buff' });
    log(G, `${src.name}, ${p.name}의 돈 ${p.gold} 획득`);
    p.gold = 0;
  }
  if (G.trade && (G.trade.from === p.uid || G.trade.to === p.uid)) closeTrade(G, '탈락으로 거래 제안이 사라졌다');
}

// 공격 → 방어·반응 판정 → 최종 피해 → 반격 부가 효과. 반격 피해는 다시 반응을 일으키지 않는다.
// 체력에 들어간 피해를 돌려준다.
function attack(G, src, tgt, n, { pierce = false } = {}) {
  if (!tgt || !tgt.alive) return 0;
  if (n > 0) n = Math.max(0, n + (src.st.str || 0) - (src.st.weak || 0));
  if (src.st.buta && tgt.st.manjun) n *= 2;
  const rc = tgt.react && !G.noReact && !CARDS[tgt.react].react?.swing && !CARDS[tgt.react].react?.redirect ? CARDS[tgt.react] : null;
  const R = rc?.react;
  let reflect = 0;
  const notes = [];
  if (R) {
    tgt.react = null;
    fx(G, tgt.uid, 'trigger', rc.name, { id: rc.id, s: src.uid }); // 카드 공개가 먼저, 효과(방어도·무효 등)는 그 뒤에
    if (R.block) { const b = R.block + (tgt.st.dex || 0); tgt.block += b; fx(G, tgt.uid, 'block', b); notes.push(`방어도 +${b}`); }
    if (R.reduce) { n = Math.max(0, n - R.reduce); notes.push(`피해 ${R.reduce} 감소`); }
    if (R.nullify) { n = 0; fx(G, tgt.uid, 'nullify', 0); notes.push('피해 무효'); }
    if (R.reflect) { reflect = Math.floor(n * R.reflect); n -= reflect; if (reflect) notes.push(`피해 ${reflect} 되돌림`); }
    if (R.counter) notes.push(`${src.name}에게 피해 ${R.counter}`);
    if (R.curse) notes.push(`${src.name}의 손패에 ${CARDS[CURSE].name} ${R.curse}장`);
    if (R.penalty) notes.push(`${src.name}의 다음 턴 드로우·에너지 감소`);
    if (R.drawBonus) notes.push(`다음 턴 카드 +${R.drawBonus}`);
    if (R.drain) notes.push(`${src.name}의 에너지 -${R.drain}`);
    for (const [id, k] of Object.entries(R.give || {})) notes.push(`${src.name}에게 ${gname(id)} ${k}`);
    for (const [id, k] of Object.entries(R.gain || {})) notes.push(`${gname(id)} ${k} 획득`);
    log(G, `${tgt.name}의 반응 발동: ${rc.name}! ${notes.join(', ')}`, 'react');
  }
  const dmg = n > 0 ? hurt(G, tgt, n, { src, pierce }) : 0;
  if (n <= 0 && !R?.nullify) fx(G, tgt.uid, 'dmg', 0, { s: src.uid, b: 0, h: tgt.hp });
  if (dmg > 0 && tgt.alive && tgt.st.manjun) healP(G, tgt, Math.floor(dmg / 2));
  if (src !== tgt && !tgt.atkSince.includes(src.uid)) tgt.atkSince.push(src.uid);
  if (dmg > 0) swing(G, tgt);

  if (R) {
    if (R.drawBonus && tgt.alive) giveDraw(G, tgt, R.drawBonus);
    if (src.alive && R.counter) hurt(G, src, R.counter, { src: tgt });
    if (src.alive && reflect) hurt(G, src, reflect, { src: tgt });
    if (src.alive && R.curse) { addCards(G, src, CURSE, R.curse, 'hand'); fx(G, src.uid, 'debuff', `${CARDS[CURSE].name} +${R.curse}`); }
    if (src.alive && R.penalty) { addGimmick(G, src, 'slow', 1); src.enPen = 1; fx(G, src.uid, 'debuff', '에너지 -1'); }
    if (src.alive && R.drain) { src.energy = Math.max(0, src.energy - R.drain); fx(G, src.uid, 'debuff', `에너지 -${R.drain}`); }
    for (const [id, k] of Object.entries(R.give || {})) if (src.alive) addGimmick(G, src, id, k);
    for (const [id, k] of Object.entries(R.gain || {})) if (tgt.alive) addGimmick(G, tgt, id, k);
  }
  return dmg;
}

// 스윙: 다른 사람이 공격으로 피해를 입으면, 이 반응을 설치한 사람이 그 사람에게 바로 피해를 준다
function swing(G, hit) {
  if (G.noReact || !hit.alive) return;
  for (const u of G.order) {
    const q = P(G, u);
    const rc = q.react && CARDS[q.react];
    const R = rc?.react;
    if (!R?.swing || q === hit || !q.alive) continue;
    q.react = null;
    log(G, `${q.name}의 반응 발동: ${rc.name}! ${hit.name}에게 피해 ${R.swing}`, 'react');
    fx(G, q.uid, 'trigger', rc.name, { id: rc.id });
    hurt(G, hit, R.swing, { src: q });
    if (!hit.alive) return;
  }
}

// 공간 전이: 나를 대상으로 고른 카드를 무작위 다른 사람에게 돌린다 (돌릴 사람이 없으면 무효)
function redirect(G, p, target) {
  if (G.noReact || !target?.react || !CARDS[target.react].react?.redirect) return target;
  const rc = CARDS[target.react];
  target.react = null;
  const pool = othersOf(G, p).filter(t => t !== target);
  const to = pool.length ? pool[Math.floor(rand(G) * pool.length)] : null;
  log(G, `${target.name}의 반응 발동: ${rc.name}! ${to ? `카드가 ${to.name}에게 향한다` : '카드가 무효가 됐다'}`, 'react');
  fx(G, target.uid, 'trigger', rc.name, { id: rc.id });
  return to;
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

// 역전: 내 체력이 살아 있는 다른 모든 사람보다 낮다
export function isBehind(G, p) {
  const o = othersOf(G, p);
  return p.alive && o.length > 0 && o.every(t => p.hp < t.hp);
}

function makeCtx(G, p, card, target) {
  const others = () => othersOf(G, p);
  const pickRandom = list => list[Math.floor(rand(G) * list.length)] || null;
  const boost = RARITY[card.rarity]?.boost && isBehind(G, p) ? RARITY[card.rarity].boost : 1;
  // 역전 배율. 알빠노를 가진 다른 사람(t)에게는 원래 수치로 적용한다.
  const B = (n, t = null) => (boost === 1 || !n || (t && t !== p && t.st.alppano) ? n : Math.sign(n) * Math.ceil(Math.abs(n) * boost));
  const c = {
    G, me: p, target, ended: false, hits: [], boost,
    attacksThisTurn: p.atkCount,
    recentAttackers: p.atkRecent.length,
    others,
    attack: (t, n, opts) => { if (t) c.hits.push(t.uid); return attack(G, p, t, B(n, t), opts); },
    attackOthers: n => others().forEach(t => c.attack(t, n)),
    selfDamage: (n, pierce = false) => hurt(G, p, n, { src: p, pierce }),
    block: n => { n = B(n) + (p.st.dex || 0); p.block += n; fx(G, p.uid, 'block', n); },
    giveBlock: (t, n) => { if (t?.alive) { n = B(n, t) + (t.st.dex || 0); t.block += n; fx(G, t.uid, 'block', n); } },
    gain: (id, n) => addGimmick(G, p, id, B(n)),
    give: (t, id, n) => addGimmick(G, t, id, B(n, t)),
    giveOthers: (id, n) => othersOf(G, p).forEach(t => addGimmick(G, t, id, B(n, t))),
    keepBlock: () => { p.keepBlock = true; },
    heal: n => healP(G, p, B(n)),
    healOther: (t, n) => healP(G, t, B(n, t)),
    // ── 돈 ──
    gainGold: n => { n = B(n); if (n > 0) { p.gold += n; fx(G, p.uid, 'gimmick', `돈 +${n}`, { kind: 'buff' }); } return n; },
    // 대상의 돈을 n까지 빼앗는다. 빼앗은 양을 돌려준다.
    stealGold: (t, n) => {
      if (!t?.alive) return 0;
      const k = Math.min(t.gold || 0, B(n, t));
      if (k <= 0) { fx(G, t.uid, 'gimmick', '뺏을 돈 없음', { kind: 'mixed' }); return 0; }
      t.gold -= k;
      p.gold += k;
      fx(G, t.uid, 'debuff', `돈 -${k}`);
      fx(G, p.uid, 'gimmick', `돈 +${k}`, { kind: 'buff' });
      log(G, `${p.name}, ${t.name}의 돈 ${k}을 빼앗았다`);
      return k;
    },
    // 내 돈을 max까지 쓴다. 쓴 양을 돌려준다.
    spendGold: max => { const k = Math.min(p.gold || 0, max); if (k > 0) { p.gold -= k; fx(G, p.uid, 'gimmick', `돈 -${k}`, { kind: 'mixed' }); } return k; },
    swapGold: t => {
      if (!t?.alive) return;
      [p.gold, t.gold] = [t.gold || 0, p.gold || 0];
      fx(G, p.uid, 'gimmick', `돈 ${p.gold}`, { kind: 'mixed' });
      fx(G, t.uid, 'gimmick', `돈 ${t.gold}`, { kind: 'mixed' });
      log(G, `${p.name}와 ${t.name}의 돈이 바뀌었다`);
    },
    // 대상의 손패에서 무작위 카드 1장을 뺏어 내 손으로 (손이 꽉 차면 버린 더미로)
    stealCard: t => {
      if (!t?.alive || !t.hand.length) { if (t) fx(G, t.uid, 'gimmick', '뺏을 카드 없음', { kind: 'mixed' }); return null; }
      const inst = t.hand.splice(Math.floor(rand(G) * t.hand.length), 1)[0];
      (p.hand.length < RULES.handMax ? p.hand : p.discard).push(inst);
      fx(G, t.uid, 'debuff', '카드 1장 뺏김');
      fx(G, p.uid, 'gimmick', '카드 +1', { kind: 'buff' });
      log(G, `${p.name}, ${t.name}의 카드 1장을 뺏었다`);
      return inst;
    },
    // 해로운 기믹을 모두 없앤다
    cleanse: (t = p) => {
      if (!t?.alive) return;
      const bad = Object.keys(t.st).filter(id => GIMMICKS[id]?.kind === 'debuff');
      if (!bad.length) return;
      for (const id of bad) { delete t.st[id]; if (t.stNew) delete t.stNew[id]; }
      fx(G, t.uid, 'gimmick', '해로운 기믹 제거', { kind: 'buff' });
      log(G, `${t.name}의 해로운 기믹이 모두 사라졌다`);
    },
    // 최대 체력 증감. 늘면 체력도 그만큼 오르고, 줄면 체력이 최대치를 넘지 않게 깎인다.
    changeMaxHp: (t, n) => {
      if (!t?.alive || !n) return;
      n = B(n, t);
      t.maxHp = Math.max(1, t.maxHp + n);
      if (n > 0) t.hp += n;
      t.hp = Math.min(t.hp, t.maxHp);
      fx(G, t.uid, n > 0 ? 'gimmick' : 'debuff', `최대 체력 ${n > 0 ? '+' : ''}${n}`, { kind: n > 0 ? 'buff' : 'debuff' });
      if (n > 0) fx(G, t.uid, 'heal', n, { h: t.hp });
      log(G, `${t.name}의 최대 체력 ${n > 0 ? '+' : ''}${n} (${t.hp}/${t.maxHp})`);
    },
    // 내 순서를 바로 앞의 살아 있는 사람과 바꾼다. 이번 라운드에 이미 턴을 한 사람과 바꾸므로 이번 라운드 진행은 그대로다.
    moveUp: () => {
      const i = G.order.indexOf(p.uid);
      let j = i - 1;
      while (j >= 0 && !P(G, G.order[j]).alive) j--;
      if (j < 0) { fx(G, p.uid, 'gimmick', '이미 맨 앞', { kind: 'mixed' }); return false; }
      // 추가 턴 중에 이번 라운드 턴을 이미 한 사람(turnIdx 이하)과 아직 안 한 나를 바꾸면 그 사람이 두 번 하게 되므로 막는다
      if (j <= G.turnIdx && G.turnIdx < i) { fx(G, p.uid, 'gimmick', '지금은 순서를 못 바꿈', { kind: 'mixed' }); return false; }
      const q = P(G, G.order[j]);
      [G.order[i], G.order[j]] = [G.order[j], G.order[i]];
      fx(G, p.uid, 'gimmick', '순서 앞으로!', { kind: 'buff' });
      log(G, `${p.name}, 순서를 ${q.name}의 앞으로 옮겼다`, 'sys');
      return true;
    },
    // 이 턴이 끝나면 바로 내 추가 턴 (회방 카드용)
    extraTurn: () => { (G.extra ||= []).push(p.uid); fx(G, p.uid, 'gimmick', '추가 턴 예약!', { kind: 'buff' }); },
    draw: n => draw(G, p, B(n)),
    gainEnergy: n => { p.energy += B(n); },
    energyPenalty: t => { if (t?.alive) { t.enPen = 1; fx(G, t.uid, 'debuff', '에너지 -1'); } },
    installReact: () => { p.react = card.id; fx(G, p.uid, 'react', 0); },
    stripReact: t => {
      if (!t?.react) return;
      t.react = null;
      fx(G, t.uid, 'unreact', 0);
      log(G, `${t.name}의 반응 카드가 발동하지 못하고 사라졌다`, 'react');
    },
    addCards: (t, id, n, where) => { addCards(G, t, id, n, where); fx(G, t.uid, 'debuff', `${CARDS[id].name} +${n}`); },
    stripBlock: t => { if (t.block) fx(G, t.uid, 'strip', t.block); t.block = 0; },
    swapBlock: t => { [p.block, t.block] = [t.block, p.block]; fx(G, p.uid, 'block', p.block); fx(G, t.uid, 'block', t.block); },
    takeBlock: (t, n) => { n = Math.min(t.block, n); if (n > 0) { t.block -= n; fx(G, t.uid, 'strip', n); } return n; },
    clearGimmicks: t => {
      if (!t?.alive || !Object.keys(t.st).length) return;
      t.st = {};
      t.stNew = {};
      fx(G, t.uid, 'debuff', '기믹 모두 제거');
      log(G, `${t.name}의 기믹이 모두 사라졌다`);
    },
    energyBonus: (t, n) => { if (t?.alive) { t.enBonus = (t.enBonus || 0) + n; fx(G, t.uid, 'gimmick', `다음 턴 에너지 +${n}`, { kind: 'buff' }); } },
    energyCap: (t, n) => { if (t?.alive) { t.enCap = n; fx(G, t.uid, 'debuff', `다음 턴 에너지 최대 ${n}`); } },
    playsThisTurn: () => Object.values(p.plays).reduce((a, b) => a + b, 0),
    topOther: () => others().reduce((a, t) => (!a || t.hp > a.hp ? t : a), null),
    lowestOther: () => others().reduce((a, t) => (!a || t.hp < a.hp ? t : a), null),
    randomAlive: withSelf => pickRandom(withSelf ? [p, ...others()].filter(t => t.alive) : others()),
    randomOthers: k => shuffle(G, others()).slice(0, k),
    endTurn: () => { c.ended = true; },
  };
  return c;
}

function giveDraw(G, t, n) {
  if (t.uid === G.cur) t.drawBonus += n;
  else draw(G, t, n);
}

function healP(G, p, n) {
  if (!p.alive || n <= 0) return 0;
  const amt = G.round >= RULES.suddenRound ? Math.floor(n / 2) : n;
  const got = Math.max(0, Math.min(p.maxHp - p.hp, amt));
  p.hp += got;
  p.stats.healed += got;
  fx(G, p.uid, 'heal', got, { h: p.hp });
  return got;
}

export function targetsOf(G, p, card, target) {
  if (card.scope === 'one') return [target.uid];
  if (card.scope === 'self' || card.scope === 'random' || card.scope === 'top') return [];
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
  if (inTrade(G, uid, cardU)) return '거래에 내놓은 카드예요';
  const inst = p.hand[i];
  const card = CARDS[inst.id];
  if (p.energy < card.cost) return '에너지가 부족해요';
  if (card.limit && (p.plays[inst.id] || 0) >= card.limit) return `이 카드는 한 턴에 ${card.limit}번까지 쓸 수 있어요`;
  if (card.type === 'react' && p.react) return '반응 카드는 하나만 설치할 수 있어요';
  let target = null;
  const blind = card.scope === 'one' && p.st.blind;
  if (blind) {
    if (!othersOf(G, p).length) return '대상이 없어요';
  } else if (card.scope === 'one') {
    target = G.players[targetUid];
    if (!target || !target.alive || target === p) return '대상을 다시 골라주세요';
  }

  if (blind) {
    const o = othersOf(G, p);
    target = o[Math.floor(rand(G) * o.length)];
  }
  p.energy -= card.cost;
  p.hand.splice(i, 1);
  p.plays[inst.id] = (p.plays[inst.id] || 0) + 1;
  p.stats.cards++;
  if (!card.exhaust) p.discard.push(inst);

  const tg = targetsOf(G, p, card, target);
  G.last = { n: ++G.lastSeq, by: uid, id: inst.id, tg, round: G.round };
  const tname = target ? ` → ${target.name}` : card.scope === 'others' ? ' → 모든 상대' : card.scope === 'all' ? ' → 전원' : '';
  // 반응 카드는 무엇을 설치했는지 숨긴다
  log(G, card.type === 'react' ? `${p.name} ▶ 반응 카드 설치` : `${p.name} ▶ ${card.name}${tname}${blind ? ` (${gname('blind')}: 무작위)` : ''}`, 'play');
  if (card.type === 'react') G.last.id = null;

  group(G, { k: 'card', by: uid, id: G.last.id, t: card.type, tg });
  const was = target;
  target = redirect(G, p, target);
  if (was && target !== was) G.grp.tg = G.last.tg = target ? [target.uid] : [];
  const ctx = makeCtx(G, p, card, target);
  if (ctx.boost > 1) {
    fx(G, uid, 'comeback', ctx.boost);
    log(G, `${p.name}의 역전! ${card.name}의 수치 ×${ctx.boost}`, 'sys');
  }
  if (!was || target) card.play(ctx);
  G.grp.tg = card.scope === 'random' || card.scope === 'top' ? [...new Set(ctx.hits)] : was && target !== was ? G.last.tg : tg;
  // 공개 기록: 반응 카드는 무엇인지 숨긴다 (id null)
  (G.hist ||= []).push({ n: G.last.n, by: uid, id: G.last.id, tg: G.grp.tg, r: G.round });
  G.grp = null;
  if (card.type === 'atk') p.atkCount++;
  if (card.scope === 'random' || card.scope === 'top') {
    G.last.tg = [...new Set(ctx.hits)];
    if (G.last.tg.length) log(G, `└ ${G.last.tg.map(u => P(G, u).name).join(', ')}에게 명중`);
  }

  if (checkWin(G)) return null;
  if (!p.alive || ctx.ended) endTurn(G, uid, now);
  return null;
}

// ── 회방 ──
// 다른 사람의 턴에 몰래 쓴다. 호스트만 알고(손패·덱 장수도 그대로 보인다), 그 턴이 끝날 때 마지막에 공개·발동한다.
export function playAmbush(G, uid, cardU) {
  if (G.phase !== 'battle' || !G.cur || G.cur === uid) return '회방은 다른 사람의 턴에만 쓸 수 있어요';
  const p = P(G, uid);
  if (!p?.alive) return '탈락해서 쓸 수 없어요';
  const i = p.hand.findIndex(c => c.u === cardU);
  if (i < 0) return '손패에 없는 카드예요';
  if (!CARDS[p.hand[i].id].ambush) return '회방 카드가 아니에요';
  if (p.ambushQ?.length) return '회방은 한 턴에 한 장만 쓸 수 있어요';
  (p.ambushQ ||= []).push(p.hand.splice(i, 1)[0]);
  (G.ambush ||= []).push(uid);
  return null;
}

function resolveAmbush(G) {
  if (G.noReact || !G.ambush?.length) return;
  const order = G.ambush;
  G.ambush = [];
  for (const by of order) {
    const p = P(G, by);
    const inst = p.ambushQ?.shift();
    if (!inst) continue;
    const card = CARDS[inst.id];
    if (!card.exhaust) p.discard.push(inst);
    if (!p.alive || G.phase !== 'battle') continue;
    const cur = P(G, G.cur);
    const target = card.scope === 'one' ? (cur?.alive && cur !== p ? cur : othersOf(G, p)[0] || null) : null;
    if (card.scope === 'one' && !target) continue;
    p.enDebt = (p.enDebt || 0) + card.cost;
    const tg = targetsOf(G, p, card, target);
    log(G, `회방! ${p.name} ▶ ${card.name}${target ? ` → ${target.name}` : ''}`, 'play');
    group(G, { k: 'ambush', by, id: inst.id, t: card.type, tg });
    const ctx = makeCtx(G, p, card, target);
    if (ctx.boost > 1) fx(G, by, 'comeback', ctx.boost);
    card.play(ctx);
    G.grp.tg = card.scope === 'random' || card.scope === 'top' ? [...new Set(ctx.hits)] : tg;
    (G.hist ||= []).push({ n: ++G.lastSeq, by, id: inst.id, tg: G.grp.tg, r: G.round, amb: true });
    G.grp = null;
    if (checkWin(G)) return;
  }
}

// ── 예약 / 되돌리기 / 턴 확정 ──
// 예약한 카드를 반응 없이 가상으로 진행한 상태 (내 손패·에너지 표시용)
export function provisional(G) {
  if (!G.plan?.acts.length) return G;
  const S = clone(G);
  S.noReact = true;
  for (const a of G.plan.acts) playCard(S, G.cur, a.card, a.target, 0);
  return S;
}

export function planPlay(G, uid, cardU, targetUid, now) {
  if (G.phase !== 'battle') return '지금은 카드를 쓸 수 없어요';
  if (G.cur !== uid) return '내 턴이 아니에요';
  const S = clone(G);
  S.noReact = true;
  for (const a of G.plan.acts) playCard(S, uid, a.card, a.target, now);
  const id = S.players[uid].hand.find(c => c.u === cardU)?.id;
  const err = playCard(S, uid, cardU, targetUid, now);
  if (err) return err;
  G.plan.acts.push({ card: cardU, id, target: CARDS[id].scope === 'one' ? targetUid : null });
  // 즉시 턴이 끝나는 카드(나 안 함 등)나 내가 쓰러지는 경우는 바로 확정한다
  if (S.cur !== uid || S.phase !== 'battle') commitTurn(G, uid, now);
  return null;
}

export function undoPlan(G, uid) {
  if (G.phase !== 'battle' || G.cur !== uid) return '내 턴이 아니에요';
  if (!G.plan.acts.length) return '되돌릴 행동이 없어요';
  G.plan.acts.pop();
  return null;
}

export function commitTurn(G, uid, now, reason = '') {
  if (G.phase !== 'battle' || G.cur !== uid) return '내 턴이 아니에요';
  const acts = G.plan.acts;
  G.plan = { acts: [] };
  for (const a of acts) {
    if (G.phase !== 'battle' || G.cur !== uid) break;
    const err = playCard(G, uid, a.card, a.target, now);
    if (err) log(G, `${P(G, uid).name}의 ${CARDS[a.id]?.name || '카드'} 불발 (${err})`);
  }
  if (G.phase === 'battle' && G.cur === uid) return endTurn(G, uid, now, reason);
  return null;
}

// ── 돈: 환전 · 상점 · 거래 ──
// 모두 내 턴에 바로 적용되고 되돌릴 수 없다. 예약한 카드는 그대로 둔다.
function rollShop(G) {
  for (const u of alive(G)) P(G, u).shop = rewardOpts(G, RULES.shopSize);
}

function econTurn(G, uid) {
  if (G.phase !== 'battle' || G.cur !== uid) return '내 턴에만 할 수 있어요';
  if (!P(G, uid)?.alive) return '탈락해서 할 수 없어요';
  return null;
}
const planned = (G, u) => !!G.plan?.acts.some(a => a.card === u);
const inTrade = (G, uid, u) => G.trade?.from === uid && G.trade.give.cards.some(c => c.u === u);
const int = v => Math.max(0, Math.floor(+v || 0));

// 예약한 카드가 지금 상태에서도 모두 실행되는지 (환전으로 에너지를 빼거나 체력을 줄인 뒤)
function planStillWorks(G, uid) {
  const S = clone(G);
  S.noReact = true;
  return G.plan.acts.every(a => !playCard(S, uid, a.card, a.target, 0));
}

// 환전: from을 k묶음 주고 to를 받는다 (비율은 economy.js의 exRate)
export function exchange(G, uid, from, to, k) {
  const err = econTurn(G, uid);
  if (err) return err;
  k = int(k);
  if (!EX_NAMES[from] || !EX_NAMES[to] || from === to || k < 1 || k > 99) return '환전할 양을 다시 정해주세요';
  const p = P(G, uid);
  const r = exRate(from, to);
  const give = r.give * k, get = r.get * k;
  if (from === 'hp' && p.hp - give < 1) return '체력이 1보다 적어지게 환전할 수는 없어요';
  if (from === 'gold' && p.gold < give) return '돈이 부족해요';
  if (from === 'en' && provisional(G).players[uid].energy < give) return '남은 에너지가 부족해요';
  if (to === 'hp' && p.hp + get > p.maxHp) return `체력은 최대 ${p.maxHp}까지예요`;
  if (to === 'en' && p.exEn + get > RULES.exEnergyMax) return `환전으로 얻는 에너지는 한 턴에 ${RULES.exEnergyMax}까지예요`;
  const key = { hp: 'hp', en: 'energy', gold: 'gold' };
  const apply = s => {
    p[key[from]] -= s * give;
    p[key[to]] += s * get;
    if (to === 'en') p.exEn += s * get;
  };
  apply(1);
  if (!planStillWorks(G, uid)) { apply(-1); return '예약한 카드를 쓸 수 없게 돼요'; }
  fx(G, uid, 'gimmick', `${EX_NAMES[from]} -${give} → ${EX_NAMES[to]} +${get}`, { kind: 'mixed' });
  log(G, `${p.name} 환전: ${EX_NAMES[from]} ${give} → ${EX_NAMES[to]} ${get}`);
  return null;
}

// 상점에서 산 카드는 바로 손으로 온다 (이번 턴에 쓸 수 있다). 손이 꽉 찼으면 버린 더미로.
export function buyCard(G, uid, id) {
  const err = econTurn(G, uid);
  if (err) return err;
  const p = P(G, uid);
  const i = p.shop.indexOf(id);
  if (i < 0) return '상점에 없는 카드예요';
  const cost = buyPrice(id);
  if (p.gold < cost) return '돈이 부족해요';
  p.gold -= cost;
  p.shop.splice(i, 1);
  addCards(G, p, id, 1, 'hand');
  fx(G, uid, 'gimmick', `돈 -${cost}`, { kind: 'mixed' });
  log(G, `${p.name}, 상점에서 카드 1장 구매 (돈 ${cost})`);
  return null;
}

export function sellCard(G, uid, cardU) {
  const err = econTurn(G, uid);
  if (err) return err;
  const p = P(G, uid);
  const i = p.hand.findIndex(c => c.u === cardU);
  if (i < 0) return '손패에 없는 카드예요';
  if (planned(G, cardU)) return '예약한 카드는 팔 수 없어요';
  if (inTrade(G, uid, cardU)) return '거래에 내놓은 카드는 팔 수 없어요';
  const id = p.hand[i].id;
  if (CARDS[id].curse) return '방해 카드는 팔 수 없어요';
  if (deckOf(p).length <= RULES.sellMinDeck) return `덱이 ${RULES.sellMinDeck}장 이하라 카드를 팔 수 없어요`;
  if ((p.sellN || 0) >= RULES.sellPerTurn) return `카드는 한 턴에 ${RULES.sellPerTurn}장까지 팔 수 있어요`;
  const got = sellPrice(id);
  p.hand.splice(i, 1);
  p.gold += got;
  p.sellN = (p.sellN || 0) + 1;
  fx(G, uid, 'gimmick', `돈 +${got}`, { kind: 'buff' });
  log(G, `${p.name}, 카드 1장 판매 (돈 +${got})`);
  return null;
}

// 거래 제안: 내 카드·돈 ↔ 상대 돈 + 상대가 고른 카드 k장. 상대가 시간 안에 수락하면 바로 맞바꾼다.
export function proposeTrade(G, uid, x, now) {
  const err = econTurn(G, uid);
  if (err) return err;
  if (G.trade) return '이미 답을 기다리는 거래가 있어요';
  const p = P(G, uid);
  const t = P(G, x?.to);
  if (!t || !t.alive || t === p) return '거래할 상대를 골라주세요';
  if (p.tradeN >= RULES.tradePerTurn) return `거래 제안은 한 턴에 ${RULES.tradePerTurn}번까지예요`;
  const give = [];
  for (const u of new Set(Object.values(x.cards || {}))) {
    const c = p.hand.find(c => c.u === u);
    if (!c) return '손패에 없는 카드예요';
    if (planned(G, u)) return '예약한 카드는 거래에 내놓을 수 없어요';
    give.push({ u, id: c.id });
  }
  const gold = int(x.gold), askGold = int(x.askGold), askK = int(x.askK);
  if (gold > p.gold) return '돈이 부족해요';
  if (askK > RULES.handMax) return '받을 카드 수를 다시 정해주세요';
  if (!give.length && !gold && !askGold && !askK) return '주고받을 것을 정해주세요';
  p.tradeN++;
  G.trade = { n: (G.tradeSeq = (G.tradeSeq || 0) + 1), from: uid, to: t.uid, give: { cards: give, gold }, ask: { gold: askGold, k: askK }, deadline: now + RULES.tradeMs };
  log(G, `${p.name} → ${t.name} 거래 제안`, 'sys');
  return null;
}

function closeTrade(G, msg) {
  G.trade = null;
  log(G, msg);
}

export function cancelTrade(G, uid) {
  if (G.trade?.from !== uid) return '취소할 거래가 없어요';
  closeTrade(G, `${P(G, uid).name}, 거래 제안 취소`);
  return null;
}

export function replyTrade(G, uid, x) {
  const T = G.trade;
  if (!T || T.to !== uid || x?.n !== T.n) return '이미 끝난 거래예요';
  const p = P(G, T.from), t = P(G, uid);
  if (!x.accept) { closeTrade(G, `${t.name}, 거래 거절`); return null; }
  const pick = [...new Set(Object.values(x.cards || {}))];
  if (pick.length !== T.ask.k) return `줄 카드 ${T.ask.k}장을 골라주세요`;
  const theirs = pick.map(u => t.hand.find(c => c.u === u));
  if (theirs.some(c => !c)) return '손패에 없는 카드예요';
  if (t.gold < T.ask.gold) return '돈이 부족해요';
  const mine = T.give.cards.map(g => p.hand.find(c => c.u === g.u));
  if (p.gold < T.give.gold || mine.some(c => !c)) { closeTrade(G, '제안한 사람이 내놓은 것을 더 이상 갖고 있지 않아 거래가 취소됐다'); return null; }
  p.hand = p.hand.filter(c => !mine.includes(c));
  t.hand = t.hand.filter(c => !theirs.includes(c));
  for (const c of theirs) (p.hand.length < RULES.handMax ? p.hand : p.discard).push(c);
  for (const c of mine) (t.hand.length < RULES.handMax ? t.hand : t.discard).push(c);
  p.gold += T.ask.gold - T.give.gold;
  t.gold += T.give.gold - T.ask.gold;
  G.trade = null;
  const side = (n, g) => [n && `카드 ${n}장`, g && `돈 ${g}`].filter(Boolean).join(' + ') || '없음';
  fx(G, p.uid, 'gimmick', '거래 성사!', { kind: 'buff' });
  fx(G, t.uid, 'gimmick', '거래 성사!', { kind: 'buff' });
  log(G, `🤝 거래 성사: ${p.name}(${side(mine.length, T.give.gold)}) ↔ ${t.name}(${side(theirs.length, T.ask.gold)})`, 'sys');
  return null;
}

// ── 라운드 종료와 덱 성장 ──
function endRound(G, now) {
  if (G.round >= RULES.suddenRound) {
    const n = RULES.suddenBase + (G.round - RULES.suddenRound);
    log(G, `⚠️ 라운드 종료 피해! 전원 방어도 무시 피해 ${n}`, 'sys');
    // 전원 동시에 적용. 직전 턴의 전투 연출 끝에 붙는다.
    const a = alive(G);
    group(G, { k: 'sudden', by: null, id: null, tg: a });
    for (const u of a) hurt(G, P(G, u), n, { pierce: true });
    G.grp = null;
    if (checkWin(G)) return;
  }
  G.cur = null;
  G.phase = 'pick';
  G.pick = {};
  for (const u of alive(G)) {
    G.pick[u] = { opts: rewardOpts(G, 3), done: false };
    // 라운드 수입: 살아남은 사람에게 돈
    P(G, u).gold += RULES.roundGold;
    fx(G, u, 'gimmick', `돈 +${RULES.roundGold}`, { kind: 'buff' });
  }
  log(G, `라운드 수입: 살아남은 사람 모두 돈 +${RULES.roundGold}`);
  G.deadline = now + RULES.pickMs + delayOnce(G);
  log(G, `${G.round}라운드 종료. 카드 선택 시간!`, 'sys');
}

export function pickCard(G, uid, cardId, now) {
  const s = G.phase === 'pick' && G.pick?.[uid];
  if (!s || s.done) return '지금은 카드를 고를 수 없어요';
  if (cardId && !s.opts.includes(cardId)) return '제시된 카드가 아니에요';
  // 고른 카드는 바로 손으로 온다 (손패 상한과 상관없이)
  if (cardId) P(G, uid).hand.push(mk(G, cardId));
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

// 덱이 충분히 커진 사람에게만 카드 1장을 뺄 기회를 준다 (선택 사항)
function afterPick(G, now) {
  const who = G.round % RULES.removeEvery === 0
    ? Object.keys(G.pick).filter(u => deckOf(P(G, u)).length >= RULES.removeOfferDeck)
    : [];
  if (!who.length) return finishRound(G, now);
  G.phase = 'remove';
  G.pick = Object.fromEntries(who.map(u => [u, { done: false }]));
  G.deadline = now + RULES.pickMs;
  log(G, `덱이 ${RULES.removeOfferDeck}장 이상인 사람은 카드 1장을 뺄 수 있어요`, 'sys');
}

function finishRound(G, now) {
  G.pick = null;
  G.round++;
  G.turnIdx = -1;
  rollShop(G);
  log(G, `── ${G.round}라운드 시작 ──`, 'sys');
  if (G.round === RULES.suddenRound) log(G, '⚠️ 이번 라운드부터 회복량 절반, 라운드 종료 피해 시작', 'sys');
  nextTurn(G, now);
}

function checkWin(G) {
  if (G.phase === 'ended') return true;
  const a = alive(G);
  if (a.length > 1) return false;
  sealReplay(G);
  G.phase = 'ended';
  G.cur = null;
  G.pick = null;
  G.result = { winner: a[0] || null, draw: a.length === 0, round: G.round };
  log(G, a.length ? `🏆 ${P(G, a[0]).name} 최후의 생존자!` : '전원 탈락… 무승부!', 'sys');
  return true;
}

// 시간 초과 처리. 상태가 바뀌었으면 true.
export function tick(G, now) {
  let changed = false;
  if (G.trade && now >= G.trade.deadline) {
    closeTrade(G, `${P(G, G.trade.to).name}, 거래에 답하지 않음`);
    changed = true;
  }
  if (now < G.deadline) return changed;
  if (G.phase === 'battle') {
    commitTurn(G, G.cur, now, 'timeout');
    return true;
  }
  if (G.phase === 'pick' || G.phase === 'remove') {
    for (const s of Object.values(G.pick)) s.done = true;
    if (G.phase === 'pick') afterPick(G, now);
    else finishRound(G, now);
    return true;
  }
  return changed;
}

const deckOf = p => [...p.draw, ...p.discard, ...p.hand, ...(p.ambushQ || [])];
const byCard = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// ── 공개 정보 / 개인 정보 ──
export function publicView(G) {
  const players = {};
  for (const [u, p] of Object.entries(G.players)) {
    players[u] = {
      name: p.name, hp: p.hp, maxHp: p.maxHp, block: p.block, energy: p.energy, alive: p.alive,
      react: !!p.react, hand: p.hand.length + (p.ambushQ?.length || 0), draw: p.draw.length, discard: p.discard.length,
      char: p.char, deck: deckOf(p).length, enPen: p.enPen, enBonus: p.enBonus || 0, enCap: p.enCap || 0,
      st: p.st.hush ? { hush: p.st.hush } : p.st, stHidden: !!p.st.hush, keepBlock: p.keepBlock, out: p.out, stats: p.stats,
      gold: p.gold || 0,
    };
  }
  const sudden = G.round >= RULES.suddenRound;
  return {
    gameId: G.gameId, round: G.round, turnNo: G.turnNo, cur: G.cur, phase: G.phase,
    deadline: G.deadline, order: G.order, players, log: G.log, fx: G.fx, last: G.last,
    elim: G.elim, result: G.result, startedAt: G.startedAt, replay: G.replay, hist: (G.hist || []).slice(-80),
    plan: G.plan?.acts.length ? { by: G.cur, n: G.plan.acts.length } : null,
    pick: G.pick ? Object.fromEntries(Object.entries(G.pick).map(([u, s]) => [u, s.done])) : null,
    suddenDmg: sudden ? RULES.suddenBase + (G.round - RULES.suddenRound) : null,
    // 거래 제안은 누가 누구에게 하는지와 양만 공개한다. 카드 내용은 두 사람에게만.
    trade: G.trade ? { n: G.trade.n, from: G.trade.from, to: G.trade.to, cards: G.trade.give.cards.length, gold: G.trade.give.gold, askGold: G.trade.ask.gold, askK: G.trade.ask.k, deadline: G.trade.deadline } : null,
  };
}

// prov: provisional(G). 턴 중인 사람은 예약을 반영한 손패·에너지를 본다.
export function privateView(G, uid, prov = G) {
  const mine = uid === G.cur;
  const p = (mine ? prov : G).players[uid];
  const s = G.pick?.[uid];
  return {
    gameId: G.gameId,
    hand: p.hand,
    energy: p.energy,
    st: p.st,
    plan: mine ? G.plan.acts.map(a => ({ id: a.id, target: a.target })) : [],
    ambush: (p.ambushQ || []).map(c => c.id),
    react: p.react,
    plays: p.plays,
    atkCount: p.atkCount,
    recent: p.atkRecent.length,
    deck: deckOf(p).sort(byCard),
    pick: s ? { stage: G.phase, opts: s.opts || null, done: s.done } : null,
    ack: G.ack[uid] || null,
    gold: G.players[uid].gold || 0,
    shop: G.players[uid].shop || [],
    exEn: G.players[uid].exEn || 0,
    tradeN: G.players[uid].tradeN || 0,
    sellN: G.players[uid].sellN || 0,
    trade: G.trade && (G.trade.from === uid || G.trade.to === uid) ? G.trade : null,
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
  if (['play', 'undo', 'end', 'exchange', 'buy', 'sell', 'trade', 'tradeCancel'].includes(r.type) && r.turnNo !== G.turnNo) err = '이미 지나간 턴의 요청이에요';
  else if (r.type === 'play') err = planPlay(G, uid, r.card, r.target, now);
  else if (r.type === 'undo') err = undoPlan(G, uid);
  else if (r.type === 'end') err = commitTurn(G, uid, now);
  else if (r.type === 'ambush') err = r.turnNo !== G.turnNo ? '이미 지나간 턴이에요' : playAmbush(G, uid, r.card);
  else if (r.type === 'pick') err = pickCard(G, uid, r.card || null, now);
  else if (r.type === 'remove') err = removeCard(G, uid, r.card || null, now);
  else if (r.type === 'exchange') err = exchange(G, uid, r.x?.from, r.x?.to, r.x?.k);
  else if (r.type === 'buy') err = buyCard(G, uid, r.card);
  else if (r.type === 'sell') err = sellCard(G, uid, r.card);
  else if (r.type === 'trade') err = proposeTrade(G, uid, r.x || {}, now);
  else if (r.type === 'tradeCancel') err = cancelTrade(G, uid);
  else if (r.type === 'tradeReply') err = replyTrade(G, uid, r.x || {});
  else err = '알 수 없는 요청';
  G.ack[uid] = { id: reqId, err };
  return true;
}
