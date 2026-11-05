// 턴 종료 전투 연출. 필드에 서 있는 캐릭터들이 엔진이 기록한 replay.plays(카드 묶음과 그 안의 효과 fx)대로 직접 싸운다.
// 건너뛸 수 없다. 대신 기본 1.5배속이고, 카드가 많으면 정해진 시간(replayMs) 안에 끝나도록 더 빨라진다.
import { CURSE } from './cards.js';
import { cardHTML, hiddenCardHTML } from './view.js';
import { replayMs } from './engine.js';
import * as V from './vfx.js';
import { sfx } from './sfx.js';

const STEP = { dmg: 380, ko: 1300, trigger: 420, block: 280, heal: 320, react: 320, nullify: 260, strip: 260, unreact: 280, debuff: 280, gimmick: 300, clone: 340 };
const CARD_MS = 800; // 낸 카드를 크게 보여주는 시간
const groupMs = g => CARD_MS + 140 + g.fx.reduce((a, f) => a + (STEP[f.k] || 260), 0) + 240;

export function playReplay(rep, { field, shakeEl, players, nameOf }) {
  let done;
  const finished = new Promise(r => { done = r; });
  let stopped = false;
  const natural = rep.plays.reduce((a, g) => a + groupMs(g), 0);
  const speed = Math.min(1 / 1.5, Math.max(.12, (replayMs(rep.plays) - 150) / natural));
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
    const from = el._off || { x: 0, y: 0 };
    el._off = { x, y };
    return el.animate([{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: `translate(${x}px, ${y}px)` }],
      { duration: Math.max(1, ms * speed), easing, fill: 'forwards' }).finished.catch(() => {});
  };
  const lunge = async (a, b) => {
    const ca = center(a), cb = center(b);
    const dir = Math.sign(cb.x - ca.x) || 1;
    a.classList.add('atk');
    a.style.zIndex = 5;
    sfx.dash();
    V.puff(ca.x, ca.r.bottom - 10);
    await moveTo(a, cb.x - ca.x - dir * cb.r.width * .8, (cb.r.bottom - ca.r.bottom) * .5, 170, 'cubic-bezier(.5,0,.9,.4)');
  };
  const retreat = async a => {
    if (!a) return;
    a.classList.remove('atk');
    await moveTo(a, 0, 0, 220);
    a.style.zIndex = '';
  };
  const knock = (el, dir, power) => {
    const o = el._off || { x: 0, y: 0 };
    el.animate([{ transform: `translate(${o.x}px,${o.y}px)` }, { transform: `translate(${o.x + dir * (8 + power * 22)}px,${o.y}px)` }, { transform: `translate(${o.x}px,${o.y}px)` }],
      { duration: 260 * speed + 60, easing: 'ease-out' });
    el.classList.add('hit');
    setTimeout(() => el.classList.remove('hit'), 280);
  };

  const hitFx = (f, srcEl) => {
    const el = F(f.u);
    if (!el) return;
    const { x, y } = center(el);
    const dir = srcEl ? Math.sign(x - center(srcEl).x) || 1 : 1;
    if (f.v > 0) {
      V.impact(x, y, f.v);
      V.shake(shakeEl, Math.min(22, 4 + f.v * 1.1), 260 + f.v * 12);
      V.text(x, y - 40, `-${f.v}`, `f-dmg ${f.v >= 10 ? 'big' : ''}`);
      knock(el, dir, Math.min(1, f.v / 14));
      sfx.hit(f.v);
      if (f.v >= 10) V.flash('rgba(255,255,255,.35)', 160);
    } else {
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
    if (g.k === 'sudden') banner.innerHTML = '<div class="sudden-banner">라운드 종료 피해</div>';
    else if (g.k === 'start') banner.innerHTML = `<div class="sudden-banner start">${nameOf(g.by)}의 턴 시작 효과</div>`;
    else if (g.k === 'curse') banner.innerHTML = cardHTML(g.id || CURSE, { act: '', size: 'mid' });
    else banner.innerHTML = g.id ? cardHTML(g.id, { act: '', size: 'mid' }) : hiddenCardHTML('mid');
    const fr = field.getBoundingClientRect();
    const x = actorEl ? center(actorEl).x - fr.left : fr.width / 2;
    const left = Math.min(fr.width - 70, Math.max(70, x));
    banner.style.left = `${left}px`;
    // 필드 가운데에서 크게 튀어나왔다가, 잠깐 보여준 뒤 사용한 캐릭터 머리 위로 작아지며 이동
    const dx = fr.width / 2 - left;
    const big = Math.min(1.9, (fr.height * .92) / Math.max(1, banner.getBoundingClientRect().height || 1));
    const T = CARD_MS * speed;
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
    showBanner(g, A);
    await wait(CARD_MS + 60);
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
            else { A.classList.remove('atk'); void A.offsetWidth; A.classList.add('atk'); }
            if (f.v >= 10) await wait(70); // 히트스톱
            hitFx(f, A);
            await wait(STEP.dmg);
          } else if (A && f.u === actor && f.s && f.s !== actor) {
            // 반격: 맞은 쪽이 되받아친다
            await retreat(A);
            near = null;
            const C = F(f.s);
            if (C) { await lunge(C, A); hitFx(f, C); await wait(STEP.dmg); await retreat(C); }
            else { hitFx(f, null); await wait(STEP.dmg); }
          } else {
            if (f.u === actor) { await retreat(A); near = null; }
            if (!f.s) V.slash(x, y - 80, { color: '#b197fc', len: 200, ang: Math.PI / 2, size: 10 });
            hitFx(f, null);
            await wait(STEP.dmg);
          }
          break;
        case 'ko':
          el.classList.add('down');
          V.eliminated(nameOf(f.u), x, y);
          V.shake(shakeEl, 26, 600);
          sfx.ko();
          await wait(STEP.ko);
          break;
        case 'block':
          el.classList.add('guard');
          setTimeout(() => el.classList.remove('guard'), 400);
          V.ring(x, y, { color: '#4dabf7', r0: 30, r1: 80, w: 10, life: 500 });
          V.text(x, y - 50, `🛡+${f.v}`, 'f-block');
          sfx.shield();
          await wait(STEP.block);
          break;
        case 'heal':
          V.sparkle(x, y);
          V.text(x, y - 50, `+${f.v}`, 'f-heal');
          if (f.h != null) setHp(f.u, f.h);
          sfx.heal();
          await wait(STEP.heal);
          break;
        case 'react':
          V.ring(x, y + 40, { color: '#b197fc', r0: 10, r1: 70, w: 5, life: 600 });
          V.sparkle(x, y, { colors: ['#b197fc', '#e0d2ff'] });
          V.text(x, y - 50, '❔ 반응 설치', 'f-react');
          sfx.react();
          await wait(STEP.react);
          break;
        case 'trigger':
          V.flash('rgba(177,151,252,.35)', 200);
          V.ring(x, y, { color: '#b197fc', r1: 120, w: 10 });
          V.text(x, y - 70, `⚡ ${f.v}!`, 'f-trigger');
          sfx.trigger();
          await wait(STEP.trigger);
          break;
        case 'nullify':
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
          V.puff(x, y - 20, { color: 'rgba(170,120,255,.45)' });
          V.text(x, y - 50, f.v, 'f-debuff');
          sfx.debuff();
          await wait(STEP.debuff);
          break;
        case 'gimmick': {
          const col = { buff: ['#7fd6ff', '#e6f6ff'], debuff: ['#ff7a7a', '#ffd0d0'], mixed: ['#ffd23f', '#fff3c2'] }[f.kind] || ['#fff'];
          V.ring(x, y + 30, { color: col[0], r0: 12, r1: 60, w: 4, life: 500 });
          V.sparkle(x, y, { colors: col, n: 10 });
          V.text(x, y - 60, f.v, `f-gimmick g-${f.kind || 'buff'}`);
          (f.kind === 'debuff' ? sfx.debuff : sfx.react)();
          // 이름표의 기믹 칩도 바로 맞춰 보여준다
          await wait(STEP.gimmick);
          break;
        }
        case 'clone':
          V.puff(x + 30, y, { color: 'rgba(160,220,255,.6)', n: 12 });
          V.text(x, y - 40, '분신이 대신 맞음!', 'f-gimmick g-buff');
          el.querySelector('.clone')?.remove();
          sfx.blocked();
          await wait(STEP.clone);
          break;
      }
    }
    await retreat(A);
    await wait(200);
  }

  const close = () => {
    if (stopped) return;
    stopped = true;
    banner.remove();
    title.remove();
    field.classList.remove('replaying');
    for (const el of field.querySelectorAll('.fighter')) {
      el.getAnimations().forEach(a => a.cancel());
      el._off = null;
      el.style.zIndex = '';
      el.classList.remove('atk', 'hit', 'guard');
    }
    done();
  };

  (async () => {
    await wait(200);
    for (const g of rep.plays) {
      if (stopped) break;
      await runGroup(g);
    }
    await wait(250);
    close();
  })();

  // stop: 호스트가 게임을 끝내는 등 화면이 바뀔 때만 쓴다 (건너뛰기 버튼은 없다)
  return { finished, stop: close };
}
