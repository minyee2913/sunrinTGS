// c는 캐릭터 번호. 나머지 필드는 기존 저장/네트워크 형식과 호환한다.
const CAST_NAMES = ['펀치만준', '따봉훈', '레이저훈', '하키훈', '지각훈', '불꽃훈', '알파훈', '개구리', 'Mr.윤', '부따만준', '이강불', '시원주성', 'SSR 이건', '휴가주성', '낼름채호', '퀵성태'];
const ATTACK_MOTIONS = ['punch', 'hop', 'cast', 'hop', 'dash', 'cast', 'punch', 'hop', 'cast', 'cast', 'punch', 'cast', 'hop', 'dash', 'punch', 'cast'];
export const CHARACTERS = ['p01', 'p02', 'p03', 'p04', 'p06', 'p09', 'p11', 'p13', 'p65', 'p74', 'p53', 'p64', 'p67', 'p80', 'p88', 'p85']
  .map((card, i) => ({ card, name: CAST_NAMES[i] ?? `캐릭터 ${i + 1}`, number: i + 1,
    motion: ATTACK_MOTIONS[i],
    sheet: `img/characters/sprites/cast-${String(i + 1).padStart(2, '0')}-sheet-v${i === 15 ? 2 : 1}.webp`,
    cellAspect: 1,
    image: i >= 8 ? `img/characters/cast-${String(i + 1).padStart(2, '0')}-${card}-clean-v2.png` : null }));
export const CHAR_OPTS = { c: { label: '캐릭터', n: CHARACTERS.length } };
export function defaultChar(uid) {
  const h = [...uid].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return { c: h % CHARACTERS.length, hair: 0, face: 0, acc: 0 };
}
export function validChar(ch) {
  return !!ch && Number.isInteger(ch.c) && ch.c >= 0 && ch.c < CHARACTERS.length
    && ['hair', 'face', 'acc'].every((k, i) => Number.isInteger(ch[k]) && ch[k] >= 0 && ch[k] < [5, 4, 5][i]);
}
export function cycleChar(ch, k, d) {
  if (k !== 'c') return ch;
  return { ...ch, c: (ch.c + d + CHARACTERS.length) % CHARACTERS.length };
}
// 생성 이미지의 투명도를 보존하고 각 셀을 SVG 뷰포트로 표시한다.
export function charSVG(ch, { head = false } = {}) {
  const i = validChar(ch) ? ch.c : 0;
  if (!head) {
    const character = CHARACTERS[i];
    return `<span class="char card-character sprite-player" style="--sprite-sheet:url('${character.sheet}');--sprite-aspect:${character.cellAspect}" aria-hidden="true"><span class="sprite-frames"></span></span>`;
  }
  if (CHARACTERS[i].image) {
    const headBox = CHARACTERS[i].card === 'p85' ? '65 90 270 240' : '65 15 270 240';
    return `<svg class="${head ? 'char-head' : 'char'} card-character" viewBox="${head ? headBox : '0 0 400 400'}" aria-hidden="true" overflow="hidden">
      <image href="${CHARACTERS[i].image}" width="400" height="400" preserveAspectRatio="xMidYMid meet"/>
    </svg>`;
  }
  const x = (i % 5) * 396.6;
  // 생성 결과의 실제 행 사이 여백은 y=418에 있다. 발이 잘리지 않게 행별로 맞춘다.
  const y = i < 5 ? 0 : 418;
  const height = i < 5 ? 418 : 375;
  return `<svg class="${head ? 'char-head' : 'char'} card-character" viewBox="${head ? '65 0 270 240' : '0 0 400 400'}" aria-hidden="true" overflow="hidden">
    <svg width="400" height="400" viewBox="${x} ${y} 396.6 ${height}" preserveAspectRatio="xMidYMid meet" overflow="hidden">
      <image href="img/characters/card-cast-powerpuff-clean-v3.png" width="1983" height="793"/>
    </svg>
  </svg>`;
}
