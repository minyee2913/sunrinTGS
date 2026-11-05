// 화면 조각을 만드는 함수들
import { CARDS, TYPE, SCOPE } from './cards.js';
import { charSVG } from './chars.js';
import { cardText } from './editor.js';
import { GIMMICKS, GIMMICK_RULE, linkGimmicks } from './gimmicks.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function cardHTML(id, { u = '', act = 'card', sel = false, off = false, size = '' } = {}) {
  const c = CARDS[id];
  const art = `<img src="img/cards/${c.photo}.webp" alt="" loading="lazy" draggable="false">`;
  const cls = ['card', `t-${c.type}`, size, sel && 'sel', off && 'off'].filter(Boolean).join(' ');
  const data = act ? `data-act="${act}" data-u="${u}" data-id="${id}"` : '';
  return `<div class="${cls}" ${data}>
    <div class="cost">${c.cost}</div>
    <div class="art">${art}</div>
    <div class="cname">${esc(c.name)}</div>
    <div class="ctype">${TYPE[c.type]} · ${SCOPE[c.scope]}</div>
    <div class="ctext" data-text-of="${id}">${linkGimmicks(esc(cardText(id)))}</div>
  </div>`;
}

export function hiddenCardHTML(size = '') {
  return `<div class="card t-react hidden ${size}"><div class="art"><span class="emoji">?</span></div><div class="cname">반응 카드</div><div class="ctype">반응 · 비공개</div><div class="ctext">준비됨. 무슨 효과인지는 발동할 때 공개돼요.</div></div>`;
}

export const hue = uid => [...uid].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

// char가 있으면 캐릭터 얼굴, 없으면 이름 첫 글자
export function avatarHTML(uid, name, extra = '', char = null) {
  if (char) return `<div class="ava face ${extra}" style="--h:${hue(uid)}">${charSVG(char, { head: true })}</div>`;
  const ch = [...(name || '?').trim()][0] || '?';
  return `<div class="ava ${extra}" style="--h:${hue(uid)}">${esc(ch)}</div>`;
}

// 기믹 칩 (이름표 아래). hidden이면 '쉿'만 보인다.
export function gimmickChipsHTML(st = {}, hidden = false) {
  if (hidden) return `<span class="gm g-buff" data-gm="hush" data-n="${st.hush || ''}">쉿<i>?</i></span>`;
  return Object.entries(st).filter(([id, n]) => GIMMICKS[id] && n > 0)
    .map(([id, n]) => `<span class="gm g-${GIMMICKS[id].kind}" data-gm="${id}" data-n="${n}">${GIMMICKS[id].name}<b>${n}</b></span>`).join('');
}

export function gimmickTipHTML(id, n = null) {
  const g = GIMMICKS[id];
  const kind = { buff: '이로운 기믹', debuff: '해로운 기믹', mixed: '운에 달린 기믹' }[g.kind];
  return `<div class="tip-head"><b>${g.name}</b>${n ? `<span class="tip-n">×${n}</span>` : ''}<span class="lbl ${g.kind === 'buff' ? 'cyan' : g.kind === 'debuff' ? 'red' : 'amber'}">${kind}</span></div>
    <p>${esc(g.desc)}</p>
    <p class="tip-rule">${g.max ? `최대 ${g.max}중첩 · ` : '무한 중첩 · '}${GIMMICK_RULE}</p>`;
}

export function gimmickGlossaryHTML() {
  return `<h3>기믹 <small>${String(Object.keys(GIMMICKS).length).padStart(2, '0')}</small></h3>
    <div class="glossary">${Object.keys(GIMMICKS).map(id => `<div class="gl-item">${gimmickTipHTML(id)}</div>`).join('')}</div>`;
}

export function galleryHTML() {
  const groups = [['기본 카드 · 시작 덱', c => c.basic], ['공격', c => c.type === 'atk' && !c.basic], ['방어', c => c.type === 'def' && !c.basic],
    ['반응', c => c.type === 'react' && !c.basic], ['기술', c => c.type === 'skill' && !c.basic], ['방해 카드', c => c.curse]];
  return gimmickGlossaryHTML() + groups.map(([title, f]) => {
    const list = Object.values(CARDS).filter(f);
    return `<h3>${title} <small>${String(list.length).padStart(2, '0')}</small></h3>
    <div class="grid">${list.map(c => cardHTML(c.id, { act: '' })).join('')}</div>`;
  }).join('');
}
