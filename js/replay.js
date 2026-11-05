// 턴 종료 전투 연출. 필드에 서 있는 캐릭터들이 엔진이 기록한 replay.plays(카드 묶음과 그 안의 효과 fx)대로 직접 싸운다.
// 건너뛸 수 없다. 기본 1배속이고, 카드가 많으면 정해진 시간(replayMs) 안에 끝나도록 빨라진다.
// 연출: 레터박스·비네트, 카드마다 컷인, 카메라(사용자 줌인 → 대상 추적 → 복귀), 히트스톱·집중선, 연타 카운터, 치명타 임팩트 프레임, 턴 합계.
// 공격 동작은 캐릭터의 공격 모션(data-attack)마다 다르다:
//   dash 잔상 질주 + 초승달 베기 / hop 포물선 도약 + 내려찍기(균열·충격파) / punch 파고들기 + 별 타격광 / cast 마법진 + 기 모으기 + 에너지탄
import { CARDS, CURSE } from './cards.js';
import { cardName } from './editor.js';
import { cardHTML, hiddenCardHTML } from './view.js';
import { replayMs } from './engine.js';
import * as V from './vfx.js';
import { sfx } from './sfx.js';
import { createMotion } from './motion.js';

const STEP = { dmg: 440, ko: 1600, comeback: 620, trigger: 440, block: 300, heal: 340, react: 320, nullify: 280, strip: 280, unreact: 280, debuff: 280, gimmick: 300 };
const CARD_MS = 1050; // 카드 컷인 시간
const CRIT = 10;      // 이 피해부터 치명타 연출
const TOTAL_MS = 750; // 마지막 턴 합계
const TYPE_NAME = { atk: '공격', def: '방어', skill: '기술', react: '반응', curse: '저주' };
const CAM_MS = 280;   // 카메라 이동
const STYLE = {      // 공격 모션별 색
  dash: { c: '#9fe8ff', tint: 'cyan' }, hop: { c: '#ffb15c', tint: 'amber' },
  punch: { c: '#ffd23f', tint: 'amber' }, cast: { c: '#c3a6ff', tint: 'violet' },
};
const groupMs = g => CARD_MS + 140 + (g.by ? CAM_MS * 2 : 0) + (g.t === 'atk' ? 420 : 0)
  + g.fx.reduce((a, f) => a + (STEP[f.k] || 260) + (f.k === 'dmg' && f.v >= CRIT ? 380 : 0), 0) + 240;

export function playReplay(rep, { field, shakeEl, players, nameOf }) {
  let done;
  const finished = new Promise(r => { done = r; });
  let stopped = false;
  const natural = rep.plays.reduce((a, g) => a + groupMs(g), 0) + TOTAL_MS;
  const speed = Math.min(1, Math.max(.12, (replayMs(rep.plays) - 150) / natural));
  let hits = { n: 0, dmg: 0 }, turnDmg = 0;
  const motion = createMotion({ speed });
  const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const wait = ms => (stopped ? Promise.resolve() : new Promise(r => setTimeout(r, ms * speed)));

  const F = u => field.querySelector(`.fighter[data-u="${u}"]`);

  // ── 카메라: 필드 전체를 옮기고 확대한다 (가운데 기준). 위치를 재기 전에는 이동이 끝나기를 기다린다 ──
  const cam = { tx: 0, ty: 0, s: 1, anim: null };
  const camTo = (pt, s = 1, ms = CAM_MS) => {
    if (stopped || reduced()) return Promise.resolve();
    const r = field.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // pt를 화면 가운데 쪽으로 절반쯤 끌어온다
    const L = pt ? { x: (pt.x - cx) / cam.s, y: (pt.y - cy) / cam.s } : { x: 0, y: 0 };
    const to = { tx: -s * L.x * .5, ty: -s * L.y * .35, s };
    const prev = cam.anim;
    cam.anim = field.animate([
      { transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})` },
      { transform: `translate(${to.tx}px, ${to.ty}px) scale(${to.s})` },
    ], { duration: Math.max(1, ms * speed), easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    prev?.cancel();
    Object.assign(cam, to);
    return cam.anim.finished.catch(() => {});
  };
  // 맞는 순간 그 점을 중심으로 잠깐 더 확대 (카메라 위에 더해진다)
  const camPunch = (pt, amount, ms) => {
    if (stopped || reduced()) return;
    const r = field.getBoundingClientRect();
    const lx = (pt.x - (r.left + r.width / 2)) / cam.s, ly = (pt.y - (r.top + r.height / 2)) / cam.s;
    field.animate([{ transform: 'translate(0, 0)' },
      { transform: `translate(${lx}px, ${ly}px) scale(${amount}) translate(${-lx}px, ${-ly}px)`, offset: .25 },
      { transform: 'translate(0, 0)' }], { duration: ms, easing: 'cubic-bezier(.3,0,.3,1)', composite: 'add' });
  };
  const mid = (a, b) => { const p = center(a), q = center(b); return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }; };
  const styleOf = el => STYLE[el?.dataset.attack] ? el.dataset.attack : 'punch';
  // 스쿼시 앤 스트레치: 웅크렸다가 튀어나간다
  const squash = el => {
    if (reduced()) return;
    el.querySelector('.f-body')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14, .84)', offset: .45 }, { transform: 'scale(.9, 1.12)', offset: .75 }, { transform: 'scale(1)' }],
      { duration: 260 * speed + 40, easing: 'ease-out' });
  };
  const center = el => {
    const r = (el.querySelector('.f-body') || el).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * .45, r };
  };
  const setHp = (u, h) => {
    const el = F(u);
    if (!el) return;
    const max = players[u]?.maxHp || 40;
    el.querySelector('.f-hp i').style.width = `${Math.max(0, (h / max) * 100)}%`;
    el.querySelector('.f-hp span').textContent = `${Math.max(0, h)}/${max}`;
    el.querySelector('.f-hp').classList.toggle('low', h / max <= .3);
  };
  const moveTo = (el, x, y, ms, easing = 'ease-out') => {
    if (stopped) return Promise.resolve();
    if (reduced()) { x = 0; y = 0; }
    const from = el._off || { x: 0, y: 0 };
    el._off = { x, y };
    return el.animate([{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: `translate(${x}px, ${y}px)` }],
      { duration: Math.max(1, ms * speed), easing, fill: 'forwards' }).finished.catch(() => {});
  };
  const lunge = async (a, b) => {
    const ca = center(a), cb = center(b);
    const dir = Math.sign(cb.x - ca.x) || 1;
    const st = styleOf(a), col = STYLE[st].c;
    a.style.zIndex = 5;
    squash(a);
    if (st === 'cast') {
      // 마법진을 펼치고 기를 모았다가 에너지탄을 쏜다
      V.magicCircle(ca.x, ca.r.bottom - 6, ca.r.width * 1.5, { color: col, ms: 1000 * speed + 200 });
      V.rays(ca.x, ca.y, { n: 22, colors: [col, '#fff'], r0: 170, r1: 16, len: 40, size: 2, life: 280 * speed + 80 });
      sfx.react();
      await wait(240);
      if (stopped) return;
      motion.play(a, 'attack');
      sfx.zap();
      V.flare(ca.x + dir * ca.r.width * .35, ca.y, { color: col, size: 50 });
      await V.projectile(ca.x + dir * ca.r.width * .35, ca.y, cb.x, cb.y, { color: col, size: 22, ms: 300 * speed + 40, arc: 50 });
      return;
    }
    await wait(90); // 웅크리는 틈
    if (stopped) return;
    motion.play(a, 'attack');
    const dx = (cb.x - ca.x - dir * cb.r.width * .8) / cam.s, dy = ((cb.r.bottom - ca.r.bottom) * .5) / cam.s;
    V.puff(ca.x, ca.r.bottom - 10);
    if (st === 'hop') {
      // 포물선으로 뛰어올라 내려찍는다
      sfx.whoosh();
      const from = a._off || { x: 0, y: 0 };
      a._off = { x: dx, y: dy };
      const peak = -Math.max(90, ca.r.height * .9) / cam.s;
      const T = 380 * speed + 40;
      const trail = setInterval(() => V.afterimage(a, { tint: STYLE[st].tint }), 60);
      await a.animate(reduced() ? [{ transform: 'none' }, { transform: 'none' }] : [
        { transform: `translate(${from.x}px, ${from.y}px)` },
        { transform: `translate(${(from.x + dx) / 2}px, ${Math.min(from.y, dy) + peak}px)`, offset: .45, easing: 'cubic-bezier(.2,0,.6,1)' },
        { transform: `translate(${dx}px, ${dy}px)` },
      ], { duration: T, easing: 'cubic-bezier(.4,0,.8,.4)', fill: 'forwards' }).finished.catch(() => {});
      clearInterval(trail);
      if (stopped) return;
      const ground = cb.r.bottom - 8;
      V.cracks(cb.x, ground, { len: 130 });
      V.shockwave(cb.x, ground, { w: cb.r.width * 3.2 });
      V.puff(cb.x - 30, ground, { color: 'rgba(220,200,170,.55)', n: 10 });
      V.puff(cb.x + 30, ground, { color: 'rgba(220,200,170,.55)', n: 10 });
      V.shake(shakeEl, 14, 320);
      sfx.slam();
      return;
    }
    // 돌진·주먹: 잔상을 남기며 파고든다 (주먹은 짧게)
    sfx.dash();
    sfx.whoosh();
    V.streak(ca.x, ca.y, cb.x, cb.y, { color: st === 'dash' ? 'rgba(160,235,255,.85)' : 'rgba(255,230,150,.8)' });
    const trail = setInterval(() => V.afterimage(a, { tint: STYLE[st].tint }), st === 'dash' ? 30 : 55);
    await moveTo(a, dx, dy, st === 'dash' ? 190 : 230, 'cubic-bezier(.5,0,.9,.4)');
    clearInterval(trail);
  };
  const retreat = async a => {
    if (!a) return;
    a.classList.remove('atk');
    await moveTo(a, 0, 0, 220);
    a.style.zIndex = '';
  };
  const knock = (el, dir, power) => {
    motion.play(el, 'hit', { power, direction: dir * (el.classList.contains('r') ? -1 : 1) });
    if (reduced()) return;
    const o = el._off || { x: 0, y: 0 };
    if (power < .55) {
      el.animate([{ transform: `translate(${o.x}px,${o.y}px)` }, { transform: `translate(${o.x + dir * (8 + power * 26)}px,${o.y}px)` }, { transform: `translate(${o.x}px,${o.y}px)` }],
        { duration: 260 * speed + 60, easing: 'ease-out' });
      return;
    }
    // 큰 피해: 회전하며 붕 떴다가 튕겨 돌아온다
    const fx = o.x + dir * (30 + power * 70), fy = o.y - power * 46;
    el.animate([
      { transform: `translate(${o.x}px,${o.y}px) rotate(0deg)` },
      { transform: `translate(${fx}px,${fy}px) rotate(${dir * power * 16}deg)`, offset: .35, easing: 'cubic-bezier(.2,.8,.4,1)' },
      { transform: `translate(${fx + dir * 8}px,${o.y}px) rotate(${dir * 4}deg)`, offset: .62, easing: 'cubic-bezier(.6,0,1,.6)' },
      { transform: `translate(${o.x + dir * 6}px,${o.y - 10}px) rotate(0deg)`, offset: .8 },
      { transform: `translate(${o.x}px,${o.y}px) rotate(0deg)` },
    ], { duration: 640 * speed + 120 });
  };

  const hitFx = (f, srcEl) => {
    if (stopped) return;
    const el = F(f.u);
    if (!el) return;
    const { x, y, r } = center(el);
    const dir = srcEl ? Math.sign(x - center(srcEl).x) || 1 : 1;
    if (f.v > 0) {
      const crit = f.v >= CRIT;
      const st = srcEl ? styleOf(srcEl) : null, col = st ? STYLE[st].c : '#fff', power = Math.min(1, f.v / 14);
      if (st === 'dash') {
        V.crescent(x, y, { color: col, r: 60 + power * 50, size: 10 + power * 10, dir });
        if (power > .4) V.crescent(x, y, { color: '#fff', r: 46 + power * 40, size: 6, dir: -dir, ang: Math.random() * 2 - 1 });
        sfx.slash();
      } else if (st === 'punch') {
        V.flare(x, y, { color: col, size: 60 + power * 70 });
      } else if (st === 'cast') {
        V.flare(x, y, { color: col, size: 80 + power * 70 });
        V.ring(x, y, { color: col, r1: 80 + power * 100, w: 10 });
        V.burst(x, y, { colors: [col, '#fff'], n: 18 + f.v * 2, speed: 10, kind: 'dot', g: .1 });
      } else if (st === 'hop' && power > .5) {
        V.cracks(x, r.bottom - 8, { n: 4, len: 80 });
      }
      // 히트스톱: 맞는 순간 하얀 실루엣
      el.querySelector('.f-body')?.animate([{ filter: 'brightness(5) saturate(0)' }, { filter: 'brightness(5) saturate(0)', offset: .4 }, { filter: 'none' }], { duration: 150 + f.v * 8 });
      V.impact(x, y, f.v);
      V.rays(x, y, { n: 12 + f.v * 2, colors: crit ? ['#fff', '#ffd23f', '#ff3b5c'] : ['#fff', '#ffe2b0'], r1: 50 + f.v * 3, life: 300 + f.v * 12 });
      camPunch({ x, y }, 1.04 + Math.min(.1, f.v * .008), 240 + f.v * 12);
      V.shake(shakeEl, Math.min(26, 5 + f.v * 1.3), 280 + f.v * 14);
      V.text(x, y - 40, `-${f.v}`, `f-dmg ${crit ? 'big' : ''}`);
      knock(el, dir, Math.min(1, f.v / 14));
      sfx.hit(f.v);
      if (crit && !hits.crit) {
        hits.crit = true; // 광역 공격이어도 카드 한 장에 한 번만
        V.impactFrame(90);
        V.bigWord('CRITICAL!', 'crit', 900);
        V.flash('rgba(255,255,255,.5)', 220);
        V.shards(x, y, { n: 14, size: 7, colors: ['#ffd23f', '#fff'] });
        sfx.crit();
      }
      hits.n++;
      hits.dmg += f.v;
      turnDmg += f.v;
      if (hits.n > 1) V.combo(hits.n, hits.dmg);
    } else {
      motion.play(el, 'guard');
      V.ring(x, y, { color: '#7cc4ff', r1: 70, w: 8 });
      V.burst(x, y, { colors: ['#7cc4ff', '#fff'], n: 12, speed: 6 });
      V.text(x, y - 40, '막음!', 'f-block');
      sfx.blocked();
    }
    if (f.b > 0 && f.v > 0) V.text(x + 34, y - 10, `🛡${f.b}`, 'f-block small');
    if (f.h != null) setHp(f.u, f.h);
  };

  // 카드 배너: 사용한 캐릭터 머리 위에 띄운다
  const banner = document.createElement('div');
  banner.className = 'field-banner';
  field.appendChild(banner);
  const title = document.createElement('div');
  title.className = 'field-title';
  title.innerHTML = `<span class="lbl amber">TURN RESOLVE</span><b></b>`;
  title.querySelector('b').textContent = rep.start ? `${nameOf(rep.by)}의 턴 시작` : rep.by ? `${nameOf(rep.by)}의 턴 결과` : '라운드 종료';
  field.appendChild(title);
  field.classList.add('replaying');

  const showBanner = (g, actorEl) => {
    const fr = field.getBoundingClientRect();
    const x = actorEl ? center(actorEl).x - fr.left : fr.width / 2;
    const left = Math.min(fr.width - 70, Math.max(70, x));
    const T = CARD_MS * speed;
    if (g.k === 'card' || g.k === 'curse') {
      // 화면을 가로지르는 컷인을 보여준 뒤, 사용한 캐릭터 머리 위에 카드를 작게 남긴다
      const id = g.k === 'curse' ? g.id || CURSE : g.id;
      const c = id && CARDS[id];
      V.cutIn({
        art: c ? `img/cards/${c.photo}.webp` : null,
        name: c ? cardName(id) : '반응 카드',
        sub: `${g.by ? nameOf(g.by) : ''} · ${c ? `${TYPE_NAME[c.type]} 카드` : '숨겨진 카드'}`,
        type: c?.type || 'react',
        rarity: c?.rarity,
        flip: !!actorEl?.classList.contains('r'),
        ms: T * .8,
      });
      sfx.cutin();
      banner.innerHTML = c ? cardHTML(id, { act: '', size: 'mid' }) : hiddenCardHTML('mid');
      banner.style.left = `${left}px`;
      banner.animate([
        { transform: 'translate(-50%, -30%) scale(.3)', opacity: 0, offset: 0 },
        { transform: 'translate(-50%, -30%) scale(.3)', opacity: 0, offset: .74 },
        { transform: 'translate(-50%, 0) scale(1.15)', opacity: 1, offset: .88 },
        { transform: 'translate(-50%, 0) scale(1)', opacity: 1, offset: 1 },
      ], { duration: T, easing: 'cubic-bezier(.3,1.4,.4,1)', fill: 'forwards' });
      return;
    }
    if (g.k === 'sudden') banner.innerHTML = '<div class="sudden-banner">라운드 종료 피해</div>';
    else if (g.k === 'start') banner.innerHTML = `<div class="sudden-banner start">${nameOf(g.by)}의 턴 시작 효과</div>`;
    banner.style.left = `${left}px`;
    // 필드 가운데에서 크게 튀어나왔다가, 잠깐 보여준 뒤 사용한 캐릭터 머리 위로 작아지며 이동
    const dx = fr.width / 2 - left;
    const big = Math.min(1.9, (fr.height * .92) / Math.max(1, banner.getBoundingClientRect().height || 1));
    banner.animate([
      { transform: `translate(calc(-50% + ${dx}px), 10%) scale(${big * .6})`, opacity: 0, offset: 0 },
      { transform: `translate(calc(-50% + ${dx}px), 0) scale(${big})`, opacity: 1, offset: .16 },
      { transform: `translate(calc(-50% + ${dx}px), 0) scale(${big})`, opacity: 1, offset: .78 },
      { transform: 'translate(-50%, 0) scale(1)', opacity: 1, offset: 1 },
    ], { duration: T, easing: 'cubic-bezier(.3,1.2,.4,1)', fill: 'forwards' });
    sfx.card();
  };

  async function runGroup(g) {
    const actor = g.by;
    const A = actor && F(actor);
    hits = { n: 0, dmg: 0 };
    const lit = new Set([actor, ...g.fx.flatMap(f => [f.u, f.s])].filter(Boolean));
    field.classList.add('focusing');
    for (const el of field.querySelectorAll('.fighter')) el.classList.toggle('lit', g.k === 'sudden' || lit.has(el.dataset.u));
    showBanner(g, A);
    await wait(CARD_MS * .72);
    if (stopped) return;
    // 컷인이 빠지는 동안 카드를 쓴 캐릭터에게 줌인
    if (A) camTo(center(A), 1.16);
    await wait(CARD_MS * .28 + 60);
    if (stopped) return;
    if (A && g.k === 'card' && g.t !== 'atk') {
      motion.play(A, g.t === 'def' ? 'guard' : 'cast');
      const c = center(A);
      squash(A);
      V.magicCircle(c.x, c.r.bottom - 6, c.r.width * 1.4, { color: { def: '#7cc4ff', skill: '#6ef0a0', react: '#ffd23f' }[g.t] || '#c3a6ff', ms: 900 * speed + 200 });
    }
    let near = null;
    for (const f of g.fx) {
      if (stopped) return;
      const el = F(f.u);
      if (!el) continue;
      const { x, y } = center(el);
      switch (f.k) {
        case 'dmg':
          if (A && f.s === actor && f.u !== actor) {
            if (near !== f.u) { await camTo(mid(A, el), 1.1, 220); await lunge(A, el); near = f.u; }
            else { motion.play(A, 'attack'); await wait(210); }
            if (stopped) return;
            if (f.v >= CRIT) await wait(180); // 치명타 직전 정지
            hitFx(f, A);
            await wait(STEP.dmg + (f.v >= CRIT ? 200 : 0));
          } else if (A && f.u === actor && f.s && f.s !== actor) {
            // 반격: 맞은 쪽이 되받아친다
            await retreat(A);
            near = null;
            const C = F(f.s);
            if (C) { await camTo(mid(C, A), 1.1, 200); await lunge(C, A); if (stopped) return; hitFx(f, C); await wait(STEP.dmg); await retreat(C); }
            else { hitFx(f, null); await wait(STEP.dmg); }
          } else {
            if (f.u === actor) { await retreat(A); near = null; }
            if (!f.s) V.slash(x, y - 80, { color: '#b197fc', len: 200, ang: Math.PI / 2, size: 10 });
            hitFx(f, null);
            await wait(STEP.dmg);
          }
          break;
        case 'ko':
          camTo({ x, y }, 1.24, 200);
          motion.play(el, 'down');
          el.classList.add('down');
          V.impactFrame(130);
          V.shards(x, y);
          V.rays(x, y, { n: 40, colors: ['#ff3b5c', '#fff'], life: 500 });
          field.classList.add('ko-moment');
          setTimeout(() => field.classList.remove('ko-moment'), STEP.ko * speed);
          V.eliminated(nameOf(f.u), x, y);
          V.shake(shakeEl, 26, 600);
          sfx.ko();
          await wait(STEP.ko);
          break;
        case 'block':
          motion.play(el, 'guard');
          V.dome(x, y + 6, center(el).r.width * 1.25, { ms: 700 * speed + 200 });
          V.ring(x, y, { color: '#4dabf7', r0: 30, r1: 80, w: 10, life: 500 });
          V.rays(x, y, { n: 18, colors: ['#7cc4ff', '#fff'], r0: 220, r1: 40, len: 50, life: 320 });
          V.text(x, y - 50, `🛡+${f.v}`, 'f-block');
          sfx.shield();
          await wait(STEP.block);
          break;
        case 'heal':
          motion.play(el, 'heal');
          V.pillar(x, center(el).r.bottom, center(el).r.width * .7, { ms: 800 * speed + 200 });
          V.sparkle(x, y, { n: 26, spread: 70 });
          V.ring(x, y + 30, { color: '#6ef0a0', r0: 10, r1: 90, w: 6, life: 600 });
          V.text(x, y - 50, `+${f.v}`, 'f-heal');
          if (f.h != null) setHp(f.u, f.h);
          sfx.heal();
          await wait(STEP.heal);
          break;
        case 'react':
          motion.play(el, 'cast');
          V.ring(x, y + 40, { color: '#b197fc', r0: 10, r1: 70, w: 5, life: 600 });
          V.sparkle(x, y, { colors: ['#b197fc', '#e0d2ff'] });
          V.text(x, y - 50, '❔ 반응 설치', 'f-react');
          sfx.react();
          await wait(STEP.react);
          break;
        case 'comeback':
          // 역전 발동: 금빛 번쩍임과 함께 카드가 강해진다
          camTo({ x, y }, 1.2, 180);
          V.flash('rgba(255,210,63,.45)', 260);
          V.rays(x, y, { n: 36, colors: ['#ffd23f', '#fff'], r1: 40, life: 420 });
          V.ring(x, y, { color: '#ffd23f', r1: 160, w: 12, life: 600 });
          V.bigWord(`역전! ×${f.v}`, 'crit comeback', 1000);
          V.text(x, y - 70, `역전 ×${f.v}`, 'f-trigger');
          motion.play(el, 'cast');
          sfx.crit();
          await wait(STEP.comeback);
          break;
        case 'trigger':
          motion.play(el, 'cast');
          V.flash('rgba(177,151,252,.35)', 200);
          V.ring(x, y, { color: '#b197fc', r1: 120, w: 10 });
          V.text(x, y - 70, `⚡ ${f.v}!`, 'f-trigger');
          sfx.trigger();
          await wait(STEP.trigger);
          break;
        case 'nullify':
          motion.play(el, 'guard');
          V.ring(x, y, { color: '#e0d2ff', r1: 90, w: 8 });
          V.text(x, y - 40, '무효!', 'f-react');
          sfx.blocked();
          await wait(STEP.nullify);
          break;
        case 'strip':
        case 'unreact':
          V.burst(x, y, { colors: ['#9fd3ff', '#fff'], n: 18, speed: 8, kind: 'dot' });
          V.text(x, y - 40, f.k === 'strip' ? '방어도 파괴!' : '반응 무력화!', 'f-react');
          sfx.blocked();
          await wait(STEP.strip);
          break;
        case 'debuff':
          motion.play(el, 'hit', { power: .1 });
          V.puff(x, y - 20, { color: 'rgba(170,120,255,.45)' });
          V.text(x, y - 50, f.v, 'f-debuff');
          sfx.debuff();
          await wait(STEP.debuff);
          break;
        case 'gimmick': {
          motion.play(el, f.kind === 'debuff' ? 'hit' : 'cast', { power: .1 });
          const col = { buff: ['#7fd6ff', '#e6f6ff'], debuff: ['#ff7a7a', '#ffd0d0'], mixed: ['#ffd23f', '#fff3c2'] }[f.kind] || ['#fff'];
          V.ring(x, y + 30, { color: col[0], r0: 12, r1: 60, w: 4, life: 500 });
          V.sparkle(x, y, { colors: col, n: 10 });
          V.text(x, y - 60, f.v, `f-gimmick g-${f.kind || 'buff'}`);
          (f.kind === 'debuff' ? sfx.debuff : sfx.react)();
          // 이름표의 기믹 칩도 바로 맞춰 보여준다
          await wait(STEP.gimmick);
          break;
        }
      }
    }
    await Promise.all([retreat(A), camTo(null, 1)]);
    V.comboEnd();
    for (const el of field.querySelectorAll('.fighter.lit')) el.classList.remove('lit');
    field.classList.remove('focusing');
    await wait(160);
  }

  const close = () => {
    if (stopped) return;
    stopped = true;
    motion.stop();
    banner.remove();
    title.remove();
    V.cinema(false);
    V.comboEnd();
    field.classList.remove('replaying', 'focusing', 'ko-moment');
    field.getAnimations().forEach(a => a.cancel());
    for (const el of field.querySelectorAll('.fighter')) {
      el.getAnimations().forEach(a => a.cancel());
      el._off = null;
      el.style.zIndex = '';
      el.classList.remove('atk', 'hit', 'guard', 'lit');
    }
    done();
  };

  (async () => {
    V.cinema(true);
    await wait(200);
    for (const g of rep.plays) {
      if (stopped) break;
      await runGroup(g);
    }
    // 이번 턴에 준 피해 합계
    if (!stopped && turnDmg > 0 && rep.plays.length > 1) {
      V.bigWord(`TOTAL ${turnDmg}`, 'total', TOTAL_MS * speed + 150);
      sfx.trigger();
      await wait(TOTAL_MS);
    }
    await wait(250);
    close();
  })();

  // stop: 호스트가 게임을 끝내는 등 화면이 바뀔 때만 쓴다 (건너뛰기 버튼은 없다)
  return { finished, stop: close };
}
