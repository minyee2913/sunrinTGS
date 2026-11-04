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
