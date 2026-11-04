// 화면 조각을 만드는 함수들
import { CARDS, TYPE, SCOPE } from './cards.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// img/cards/<photo>.(jpg|png|webp) 중 있는 파일만 기억해 두고 쓴다 (없는 파일을 매번 요청하지 않도록)
const photos = {};
export function loadPhotos(onLoad) {
  const names = [...new Set(Object.values(CARDS).map(c => c.photo))];
  for (const name of names) {
    const exts = ['jpg', 'png', 'webp'];
    const tryNext = () => {
      const ext = exts.shift();
      if (!ext) return;
      const img = new Image();
      img.onload = () => { photos[name] = img.src; onLoad(); };
      img.onerror = tryNext;
      img.src = `img/cards/${name}.${ext}`;
    };
    tryNext();
  }
}

export function cardHTML(id, { u = '', act = 'card', sel = false, off = false, size = '' } = {}) {
  const c = CARDS[id];
  const src = photos[c.photo];
  const art = src ? `<img src="${src}" alt="">` : `<span class="emoji">${c.emoji}</span>`;
  const cls = ['card', `t-${c.type}`, size, sel && 'sel', off && 'off'].filter(Boolean).join(' ');
  const data = act ? `data-act="${act}" data-u="${u}" data-id="${id}"` : '';
  return `<div class="${cls}" ${data}>
    <div class="cost">${c.cost}</div>
    <div class="art">${art}</div>
    <div class="cname">${esc(c.name)}</div>
    <div class="ctype">${TYPE[c.type]} · ${SCOPE[c.scope]}</div>
    <div class="ctext">${esc(c.text)}</div>
  </div>`;
}

export function hiddenCardHTML(size = '') {
  return `<div class="card t-react hidden ${size}"><div class="art"><span class="emoji">❔</span></div><div class="cname">반응 카드</div><div class="ctext">준비됨. 효과는 비공개.</div></div>`;
}

export const hue = uid => [...uid].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

export function avatarHTML(uid, name, extra = '') {
  const ch = [...(name || '?').trim()][0] || '?';
  return `<div class="ava ${extra}" style="--h:${hue(uid)}">${esc(ch)}</div>`;
}

export function galleryHTML() {
  const groups = [['기본', c => c.basic], ['연타', c => c.tag === '연타'], ['반격', c => c.tag === '반격'], ['폭탄', c => c.tag === '폭탄'], ['방해', c => c.tag === '방해' || c.curse]];
  return groups.map(([title, f]) => `
    <h3>${title}</h3>
    <div class="grid">${Object.values(CARDS).filter(f).map(c => cardHTML(c.id, { act: '' })).join('')}</div>`).join('');
}
