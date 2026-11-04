// 화면 조각을 만드는 함수들
import { CARDS, TYPE, SCOPE } from './cards.js';
import { charSVG } from './chars.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function cardHTML(id, { u = '', act = 'card', sel = false, off = false, size = '' } = {}) {
  const c = CARDS[id];
  const art = `<img src="img/cards/${c.photo}.webp" alt="" loading="lazy" draggable="false">`;
  const cls = ['card', `t-${c.type}`, size, sel && 'sel', off && 'off'].filter(Boolean).join(' ');
  const data = act ? `data-act="${act}" data-u="${u}" data-id="${id}"` : '';
  return `<div class="${cls}" ${data}>
    <div class="cost">${c.cost}</div>
    <div class="art">${art}<div class="cname">${esc(c.name)}</div></div>
    <div class="ctype">${TYPE[c.type]} · ${SCOPE[c.scope]}</div>
    <div class="ctext">${esc(c.text)}</div>
  </div>`;
}

export function hiddenCardHTML(size = '') {
  return `<div class="card t-react hidden ${size}"><div class="art"><span class="emoji">❔</span><div class="cname">반응 카드</div></div><div class="ctype">반응</div><div class="ctext">준비됨. 효과는 비공개.</div></div>`;
}

export const hue = uid => [...uid].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

// char가 있으면 캐릭터 얼굴, 없으면 이름 첫 글자
export function avatarHTML(uid, name, extra = '', char = null) {
  if (char) return `<div class="ava face ${extra}" style="--h:${hue(uid)}">${charSVG(char, { head: true })}</div>`;
  const ch = [...(name || '?').trim()][0] || '?';
  return `<div class="ava ${extra}" style="--h:${hue(uid)}">${esc(ch)}</div>`;
}

export function galleryHTML() {
  const groups = [['기본 카드', c => c.basic], ['공격', c => c.type === 'atk' && !c.basic], ['방어', c => c.type === 'def' && !c.basic],
    ['반응', c => c.type === 'react'], ['기술', c => c.type === 'skill' && !c.basic], ['방해 카드', c => c.curse]];
  return groups.map(([title, f]) => {
    const list = Object.values(CARDS).filter(f);
    return `<h3>${title} <small>${list.length}</small></h3>
    <div class="grid">${list.map(c => cardHTML(c.id, { act: '' })).join('')}</div>`;
  }).join('');
}
