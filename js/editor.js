// 카드 수정해보기: 이 브라우저에만 저장되는 카드 이름·비용·설명 덮어쓰기와 파일 내보내기.
// 실제 카드 효과와 게임에서 쓰는 비용(js/cards.js)은 바뀌지 않는다. 내보낸 파일을 받아서 반영한다.
import { CARDS, TYPE, SCOPE } from './cards.js';

const KEY = 'hp_card_text';
// 카드마다 고친 칸만 { name, cost, text }로 저장한다. 예전 형식(설명 문자열)도 읽는다.
let edits = (() => {
  try {
    const o = JSON.parse(localStorage.getItem(KEY)) || {};
    for (const id of Object.keys(o)) {
      if (!CARDS[id]) { delete o[id]; continue; }
      if (typeof o[id] === 'string') o[id] = { text: o[id] };
      // 반영된 수정은 이제 원래 값과 같으므로 지운다
      for (const f of ['name', 'cost', 'text']) if (o[id][f] === CARDS[id][f]) delete o[id][f];
      if (!Object.keys(o[id]).length) delete o[id];
    }
    return o;
  } catch { return {}; }
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(edits)); } catch {} };

const field = (id, f) => edits[id]?.[f] ?? CARDS[id][f];
export const cardText = id => field(id, 'text');
export const cardName = id => field(id, 'name');
export const cardCost = id => field(id, 'cost');
export const isEdited = id => id in edits;
export const editCount = () => Object.keys(edits).length;

// f: 'name' | 'cost' | 'text'. 비우거나 원래 값과 같으면 그 칸은 원래대로.
export function setCardField(id, f, v) {
  if (f === 'cost') v = v === '' || !Number.isFinite(+v) ? null : Math.max(0, Math.min(9, Math.round(+v)));
  else if (v.trim() === '') v = null;
  const e = edits[id] || {};
  if (v === null || v === CARDS[id][f]) delete e[f];
  else e[f] = v;
  if (Object.keys(e).length) edits[id] = e;
  else delete edits[id];
  save();
}

export function resetCard(id) { delete edits[id]; save(); }
export function resetAll() { edits = {}; save(); }

function rows() {
  return Object.values(CARDS).map(c => ({
    id: c.id, no: +c.id.slice(1), type: TYPE[c.type], scope: SCOPE[c.scope],
    name: c.name, cost: c.cost, text: c.text,
    edited: edits[c.id] ? { ...edits[c.id] } : null,
  })).sort((a, b) => a.no - b.no);
}

function download(name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

export function exportJSON() {
  const data = { game: '허리펴라', kind: 'card-edits', exportedAt: new Date().toISOString(), changed: editCount(), cards: rows() };
  download(`허리펴라_카드수정_${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

export function exportCSV() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['번호', 'ID', '종류', '대상', '원래 카드명', '수정한 카드명', '원래 비용', '수정한 비용', '원래 설명', '수정한 설명', '수정 여부'].map(q).join(',')];
  for (const r of rows()) {
    const e = r.edited || {};
    lines.push([r.no, r.id, r.type, r.scope, r.name, e.name, r.cost, e.cost, r.text, e.text, r.edited ? 'O' : ''].map(q).join(','));
  }
  download(`허리펴라_카드수정_${stamp()}.csv`, '﻿' + lines.join('\n'), 'text/csv');
}
