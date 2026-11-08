// 화면 조각을 만드는 함수들
import { CARDS, TYPE, SCOPE, RARITY } from './cards.js';
import { charSVG } from './chars.js?v=sprite-paths-2';
import { cardText, cardName, cardCost, cardRarity, cardBoost } from './editor.js';
import { GIMMICKS, GIMMICK_RULE, linkGimmicks } from './gimmicks.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// hot: 지금 쓰면 역전이 발동한다
export function cardHTML(id, { u = '', act = 'card', sel = false, off = false, size = '', hot = false } = {}) {
  const c = CARDS[id];
  // 등급·역전은 카드 수정해보기에서 고친 값으로 보여준다
  const rarity = cardRarity(id), boost = cardBoost(id);
  const art = `<img src="img/cards/${c.photo}.webp" alt="" loading="lazy" draggable="false">`;
  const cls = ['card', `t-${c.type}`, `r-${rarity}`, size, sel && 'sel', off && 'off', hot && boost && 'hot'].filter(Boolean).join(' ');
  const data = act ? `data-act="${act}" data-u="${u}" data-id="${id}"` : '';
  return `<div class="${cls}" ${data}>
    <div class="cost">${cardCost(id)}</div>
    ${rarity !== 'common' ? `<div class="rar">${RARITY[rarity].name}</div>` : ''}
    <div class="art">${art}</div>
    <div class="cname">${esc(cardName(id))}</div>
    <div class="ctype">${TYPE[c.type]} · ${SCOPE[c.scope]}</div>
    <div class="ctext" data-text-of="${id}">${c.ambush ? '<span class="kw amb" data-kw="ambush">회방</span> ' : ''}${c.retain ? '<span class="kw ret" data-kw="retain">보존</span> ' : ''}${linkGimmicks(esc(cardText(id)))}${boost ? ` <span class="cb" data-kw="comeback" data-n="${boost}">역전 ×${boost}</span>` : ''}</div>
  </div>`;
}

export function keywordTipHTML(kw) {
  const K = {
    retain: ['보존', '턴이 끝나도 버리지 않고 손에 남아요. 다음 턴 카드는 따로 뽑아요.'],
    ambush: ['회방', '다른 사람의 턴에 손패에서 위로 끌어 올려 몰래 써요. 그 턴이 끝날 때 마지막에 갑자기 발동해요. 그 전까지 다른 사람은 몰라요. 비용만큼 내 다음 턴 에너지가 줄고, 한 턴에 한 장만 쓸 수 있어요. 상대 1명 카드는 그 턴을 진행한 사람에게 써요.'],
  }[kw];
  return `<div class="tip-head"><b>${K[0]}</b><span class="lbl amber">카드 키워드</span></div><p>${K[1]}</p>`;
}

export function comebackTipHTML(boost) {
  return `<div class="tip-head"><b>역전</b><span class="tip-n">×${boost}</span><span class="lbl amber">영웅·전설 카드</span></div>
    <p>카드를 쓸 때 내 체력이 살아 있는 다른 모든 사람보다 낮으면 이 카드의 피해·방어도·회복·기믹·드로우·에너지가 ${boost}배가 돼요. (자해는 그대로, 소수점은 올림)</p>`;
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
