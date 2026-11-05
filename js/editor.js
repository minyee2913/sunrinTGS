// 카드 설명 수정해보기: 이 브라우저에만 저장되는 설명 덮어쓰기와 파일 내보내기.
// 실제 카드 효과(js/cards.js)는 바뀌지 않는다. 내보낸 파일을 받아서 효과·설명을 반영한다.
import { CARDS, TYPE, SCOPE } from './cards.js';

const KEY = 'hp_card_text';
let edits = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(edits)); } catch {} };

export const cardText = id => edits[id] ?? CARDS[id].text;
export const isEdited = id => id in edits;
export const editCount = () => Object.keys(edits).length;

export function setCardText(id, text) {
  if (text.trim() === '' || text === CARDS[id].text) delete edits[id];
  else edits[id] = text;
  save();
}

export function resetCard(id) { delete edits[id]; save(); }
export function resetAll() { edits = {}; save(); }

function rows() {
  return Object.values(CARDS).map(c => ({
    id: c.id, no: +c.id.slice(1), name: c.name, cost: c.cost, type: TYPE[c.type], scope: SCOPE[c.scope],
    original: c.text, edited: edits[c.id] ?? null,
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
  const data = { game: '허리펴라', kind: 'card-text-edits', exportedAt: new Date().toISOString(), changed: editCount(), cards: rows() };
  download(`허리펴라_카드설명_${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

export function exportCSV() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['번호', 'ID', '카드명', '비용', '종류', '대상', '원래 설명', '수정한 설명', '수정 여부'].map(q).join(',')];
  for (const r of rows()) lines.push([r.no, r.id, r.name, r.cost, r.type, r.scope, r.original, r.edited ?? '', r.edited ? 'O' : ''].map(q).join(','));
  download(`허리펴라_카드설명_${stamp()}.csv`, '﻿' + lines.join('\n'), 'text/csv');
}
