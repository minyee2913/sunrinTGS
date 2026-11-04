// 카드 24종 정의.
// photo: img/cards/<photo>.jpg 를 카드 그림으로 쓴다. 같은 사진을 여러 카드가 써도 된다.
//        파일이 없으면 emoji가 대신 보인다.
// scope: self(자신) / one(다른 생존자 1명) / others(모든 상대) / all(자신 포함 전원)
// play(c): 엔진이 넘겨주는 c(카드 실행 도구)로 효과를 처리한다. engine.js의 makeCtx 참고.

export const TYPE = { atk: '공격', def: '방어', skill: '기술', react: '반응', curse: '방해' };
export const SCOPE = { self: '자신', one: '상대 1명', others: '모든 상대', all: '자신 포함 전원' };

export const CARDS = {
  // ── 기본 카드 ──
  jab: {
    name: '툭 치기', cost: 1, type: 'atk', scope: 'one', basic: true, emoji: '👉',
    text: '피해 6.',
    play: c => c.attack(c.target, 6),
  },
  eating: {
    name: '먹는 중 건들지 마', cost: 1, type: 'def', scope: 'self', basic: true, emoji: '🍚',
    text: '방어도 7.',
    play: c => c.block(7),
  },
  peek: {
    name: '폰 보기', cost: 0, type: 'skill', scope: 'self', basic: true, emoji: '📱', limit: 1,
    text: '카드 2장을 뽑는다. 한 턴에 1번.',
    play: c => c.draw(2),
  },

  // ── 연타 ──
  combo: {
    name: '딱밤 한 대 더', cost: 1, type: 'atk', scope: 'one', tag: '연타', emoji: '🤏',
    text: '피해 4. 카드 1장을 뽑는다.',
    play: c => { c.attack(c.target, 4); c.draw(1); },
  },
  flick: {
    name: '손가락 튕기기', cost: 0, type: 'atk', scope: 'one', tag: '연타', emoji: '🫰', limit: 2,
    text: '피해 3. 한 턴에 2번까지.',
    play: c => c.attack(c.target, 3),
  },
  rush: {
    name: '몰아치기', cost: 2, type: 'atk', scope: 'one', tag: '연타', emoji: '👊',
    text: '피해 6. 이번 턴에 먼저 쓴 공격 카드 1장당 피해 +3 (최대 +9).',
    play: c => c.attack(c.target, 6 + Math.min(9, 3 * c.attacksThisTurn)),
  },
  coffee: {
    name: '아아 수혈', cost: 0, type: 'skill', scope: 'self', tag: '연타', emoji: '🧋', limit: 1,
    text: '에너지 2를 얻는다. 내 다음 턴 드로우 1장 감소.',
    play: c => { c.gainEnergy(2); c.drawPenalty(c.me); },
  },
  stretch: {
    name: '허리펴라!', cost: 1, type: 'skill', scope: 'self', tag: '연타', emoji: '🙆',
    text: '체력 4 회복. 카드 1장을 뽑는다.',
    play: c => { c.heal(4); c.draw(1); },
  },

  // ── 반격 ──
  glare: {
    name: '방금 뭐라 했냐?', cost: 1, type: 'react', scope: 'self', tag: '반격', emoji: '😒',
    text: '반응 설치: 다음 공격을 받은 뒤 공격자에게 피해 6.',
    play: c => c.installReact('glare'),
  },
  ignore: {
    name: '읽씹', cost: 1, type: 'react', scope: 'self', tag: '반격', emoji: '🙄',
    text: '반응 설치: 다음에 받는 공격의 피해를 무효로 한다.',
    play: c => c.installReact('ignore'),
  },
  mirror: {
    name: '반사', cost: 1, type: 'react', scope: 'self', tag: '반격', emoji: '🪞',
    text: '반응 설치: 다음 공격 피해의 절반(내림)을 막고 그만큼 공격자에게 돌려준다.',
    play: c => c.installReact('mirror'),
  },
  wall: {
    name: '이불 밖은 위험해', cost: 2, type: 'def', scope: 'self', tag: '반격', emoji: '🛏️',
    text: '방어도 12. 반응이 설치되어 있으면 방어도 +4.',
    play: c => c.block(c.me.react ? 16 : 12),
  },
  whyme: {
    name: '왜 나만', cost: 1, type: 'atk', scope: 'one', tag: '반격', emoji: '😭',
    text: '피해 4. 지난 내 턴 이후 나를 공격한 상대 1명당 피해 +2 (최대 +6).',
    play: c => c.attack(c.target, 4 + Math.min(6, 2 * c.recentAttackers)),
  },

  // ── 폭탄 ──
  groupshot: {
    name: '다 같이 망하자', cost: 2, type: 'atk', scope: 'all', tag: '폭탄', emoji: '📸',
    text: '자신을 포함한 전원에게 피해 5.',
    play: c => { c.attackOthers(5); c.selfDamage(5); },
  },
  kamikaze: {
    name: '물귀신', cost: 1, type: 'atk', scope: 'others', tag: '폭탄', emoji: '👻',
    text: '모든 상대에게 피해 4. 자신도 피해 3.',
    play: c => { c.attackOthers(4); c.selfDamage(3); },
  },
  bomb: {
    name: '폭탄주', cost: 2, type: 'atk', scope: 'others', tag: '폭탄', emoji: '🍺',
    text: '모든 상대에게 피해 8. 자신은 방어도를 무시하고 피해 5.',
    play: c => { c.attackOthers(8); c.selfDamage(5, true); },
  },
  yolo: {
    name: '잃을 게 없다', cost: 1, type: 'atk', scope: 'one', tag: '폭탄', emoji: '🔥',
    text: '피해 5. 내 체력이 20 이하면 피해 +6.',
    play: c => c.attack(c.target, c.me.hp <= 20 ? 11 : 5),
  },
  nap: {
    name: '나 안 함', cost: 0, type: 'skill', scope: 'self', tag: '폭탄', emoji: '😴',
    text: '체력 5 회복 후 즉시 내 턴 종료.',
    play: c => { c.heal(5); c.endTurn(); },
  },

  // ── 방해 ──
  gimme: {
    name: '일단 내놔', cost: 1, type: 'atk', scope: 'one', tag: '방해', emoji: '🤲',
    text: '피해 4. 대상의 다음 턴 드로우 1장 감소.',
    play: c => { c.attack(c.target, 4); c.drawPenalty(c.target); },
  },
  snitch: {
    name: '일러바치기', cost: 1, type: 'react', scope: 'self', tag: '방해', emoji: '🗣️',
    text: "반응 설치: 다음에 나를 공격한 사람의 손패에 '현타' 2장을 넣는다.",
    play: c => c.installReact('snitch'),
  },
  spam: {
    name: '단톡 폭탄', cost: 1, type: 'skill', scope: 'one', tag: '방해', emoji: '💬',
    text: "대상의 버린 카드 더미에 '현타' 2장을 넣는다.",
    play: c => c.addCards(c.target, 'hyeonta', 2, 'discard'),
  },
  alarm: {
    name: '새벽 알람', cost: 2, type: 'skill', scope: 'others', tag: '방해', emoji: '⏰',
    text: '모든 상대의 다음 턴 드로우 1장 감소.',
    play: c => c.others().forEach(t => c.drawPenalty(t)),
  },
  steal: {
    name: '간식 뺏기', cost: 1, type: 'atk', scope: 'one', tag: '방해', emoji: '🍪',
    text: '대상의 방어도를 모두 없앤 뒤 피해 5.',
    play: c => { c.stripBlock(c.target); c.attack(c.target, 5); },
  },

  // ── 방해 카드 (보상으로 나오지 않음) ──
  hyeonta: {
    name: '현타', cost: 1, type: 'curse', scope: 'self', curse: true, exhaust: true, emoji: '🫠',
    text: '사용하면 덱에서 사라진다. 턴이 끝날 때 손패에 있으면 자신에게 피해 2.',
    endInHand: 2,
    play: () => {},
  },
};

for (const [id, c] of Object.entries(CARDS)) {
  c.id = id;
  c.photo ??= id;
}

// 시작 덱 10장: 기본 공격 5, 기본 방어 4, 카드 뽑기 1
export const STARTER = [
  'jab', 'jab', 'jab', 'jab', 'jab',
  'eating', 'eating', 'eating', 'eating',
  'peek',
];

export const REWARD_POOL = Object.values(CARDS).filter(c => !c.basic && !c.curse).map(c => c.id);

export const REACT_NAME = { glare: '방금 뭐라 했냐?', ignore: '읽씹', mirror: '반사', snitch: '일러바치기' };
