// 플레이어 캐릭터 (SVG). char = { c: 옷 색, hair: 머리, face: 표정, acc: 소품 } 모두 번호.
// 캐릭터는 오른쪽을 바라본다. 오른편에 설 때는 CSS로 뒤집는다.

export const CHAR_OPTS = {
  c: { label: '옷 색', n: 10 },
  hair: { label: '머리', names: ['짧은 머리', '뾰족 머리', '장발', '모자', '가르마'] },
  face: { label: '표정', names: ['기본', '웃음', '째림', '졸림'] },
  acc: { label: '소품', names: ['없음', '동그란 안경', '뿔테 안경', '선글라스', '마스크'] },
};
const HUES = [0, 25, 45, 120, 165, 200, 225, 265, 300, 330];
const count = k => CHAR_OPTS[k].n ?? CHAR_OPTS[k].names.length;

export function defaultChar(uid) {
  const h = [...uid].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return { c: h % 10, hair: (h >>> 4) % 5, face: (h >>> 8) % 4, acc: (h >>> 12) % 5 };
}

export function validChar(ch) {
  return ch && ['c', 'hair', 'face', 'acc'].every(k => Number.isInteger(ch[k]) && ch[k] >= 0 && ch[k] < count(k));
}

export function cycleChar(ch, k, d) {
  const n = count(k);
  return { ...ch, [k]: (ch[k] + d + n) % n };
}

const HAIR = '#2b2233';
const SKIN = '#ffd7b5';

function hairSVG(i, hue) {
  switch (i) {
    case 1: return `<path d="M28 48 L29 26 L40 32 L43 12 L54 26 L60 8 L66 26 L77 12 L80 32 L91 26 L92 48 Q84 32 60 32 Q36 32 28 48Z" fill="${HAIR}"/>`;
    case 2: return `<path d="M25 76 Q20 16 60 15 Q100 16 95 76 L86 76 Q90 36 60 31 Q30 36 34 76Z" fill="${HAIR}"/>`;
    case 3: return `<path d="M26 44 Q27 13 60 13 Q93 13 94 44Z" fill="hsl(${(hue + 180) % 360} 70% 45%)"/>
      <path d="M62 38 L108 42 Q109 49 96 49 L62 45Z" fill="hsl(${(hue + 180) % 360} 70% 35%)"/>
      <path d="M28 48 Q28 40 34 40 L34 52Z" fill="${HAIR}"/>`;
    case 4: return `<path d="M27 52 Q24 15 60 17 Q96 15 93 52 Q89 30 64 30 L60 21 L56 30 Q31 30 27 52Z" fill="${HAIR}"/>`;
    default: return `<path d="M27 50 Q26 15 60 15 Q94 15 93 50 Q87 29 60 29 Q33 29 27 50Z" fill="${HAIR}"/>`;
  }
}

function faceSVG(i) {
  const eyes = [
    '<circle cx="48" cy="52" r="3.6" fill="#2b2233"/><circle cx="72" cy="52" r="3.6" fill="#2b2233"/>',
    '<path d="M43 54 Q48 47 53 54 M67 54 Q72 47 77 54" stroke="#2b2233" stroke-width="3" fill="none" stroke-linecap="round"/>',
    '<path d="M41 44 L55 49 M79 44 L65 49" stroke="#2b2233" stroke-width="3" stroke-linecap="round"/><ellipse cx="48" cy="54" rx="4" ry="2.2" fill="#2b2233"/><ellipse cx="72" cy="54" rx="4" ry="2.2" fill="#2b2233"/>',
    '<path d="M43 54 L53 54 M67 54 L77 54" stroke="#2b2233" stroke-width="3" stroke-linecap="round"/>',
  ][i];
  const mouth = [
    '<path d="M53 66 Q60 72 67 66" stroke="#2b2233" stroke-width="3" fill="none" stroke-linecap="round"/>',
    '<path d="M51 63 Q60 77 69 63Z" fill="#8a2c3c"/>',
    '<path d="M53 68 L67 66" stroke="#2b2233" stroke-width="3" stroke-linecap="round"/>',
    '<circle cx="60" cy="67" r="3.2" fill="#8a2c3c"/>',
  ][i];
  return `<g class="eyes">${eyes}</g>
    <g class="eyes-hit"><path d="M43 48 L52 53 L43 58 M77 48 L68 53 L77 58" stroke="#2b2233" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
    <g class="eyes-ko"><path d="M43 48 L53 58 M53 48 L43 58 M67 48 L77 58 M77 48 L67 58" stroke="#2b2233" stroke-width="3" stroke-linecap="round"/></g>
    <g class="mouth">${mouth}</g>`;
}

function accSVG(i) {
  switch (i) {
    case 1: return '<g fill="none" stroke="#3a3350" stroke-width="2.6"><circle cx="48" cy="52" r="8.5"/><circle cx="72" cy="52" r="8.5"/><path d="M56.5 52 L63.5 52"/></g>';
    case 2: return '<g fill="none" stroke="#141019" stroke-width="4"><rect x="37" y="45" width="21" height="14" rx="3"/><rect x="62" y="45" width="21" height="14" rx="3"/><path d="M58 50 L62 50"/></g>';
    case 3: return '<g><rect x="36" y="45" width="22" height="13" rx="5" fill="#15121c"/><rect x="62" y="45" width="22" height="13" rx="5" fill="#15121c"/><path d="M58 50 L62 50" stroke="#15121c" stroke-width="3"/><path d="M40 48 L47 48 M66 48 L73 48" stroke="#7fd1ff" stroke-width="2" stroke-linecap="round" opacity=".7"/></g>';
    case 4: return '<g><path d="M40 60 Q60 56 80 60 L78 76 Q60 84 42 76Z" fill="#f2f2f5" stroke="#d6d6de" stroke-width="1.5"/><path d="M40 62 L29 56 M80 62 L91 56" stroke="#d6d6de" stroke-width="2"/></g>';
    default: return '';
  }
}

// head: true면 얼굴 부분만 (아바타용)
export function charSVG(ch, { head = false } = {}) {
  const hue = HUES[ch.c] ?? 200;
  const shirt = `hsl(${hue} 70% 55%)`;
  const shirt2 = `hsl(${hue} 65% 42%)`;
  const headG = `<g class="head">
      <circle cx="60" cy="50" r="32" fill="${SKIN}"/>
      <circle cx="40" cy="62" r="5" fill="#ff9e9e" opacity=".45"/><circle cx="80" cy="62" r="5" fill="#ff9e9e" opacity=".45"/>
      ${faceSVG(ch.face)}${accSVG(ch.acc)}${hairSVG(ch.hair, hue)}
    </g>`;
  if (head) return `<svg class="char-head" viewBox="22 8 76 76" aria-hidden="true">${headG}</svg>`;
  return `<svg class="char" viewBox="0 0 120 152" aria-hidden="true">
    <ellipse class="shadow" cx="60" cy="146" rx="32" ry="6" fill="rgba(0,0,0,.35)"/>
    <g class="legs"><rect x="43" y="112" width="13" height="30" rx="6" fill="#2d2b45"/><rect x="64" y="112" width="13" height="30" rx="6" fill="#2d2b45"/></g>
    <g class="arm-b"><rect x="25" y="84" width="13" height="30" rx="6.5" fill="${shirt2}"/><circle cx="31.5" cy="116" r="6.5" fill="${SKIN}"/></g>
    <rect class="body" x="35" y="78" width="50" height="44" rx="15" fill="${shirt}"/>
    <g class="arm-f"><rect x="82" y="84" width="13" height="30" rx="6.5" fill="${shirt2}"/><circle cx="88.5" cy="116" r="7.5" fill="${SKIN}"/></g>
    ${headG}
  </svg>`;
}
