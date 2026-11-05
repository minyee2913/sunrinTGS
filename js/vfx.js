// 타격감 연출: 전체 화면 캔버스 파티클, 화면 흔들림, 번쩍임, 떠오르는 글자
let cv, ctx, raf = 0, dpr = 1;
const parts = [];

export function initVfx() {
  cv = document.createElement('canvas');
  cv.id = 'vfx';
  document.body.appendChild(cv);
  ctx = cv.getContext('2d');
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
  };
  resize();
  addEventListener('resize', resize);
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = (a, b) => a + Math.random() * (b - a);

function loop() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.globalCompositeOperation = 'lighter';
  const now = performance.now();
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    const t = (now - p.t0) / p.life;
    if (t >= 1) { parts.splice(i, 1); continue; }
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
    p.x += p.vx; p.y += p.vy;
    const a = 1 - t;
    ctx.globalAlpha = a;
    if (p.kind === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.w * a + .5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - (1 - t) ** 3), 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === 'spark') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * a;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5);
      ctx.stroke();
    } else if (p.kind === 'slash') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * (1 - t * .7);
      ctx.lineCap = 'round';
      const len = p.len * Math.min(1, t * 4);
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(p.ang) * len / 2, p.y - Math.sin(p.ang) * len / 2);
      ctx.lineTo(p.x + Math.cos(p.ang) * len / 2, p.y + Math.sin(p.ang) * len / 2);
      ctx.stroke();
    } else if (p.kind === 'ray') {
      // 집중선: 바깥에서 중심으로 빨려 들어가는 선
      const r = p.r0 + (p.r1 - p.r0) * t;
      const c = Math.cos(p.ang), s = Math.sin(p.ang);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * (1 - t * .5);
      ctx.beginPath();
      ctx.moveTo(p.x + c * r, p.y + s * r);
      ctx.lineTo(p.x + c * (r + p.len), p.y + s * (r + p.len));
      ctx.stroke();
    } else if (p.kind === 'arc') {
      // 초승달 베기: 빠르게 휘두르며 그려지고 얇아지며 사라진다
      const k = Math.min(1, t * 3.2);
      const a0 = p.ang, a1 = p.ang + p.sweep * k * p.dir;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, Math.min(a0, a1), Math.max(a0, a1));
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * (1 - t * .8);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = p.size * .3 * (1 - t);
      ctx.stroke();
    } else if (p.kind === 'crack') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * (1 - t * .6);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      for (const [px, py] of p.pts) ctx.lineTo(p.x + px, p.y + py);
      ctx.stroke();
    } else if (p.kind === 'star') {
      const s = p.size * (t < .15 ? t / .15 : 1 - (t - .15) * .4);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      // 큰 십자 다음에 45도 돌려 작은 십자
      for (const [i, [w, h]] of [[s, s * .1], [s * .1, s], [s * .55, s * .06], [s * .06, s * .55]].entries()) {
        if (i === 2) ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-w, 0); ctx.lineTo(0, -h); ctx.lineTo(w, 0); ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else if (p.kind === 'orb') {
      // 에너지탄: 포물선으로 날아가며 꼬리를 남긴다
      const ox = p.x0 + (p.x1 - p.x0) * t, oy = p.y0 + (p.y1 - p.y0) * t - Math.sin(t * Math.PI) * p.arc;
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, p.size);
      g.addColorStop(0, '#fff');
      g.addColorStop(.3, p.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, oy, p.size, 0, Math.PI * 2);
      ctx.fill();
      parts.push({ t0: now, drag: .9, g: 0, vx: rnd(-1, 1), vy: rnd(-1, 1), kind: 'dot', x: ox, y: oy, size: p.size * .28, life: 260, color: p.color });
    } else if (p.kind === 'shard') {
      p.rot += p.spin;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(p.size * .7, p.size * .8);
      ctx.lineTo(-p.size * .6, p.size * .5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.kind === 'puff' ? 1 + t * 2 : a), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  raf = parts.length ? requestAnimationFrame(loop) : 0;
}
const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

function add(p) {
  parts.push({ t0: performance.now(), drag: .92, g: 0, vx: 0, vy: 0, size: 4, ...p });
  kick();
}

export function burst(x, y, { n = 16, colors = ['#ffd23f', '#ff7a3d', '#fff'], speed = 9, size = 3.5, life = 550, g = .25, kind = 'spark' } = {}) {
  if (reduced()) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(speed * .35, speed);
    add({ kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g, size: rnd(size * .6, size * 1.3), life: rnd(life * .6, life), color: colors[i % colors.length] });
  }
}

export function ring(x, y, { color = '#fff', r0 = 6, r1 = 90, w = 6, life = 450 } = {}) {
  add({ kind: 'ring', x, y, r0, r1, w, life, color, drag: 1 });
}

export function slash(x, y, { color = '#fff', len = 160, size = 7, life = 260, ang = rnd(-.9, -.3) } = {}) {
  add({ kind: 'slash', x, y, len, size, life, ang, color, drag: 1 });
}

export function sparkle(x, y, { colors = ['#6ef0a0', '#c8ffd9'], n = 14, spread = 50 } = {}) {
  for (let i = 0; i < n; i++) {
    add({ kind: 'dot', x: x + rnd(-spread, spread), y: y + rnd(-spread * .4, spread * .6), vy: rnd(-2.6, -1), vx: rnd(-.4, .4), size: rnd(2, 4.5), life: rnd(600, 1000), drag: .98, color: colors[i % colors.length] });
  }
}

export function puff(x, y, { color = 'rgba(180,170,220,.5)', n = 8 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2);
    add({ kind: 'puff', x, y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 1.2 - .6, size: rnd(6, 12), life: rnd(500, 800), drag: .94, color });
  }
}

// 피해량에 비례한 타격 이펙트
export function impact(x, y, dmg, { heavy = dmg >= 10 } = {}) {
  const power = Math.min(1, dmg / 14);
  burst(x, y, { n: 12 + dmg * 2, speed: 7 + power * 9, size: 3 + power * 2.5 });
  burst(x, y, { n: 6 + dmg, colors: ['#ff3b5c', '#ff8a8a'], speed: 5 + power * 5, kind: 'dot', size: 3 + power * 2, g: .35 });
  ring(x, y, { color: heavy ? '#ffd23f' : '#fff', r1: 50 + power * 90, w: 4 + power * 6 });
  slash(x, y, { color: '#fff', len: 90 + power * 140, size: 4 + power * 6 });
  if (heavy) slash(x, y, { color: '#ffd23f', len: 120 + power * 120, size: 5, ang: rnd(.3, .9) });
}

export function shake(el, power = 6, ms = 320) {
  if (!el || reduced() || power <= 0) return;
  const k = [];
  for (let i = 0; i <= 8; i++) {
    const f = 1 - i / 8;
    k.push({ transform: i === 8 ? 'translate(0,0)' : `translate(${rnd(-power, power) * f}px, ${rnd(-power, power) * f}px) rotate(${rnd(-.6, .6) * f * (power / 8)}deg)` });
  }
  el.animate(k, { duration: ms, easing: 'linear' });
}

export function flash(color = 'rgba(255,255,255,.7)', ms = 220) {
  const el = document.createElement('div');
  el.className = 'vfx-flash';
  el.style.background = color;
  document.body.appendChild(el);
  el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' }).onfinish = () => el.remove();
}

export function text(x, y, str, cls = '') {
  const el = document.createElement('div');
  el.className = `float ${cls}`;
  el.textContent = str;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.getElementById('fx').appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

// 탈락 연출: "탈선린!" 도장 + 폭발
export function eliminated(name, x = innerWidth / 2, y = innerHeight / 2) {
  flash('rgba(255,40,80,.55)', 500);
  burst(x, y, { n: 60, speed: 16, size: 5, life: 900, colors: ['#ff3b5c', '#ffd23f', '#fff', '#b197fc'] });
  ring(x, y, { color: '#ff3b5c', r1: 260, w: 14, life: 700 });
  ring(x, y, { color: '#ffd23f', r1: 180, w: 8, life: 600 });
  const el = document.createElement('div');
  el.className = 'talsunrin';
  el.innerHTML = `<b>탈선린!</b><small>${name.replace(/[<>&]/g, '')}</small>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1700);
}

// ── 턴 종료 연출용 (화려한 쪽) ──

// 집중선: 한 점으로 모이는 선
export function rays(x, y, { n = 28, colors = ['#fff', '#ffd23f'], r0 = Math.max(innerWidth, innerHeight) * .55, r1 = 60, len = 90, size = 2.5, life = 360 } = {}) {
  if (reduced()) return;
  for (let i = 0; i < n; i++) {
    add({ kind: 'ray', x, y, ang: rnd(0, Math.PI * 2), r0: r0 * rnd(.7, 1.1), r1: r1 * rnd(.8, 1.4), len: len * rnd(.5, 1.3), size: size * rnd(.5, 1.4), life: life * rnd(.7, 1), color: colors[i % colors.length], drag: 1 });
  }
}

// 대시 잔상: 이동 방향과 나란한 줄
export function streak(x1, y1, x2, y2, { color = 'rgba(255,255,255,.8)', n = 7 } = {}) {
  if (reduced()) return;
  const ang = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
  for (let i = 0; i < n; i++) {
    const k = rnd(.2, .8), off = rnd(-38, 38);
    slash(x1 + (x2 - x1) * k - Math.sin(ang) * off, y1 + (y2 - y1) * k + Math.cos(ang) * off, { color, len: len * rnd(.3, .7), size: rnd(1.5, 4), life: rnd(160, 280), ang });
  }
}

// 파편: 회전하며 튀는 삼각형 조각
export function shards(x, y, { n = 26, colors = ['#ff3b5c', '#ffd23f', '#fff'], speed = 14, size = 9, life = 1000 } = {}) {
  if (reduced()) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(speed * .3, speed);
    add({ kind: 'shard', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, g: .45, drag: .97, rot: rnd(0, 6), spin: rnd(-.3, .3), size: rnd(size * .5, size * 1.3), life: rnd(life * .6, life), color: colors[i % colors.length] });
  }
}

const layer = cls => {
  const el = document.createElement('div');
  el.className = cls;
  document.body.appendChild(el);
  return el;
};

// 연출 동안 위아래 레터박스 + 비네트
let cine = null;
export function cinema(on) {
  if (on && !cine) {
    cine = layer('cine');
    cine.innerHTML = '<i class="cine-bar t"></i><i class="cine-bar b"></i><i class="cine-vig"></i>';
    requestAnimationFrame(() => cine?.classList.add('on'));
  } else if (!on && cine) {
    const el = cine;
    cine = null;
    el.classList.remove('on');
    setTimeout(() => el.remove(), 400);
  }
}

// 카드 컷인: 화면을 가로지르는 기울어진 띠에 카드 그림과 이름
export function cutIn({ art = null, name = '', sub = '', type = 'atk', rarity = 'common', flip = false, ms = 700 }) {
  const el = layer(`cutin t-${type} r-${rarity} ${flip ? 'flip' : ''}`);
  el.innerHTML = `<div class="ci-dim"></div><div class="ci-band"><i class="ci-lines"></i>
    <div class="ci-art">${art ? `<img src="${art}" alt="" draggable="false">` : '<b>?</b>'}</div>
    <div class="ci-text"><small></small><b></b></div></div>`;
  el.querySelector('.ci-text small').textContent = sub;
  el.querySelector('.ci-text b').textContent = name;
  const d = flip ? -1 : 1, less = reduced();
  const band = el.querySelector('.ci-band'), artEl = el.querySelector('.ci-art'), txt = el.querySelector('.ci-text');
  const o = { duration: ms, fill: 'forwards' };
  el.querySelector('.ci-dim').animate([{ opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: 1, offset: .82 }, { opacity: 0 }], o);
  band.animate(less ? [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .85 }, { opacity: 0 }] : [
    { transform: 'translateY(-50%) skewY(-7deg) scaleY(0)', offset: 0 },
    { transform: 'translateY(-50%) skewY(-7deg) scaleY(1.12)', offset: .1, easing: 'ease-out' },
    { transform: 'translateY(-50%) skewY(-7deg) scaleY(1)', offset: .16 },
    { transform: 'translateY(-50%) skewY(-7deg) scaleY(1)', offset: .84 },
    { transform: 'translateY(-50%) skewY(-7deg) scaleY(0)', offset: 1, easing: 'ease-in' },
  ], o);
  if (!less) {
    artEl.animate([
      { transform: `translateX(${-70 * d}vw)`, offset: 0 },
      { transform: `translateX(${2 * d}vw)`, offset: .16, easing: 'cubic-bezier(.2,.9,.3,1)' },
      { transform: `translateX(${-2 * d}vw)`, offset: .84 },
      { transform: `translateX(${60 * d}vw)`, offset: 1, easing: 'ease-in' },
    ], o);
    txt.animate([
      { transform: `translateX(${80 * d}vw) skewX(-12deg)`, opacity: 0, offset: 0 },
      { transform: `translateX(${80 * d}vw) skewX(-12deg)`, opacity: 0, offset: .06 },
      { transform: `translateX(${-1 * d}vw) skewX(-12deg)`, opacity: 1, offset: .22, easing: 'cubic-bezier(.2,.9,.3,1)' },
      { transform: `translateX(${1.5 * d}vw) skewX(-12deg)`, opacity: 1, offset: .84 },
      { transform: `translateX(${-70 * d}vw) skewX(-12deg)`, opacity: 0, offset: 1, easing: 'ease-in' },
    ], o);
  }
  setTimeout(() => el.remove(), ms + 40);
}

// 회방 등장: 화면이 찢어지듯 갈라지며 '회방!' 도장
export function ambushReveal(name, ms = 950) {
  impactFrame(110);
  flash('rgba(160,110,255,.55)', 260);
  const el = layer('ambush');
  el.innerHTML = '<i class="am-tear t"></i><i class="am-tear b"></i><div class="am-word"><b>회방!</b><small></small></div>';
  el.querySelector('small').textContent = `${name}의 숨겨둔 한 수`;
  el.style.setProperty('--ms', `${ms}ms`);
  setTimeout(() => el.remove(), ms + 60);
}

// 임팩트 프레임: 한순간 화면을 반전·고대비로
export function impactFrame(ms = 90) {
  if (reduced()) return;
  const el = layer('impact-frame');
  setTimeout(() => el.remove(), ms);
}

// 화면 가운데 큰 글자 도장 (CRITICAL!, GUARD 등)
export function bigWord(str, cls = '', ms = 900) {
  const el = layer(`bigword ${cls}`);
  el.textContent = str;
  el.style.animationDuration = `${ms}ms`;
  setTimeout(() => el.remove(), ms);
}

// 카메라: 한 점을 중심으로 잠깐 확대했다가 돌아온다
export function camera(el, x, y, scale = 1.08, ms = 320) {
  if (!el || reduced()) return;
  const r = el.getBoundingClientRect();
  el.style.transformOrigin = `${x - r.left}px ${y - r.top}px`;
  el.animate([{ transform: 'scale(1)' }, { transform: `scale(${scale})`, offset: .25, easing: 'ease-out' }, { transform: 'scale(1)' }],
    { duration: ms, easing: 'cubic-bezier(.3,0,.3,1)' });
}

// 연타 카운터 (한 카드 안에서 몇 번 때렸는지와 합계)
let comboEl = null, comboOff = 0;
export function combo(n, total) {
  clearTimeout(comboOff);
  if (!comboEl) comboEl = layer('combo');
  comboEl.innerHTML = `<b>${n}</b><span>HIT${n > 1 ? 'S' : ''}</span><small>${total} DMG</small>`;
  comboEl.classList.remove('pop');
  void comboEl.offsetWidth;
  comboEl.classList.add('pop');
  comboOff = setTimeout(comboEnd, 1600);
}
export function comboEnd() {
  clearTimeout(comboOff);
  if (!comboEl) return;
  const el = comboEl;
  comboEl = null;
  el.classList.add('out');
  setTimeout(() => el.remove(), 300);
}

// ── 전투 동작 이펙트 ──

// 초승달 베기 궤적
export function crescent(x, y, { color = '#9fe8ff', r = 80, size = 12, dir = 1, ang = rnd(-2.6, -.6), sweep = 2.4, life = 300 } = {}) {
  add({ kind: 'arc', x, y, r, size, dir, ang, sweep, life, color, drag: 1 });
}

// 바닥 균열: 옆으로 갈라지는 금
export function cracks(x, y, { n = 7, len = 110, color = 'rgba(255,236,190,.95)', life = 750 } = {}) {
  if (reduced()) n = 3;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? -1 : 1;
    let px = 0, py = 0;
    const pts = [];
    const ang = rnd(-.45, .45);
    for (let k = 0; k < 4; k++) {
      const step = len * rnd(.18, .32);
      px += Math.cos(ang + rnd(-.5, .5)) * step * side;
      py += Math.sin(ang + rnd(-.5, .5)) * step * .35;
      pts.push([px, py]);
    }
    add({ kind: 'crack', x, y, pts, size: rnd(2, 4.5), life: rnd(life * .7, life), color, drag: 1 });
  }
}

// 별 모양 타격광
export function flare(x, y, { color = '#fff', size = 70, life = 260 } = {}) {
  add({ kind: 'star', x, y, size, life, color, rot: rnd(0, Math.PI / 2), drag: 1 });
}

// 에너지탄: ms 뒤에 도착한다
export function projectile(x0, y0, x1, y1, { color = '#b197fc', size = 20, ms = 280, arc = 40 } = {}) {
  add({ kind: 'orb', x: x0, y: y0, x0, y0, x1, y1, size, life: ms, color, arc: reduced() ? 0 : arc, drag: 1 });
  return new Promise(r => setTimeout(r, ms));
}

const fxEl = (cls, x, y, css = {}) => {
  const el = document.createElement('div');
  el.className = cls;
  Object.assign(el.style, { left: `${x}px`, top: `${y}px`, ...css });
  document.body.appendChild(el);
  return el;
};

// 잔상: 캐릭터 모습을 복사해 그 자리에 남기고 흐려지게
export function afterimage(fighter, { tint = 'cyan' } = {}) {
  if (reduced()) return;
  const body = fighter?.querySelector('.f-body');
  if (!body) return;
  const r = body.getBoundingClientRect();
  const g = body.cloneNode(true);
  g.className = `afterimage ${tint}`;
  Object.assign(g.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  document.body.appendChild(g);
  g.animate([{ opacity: .6, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 320, easing: 'ease-out' }).onfinish = () => g.remove();
}

// 발밑 마법진 (회전)
export function magicCircle(x, y, w, { color = '#b197fc', ms = 900 } = {}) {
  const el = fxEl('mcircle', x, y, { width: `${w}px`, '--c': color });
  el.innerHTML = '<i></i><i></i>';
  el.animate([{ opacity: 0, transform: 'translate(-50%, -50%) scaleY(.3) scale(.4)' }, { opacity: 1, transform: 'translate(-50%, -50%) scaleY(.3) scale(1)', offset: .2 },
    { opacity: 1, transform: 'translate(-50%, -50%) scaleY(.3) scale(1)', offset: .75 }, { opacity: 0, transform: 'translate(-50%, -50%) scaleY(.3) scale(1.2)' }],
  { duration: ms, easing: 'ease-out' }).onfinish = () => el.remove();
}

// 바닥 충격파 (납작한 고리)
export function shockwave(x, y, { w = 320, color = 'rgba(255,220,160,.9)', ms = 520 } = {}) {
  const el = fxEl('shock', x, y, { '--c': color });
  el.animate([{ width: '20px', opacity: 1 }, { width: `${w}px`, opacity: 0 }], { duration: ms, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => el.remove();
}

// 방어막 돔
export function dome(x, y, size, { color = '#7cc4ff', ms = 700 } = {}) {
  const el = fxEl('dome', x, y, { width: `${size}px`, '--c': color });
  el.animate([{ opacity: 0, transform: 'translate(-50%, -50%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1.08)', offset: .25 },
    { opacity: .9, transform: 'translate(-50%, -50%) scale(1)', offset: .7 }, { opacity: 0, transform: 'translate(-50%, -50%) scale(1.15)' }],
  { duration: ms, easing: 'ease-out' }).onfinish = () => el.remove();
}

// 위에서 내려오는 빛기둥
export function pillar(x, bottom, w, { color = '#6ef0a0', ms = 800 } = {}) {
  const el = fxEl('pillar', x, 0, { width: `${w}px`, height: `${bottom}px`, '--c': color });
  el.animate([{ opacity: 0, transform: 'translateX(-50%) scaleX(.1)' }, { opacity: 1, transform: 'translateX(-50%) scaleX(1)', offset: .2 },
    { opacity: .8, transform: 'translateX(-50%) scaleX(.8)', offset: .7 }, { opacity: 0, transform: 'translateX(-50%) scaleX(0)' }],
  { duration: ms, easing: 'ease-out' }).onfinish = () => el.remove();
}
