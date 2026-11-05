// 기믹 (상태 효과). 엔진과 화면이 함께 쓴다.
// 공통 규칙: 플레이어마다 중첩으로 쌓이고, 자기 턴이 시작될 때 효과를 낸 뒤 1씩 줄어든다.
// max가 없으면 무한 중첩.
// kind: buff(이로운) / debuff(해로운) / mixed(운에 달림)

export const GIMMICKS = {
  slow: { name: '둔화', kind: 'debuff', max: 4, short: '둔',
    desc: '내 턴이 시작될 때 미리 뽑아 둔 손패에서 중첩 수만큼 카드를 무작위로 버린다.' },
  blind: { name: '실명', kind: 'debuff', short: '실',
    desc: "대상을 지정할 수 없다. '상대 1명' 공격은 무작위 상대에게 날아간다." },
  clone: { name: '분신', kind: 'buff', max: 3, short: '분',
    desc: '작은 분신이 옆에 생긴다. 공격을 받으면 분신 1개가 대신 맞아 피해를 무효로 하고 사라진다.' },
  str: { name: '치녀', kind: 'buff', short: '치',
    desc: '내가 주는 공격 피해가 중첩 수만큼 증가한다.' },
  weak: { name: '성능평가', kind: 'debuff', short: '성',
    desc: '내가 주는 공격 피해가 중첩 수만큼 감소한다 (최소 0).' },
  dex: { name: '줴줴이야', kind: 'buff', short: '줴',
    desc: '내가 얻는 방어도가 중첩 수만큼 증가한다.' },
  buta: { name: '부타', kind: 'buff', short: '부',
    desc: '만준 상태인 대상에게 주는 공격 피해가 2배가 된다.' },
  manjun: { name: '만준', kind: 'buff', short: '만',
    desc: '체력에 피해를 받으면 그 절반(내림)만큼 회복한다.' },
  ai: { name: 'AI', kind: 'buff', short: 'AI',
    desc: '내 턴이 시작될 때 에너지 1을 얻는다.' },
  rice: { name: '쌀먹단', kind: 'buff', short: '쌀',
    desc: '얻은 뒤 다음 내 턴이 시작될 때까지 체력에 피해를 받지 않으면 체력 10을 회복한다.' },
  hush: { name: '쉿', kind: 'buff', short: '쉿',
    desc: '내가 가진 기믹이 다른 사람에게 보이지 않는다.' },
  paradise: { name: '낙원', kind: 'mixed', short: '낙',
    desc: '내 턴이 시작될 때 체력이 5 늘어나거나 5 줄어든다 (반반).' },
};

export const GIMMICK_RULE = '자기 턴이 시작될 때 효과를 낸 뒤 1씩 줄어든다.';

// 이름이 긴 것부터 찾아야 '성능평가' 같은 이름이 잘리지 않는다
const BY_NAME = Object.entries(GIMMICKS).sort((a, b) => b[1].name.length - a[1].name.length);
const RE = new RegExp(`(${BY_NAME.map(([, g]) => g.name).join('|')})`, 'g');
const ID_OF = Object.fromEntries(BY_NAME.map(([id, g]) => [g.name, id]));

// 이미 이스케이프된 카드 설명에서 기믹 이름을 눌러볼 수 있는 링크로 바꾼다
export function linkGimmicks(escapedText) {
  return escapedText.replace(RE, n => `<span class="gk g-${GIMMICKS[ID_OF[n]].kind}" data-gk="${ID_OF[n]}">${n}</span>`);
}
