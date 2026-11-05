// 턴 종료 전투 연출. 필드에 서 있는 캐릭터들이 엔진이 기록한 replay.plays(카드 묶음과 그 안의 효과 fx)대로 직접 싸운다.
// 건너뛸 수 없다. 기본 1배속이고, 카드가 많으면 정해진 시간(replayMs) 안에 끝나도록 빨라진다.
// 연출: 레터박스·비네트, 카드마다 컷인, 대시 잔상, 히트스톱·카메라 펀치·집중선, 연타 카운터, 치명타 임팩트 프레임, 턴 합계.
import { CARDS, CURSE } from './cards.js';
import { cardName } from './editor.js';
import { cardHTML, hiddenCardHTML } from './view.js';
import { replayMs } from './engine.js';
import * as V from './vfx.js';
import { sfx } from './sfx.js';
import { createMotion } from './motion.js';

const STEP = { dmg: 440, ko: 1600, trigger: 440, block: 300, heal: 340, react: 320, nullify: 280, strip: 280, unreact: 280, debuff: 280, gimmick: 300 };
const CARD_MS = 1050; // 카드 컷인 시간
const CRIT = 10;      // 이 피해부터 치명타 연출
const TOTAL_MS = 750; // 마지막 턴 합계
const TYPE_NAME = { atk: '공격', def: '방어', skill: '기술', react: '반응', curse: '저주' };
const groupMs = g => CARD_MS + 140 + g.fx.reduce((a, f) => a + (STEP[f.k] || 260) + (f.k === 'dmg' && f.v >= CRIT ? 380 : 0), 0) + 240;

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
    motion.play(a, 'attack');
    a.style.zIndex = 5;
    if (a.dataset.attack === 'cast') {
      await wait(210); // 공격 시트의 세 번째(명중) 프레임
      return;
    }
    sfx.dash();
    sfx.whoosh();
    V.puff(ca.x, ca.r.bottom - 10);
    V.streak(ca.x, ca.y, cb.x, cb.y);
    await moveTo(a, cb.x - ca.x - dir * cb.r.width * .8, (cb.r.bottom - ca.r.bottom) * .5, 210, 'cubic-bezier(.5,0,.9,.4)');
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
    el.animate([{ transform: `translate(${o.x}px,${o.y}px)` }, { transform: `translate(${o.x + dir * (8 + power * 22)}px,${o.y}px)` }, { transform: `translate(${o.x}px,${o.y}px)` }],
      { duration: 260 * speed + 60, easing: 'ease-out' });
  };

  const hitFx = (f, srcEl) => {
    if (stopped) return;
    const el = F(f.u);
    if (!el) return;
    const { x, y } = center(el);
    const dir = srcEl ? Math.sign(x - center(srcEl).x) || 1 : 1;
    if (f.v > 0) {
      const crit = f.v >= CRIT;
      // 히트스톱: 맞는 순간 하얀 실루엣
      el.querySelector('.f-body')?.animate([{ filter: 'brightness(5) saturate(0)' }, { filter: 'brightness(5) saturate(0)', offset: .4 }, { filter: 'none' }], { duration: 150 + f.v * 8 });
      V.impact(x, y, f.v);
      V.rays(x, y, { n: 12 + f.v * 2, colors: crit ? ['#fff', '#ffd23f', '#ff3b5c'] : ['#fff', '#ffe2b0'], r1: 50 + f.v * 3, life: 300 + f.v * 12 });
      V.camera(field, x, y, 1.03 + Math.min(.1, f.v * .007), 260 + f.v * 12);
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
    await wait(CARD_MS + 60);
    if (stopped) return;
    if (A && g.k === 'card' && g.t !== 'atk') motion.play(A, g.t === 'def' ? 'guard' : 'cast');
    let near = null;
    for (const f of g.fx) {
      if (stopped) return;
      const el = F(f.u);
      if (!el) continue;
      const { x, y } = center(el);
      switch (f.k) {
        case 'dmg':
          if (A && f.s === actor && f.u !== actor) {
            if (near !== f.u) { await lunge(A, el); near = f.u; }
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
            if (C) { await lunge(C, A); if (stopped) return; hitFx(f, C); await wait(STEP.dmg); await retreat(C); }
            else { hitFx(f, null); await wait(STEP.dmg); }
          } else {
            if (f.u === actor) { await retreat(A); near = null; }
            if (!f.s) V.slash(x, y - 80, { color: '#b197fc', len: 200, ang: Math.PI / 2, size: 10 });
            hitFx(f, null);
            await wait(STEP.dmg);
          }
          break;
        case 'ko':
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
          V.ring(x, y, { color: '#4dabf7', r0: 30, r1: 80, w: 10, life: 500 });
          V.rays(x, y, { n: 18, colors: ['#7cc4ff', '#fff'], r0: 220, r1: 40, len: 50, life: 320 });
          V.text(x, y - 50, `🛡+${f.v}`, 'f-block');
          sfx.shield();
          await wait(STEP.block);
          break;
        case 'heal':
          motion.play(el, 'heal');
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
    await retreat(A);
    V.comboEnd();
    for (const el of field.querySelectorAll('.fighter.lit')) el.classList.remove('lit');
    field.classList.remove('focusing');
    await wait(200);
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
    field.style.transformOrigin = '';
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
