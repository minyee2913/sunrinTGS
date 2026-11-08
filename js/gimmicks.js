// 기믹 (상태 효과). 엔진과 화면이 함께 쓴다.
// 공통 규칙(기획서): 슬더슬처럼 중첩으로 쌓이고, 턴 시작 시 모두 1씩 감소한다.
// keep이 붙은 기믹(예?·엄·티~원)은 줄지 않는다. 최대치가 없으면 무한 중첩. 감소는 그 기믹을 가진 사람의 턴이 시작될 때, 턴 시작 효과를 낸 뒤에 한다.
// desc는 기획서 문구 그대로 둔다.
// kind: buff(이로운) / debuff(해로운) / mixed(운에 달림)

export const GIMMICKS = {
  slow: { name: '둔화', kind: 'debuff', max: 4, short: '둔',
    desc: '다음 턴에 자신의 드로우 카드 1장 감소' },
  blind: { name: '실명', kind: 'debuff', short: '실',
    desc: '공격 대상을 지정할 수 없고 무작위 대상에게 공격함' },
  clone: { name: '분신', kind: 'buff', max: 3, short: '분',
    desc: '자신의 작은 분신이 옆에 생긴다.' },
  str: { name: '치녀', kind: 'buff', short: '치',
    desc: '가하는 데미지가 1 증가' },
  weak: { name: '성능평가', kind: 'debuff', short: '성',
    desc: '가하는 데미지가 1 감소' },
  dex: { name: '요이', kind: 'buff', short: '요',
    desc: '얻는 보호막 1 증가' },
  buta: { name: '부타', kind: 'buff', short: '부',
    desc: '만준에게 넣는 데미지 2배' },
  manjun: { name: '만준', kind: 'buff', short: '만',
    desc: '맞은 데미지의 절반 만큼 회복' },
  ai: { name: 'AI', kind: 'buff', short: 'AI',
    desc: '턴 시작시 에너지 1 획득' },
  rice: { name: '쌀먹단', kind: 'buff', short: '쌀',
    desc: '다음 턴까지 데미지를 받지 않으면 체력 10 회복' },
  hush: { name: '쉿', kind: 'buff', short: '쉿',
    desc: '자신이 가진 기믹 모두에게 숨기기' },
  paradise: { name: '낙원', kind: 'mixed', short: '낙',
    desc: '다음 턴에 체력이 5 증가 혹은 감소함' },
  // 예? → 엄 → 티~원 → 줴줴이야~ 순서로 자기 턴마다 5% 확률로 바뀐다 (next)
  ye: { name: '예?', kind: 'debuff', short: '예', next: 'eom', keep: true,
    desc: '자신의 턴마다 체력이 1 감소함. (5% 확률로 [엄]으로 변경)' },
  eom: { name: '엄', kind: 'debuff', short: '엄', next: 'tione', keep: true,
    desc: '자신의 턴마다 체력이 2 감소함. (5% 확률로 [티~원]으로 변경)' },
  tione: { name: '티~원', kind: 'buff', short: '티', next: 'jjdeath', keep: true,
    desc: '자신의 턴마다 체력을 5 회복합니다. (5% 확률로 [줴줴이야~]로 변경)' },
  jjdeath: { name: '줴줴이야~', kind: 'debuff', short: '줴~',
    desc: '자신이 사망합니다.' },
};

export const CHANGE_CHANCE = 0.05;

export const GIMMICK_RULE = '중첩으로 쌓이고, 턴 시작 시 1씩 감소 (남의 턴에 새로 받은 중첩은 바로 다음 내 턴 시작에는 줄지 않음. 예?·엄·티~원은 줄지 않음)';

// 이름이 긴 것부터 찾아야 '성능평가' 같은 이름이 잘리지 않는다
const BY_NAME = Object.entries(GIMMICKS).sort((a, b) => b[1].name.length - a[1].name.length);
// '엄'처럼 한 글자인 이름은 '엄지' 같은 낱말 속에서는 찾지 않는다
const pat = n => {
  const e = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return n.length === 1 ? `(?<![가-힣])${e}(?=$|[^가-힣]|(?:을|이|은|과|의|으로)(?![가-힣]))` : e;
};
const RE = new RegExp(`(${BY_NAME.map(([, g]) => pat(g.name)).join('|')})`, 'g');
const ID_OF = Object.fromEntries(BY_NAME.map(([id, g]) => [g.name, id]));

// 이미 이스케이프된 카드 설명에서 기믹 이름을 눌러볼 수 있는 링크로 바꾼다
export function linkGimmicks(escapedText) {
  return escapedText.replace(RE, n => `<span class="gk g-${GIMMICKS[ID_OF[n]].kind}" data-gk="${ID_OF[n]}">${n}</span>`);
}
