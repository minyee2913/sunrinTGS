// 카드 140종 정의. 카드 그림은 img/cards/<id>.webp (친구 사진 카드 이미지 번호와 같다).
// scope: self(자신) / one(다른 생존자 1명) / others(모든 상대) / all(자신 포함 전원)
//        random(무작위) / top(체력이 가장 높은 상대)
// play(c): 엔진이 넘겨주는 c(카드 실행 도구)로 효과를 처리한다. engine.js의 makeCtx 참고.
// react: 반응 카드가 공격을 받았을 때 하는 일 (engine.js의 attack 참고)
//   nullify 피해 무효 / reduce n 피해 감소 / block n 방어도 획득 / reflect 비율만큼 막고 되돌림
//   counter n 공격자에게 피해 / curse n 공격자 손패에 방해 카드 / penalty 공격자에게 둔화 1, 다음 턴 에너지 -1
// 기믹(둔화·실명·분신 등)은 js/gimmicks.js. c.gain(id, n) 나에게, c.give(대상, id, n) / c.giveOthers(id, n) 상대에게 쌓는다.

export const TYPE = { atk: '공격', def: '방어', skill: '기술', react: '반응', curse: '방해' };
export const SCOPE = { self: '자신', one: '상대 1명', others: '모든 상대', all: '자신 포함 전원', random: '무작위', top: '체력 1위 상대' };
export const CURSE = 'p79';

export const CARDS = {
  // ── 기본 카드 ──
  p01: { name: '원, 투!', cost: 1, type: 'atk', scope: 'one', basic: true,
    text: '피해 6.', play: c => c.attack(c.target, 6) },
  p17: { name: '철벽팔뚝', cost: 1, type: 'def', scope: 'self', basic: true,
    text: '방어도 7.', play: c => c.block(7) },
  p85: { name: '머리굴리는중', cost: 0, type: 'skill', scope: 'self', basic: true, limit: 1,
    text: '카드 2장을 뽑는다. 한 턴에 1번.', play: c => c.draw(2) },

  // ── 단일 공격 ──
  p02: { name: '따봉훈', cost: 1, type: 'atk', scope: 'one', tag: '연타',
    text: '피해 5. 대상의 방어도가 0이면 피해 +4.', play: c => c.attack(c.target, c.target.block ? 5 : 9) },
  p03: { name: '째려보기', cost: 1, type: 'atk', scope: 'one', tag: '방해',
    text: '피해 4. 대상에게 둔화 1.', play: c => { c.attack(c.target, 4); c.give(c.target, 'slow', 1); } },
  p04: { name: '눈덩이투척', cost: 1, type: 'atk', scope: 'one', tag: '연타',
    text: '피해 2를 두번 주고, 대상에게 둔화 1', play: c => { c.attack(c.target, 2); c.attack(c.target, 2); c.give(c.target, 'slow', 1); } },
  p05: { name: '아잇 짜증나!', cost: 2, type: 'atk', scope: 'one', tag: '연타',
    text: '피해 11', play: c => c.attack(c.target, 11) },
  p06: { name: '전력 질주', cost: 2, type: 'skill', scope: 'self', tag: '연타',
    text: '자신에게 걸린 둔화를 모두 제거하고, 카드 1장을 뽑는다.', play: c => { c.gain('slow', -(c.me.st.slow || 0)); c.draw(1); } },
  p07: { name: '분신소환', cost: 2, type: 'atk', scope: 'one', tag: '반격',
    text: '피해 4. 분신 2를 얻는다.', play: c => { c.attack(c.target, 4); c.gain('clone', 2); } },
  p09: { name: '매운맛 공격', cost: 1, type: 'atk', scope: 'one', tag: '폭탄',
    text: '부타 1을 얻은 뒤 피해 8. 자신도 피해 2.', play: c => { c.gain('buta', 1); c.attack(c.target, 8); c.selfDamage(2); } },
  p10: { name: '안경광선', cost: 1, type: 'atk', scope: 'one', tag: '방해',
    text: '대상의 방어도를 모두 없앤 뒤 피해 5.', play: c => { c.stripBlock(c.target); c.attack(c.target, 5); } },
  p11: { name: '필살공식', cost: 2, type: 'atk', scope: 'one', tag: '연타',
    text: '피해 6. 이번 턴에 먼저 쓴 공격 카드 1장당 피해 +3 (최대 +9).',
    play: c => c.attack(c.target, 6 + Math.min(9, 3 * c.attacksThisTurn)) },
  p14: { name: '연쇄 반응', cost: 0, type: 'atk', scope: 'one', tag: '연타', limit: 2,
    text: '대상에게 피해 3, 턴 당 최대 2회 사용 가능', play: c => c.attack(c.target, 3) },
  p15: { name: '진지한한방', cost: 2, type: 'atk', scope: 'one', tag: '연타',
    text: '피해 10. 대상의 체력이 15 이하면 피해 +6.', play: c => c.attack(c.target, c.target.hp <= 15 ? 16 : 10) },
  p16: { name: '피곤해', cost: 2, type: 'skill', scope: 'one', tag: '방해',
    text: '대상에게 둔화 3', play: c => c.give(c.target, 'slow', 3) },
  p39: { name: '마지막한입뺏기', cost: 1, type: 'atk', scope: 'one', tag: '반격',
    text: '피해 5. 이 공격으로 대상의 체력이 감소했다면, 감소량 만큼 체력을 회복.', play: c => c.heal(c.attack(c.target, 5)) },
  p49: { name: '최후의승부', cost: 1, type: 'skill', scope: 'self', tag: '폭탄',
    text: '치녀 2를 얻는다. 내 체력이 20 이하면 치녀 +2.', play: c => c.gain('str', c.me.hp <= 20 ? 4 : 2) },
  p50: { name: '이제내차례', cost: 1, type: 'atk', scope: 'one', tag: '반격',
    text: '피해 4. 지난 내 턴 이후 나를 공격한 상대 1명당 피해 +2 (최대 +6).',
    play: c => c.attack(c.target, 4 + Math.min(6, 2 * c.recentAttackers)) },
  p53: { name: '꼬치한방', cost: 0, type: 'atk', scope: 'one', tag: '폭탄', limit: 1,
    text: '부타 2를 얻은 뒤 피해 3. 한 턴에 1번.', play: c => { c.gain('buta', 2); c.attack(c.target, 3); } },
  p57: { name: '너무가까워', cost: 1, type: 'atk', scope: 'one', tag: '방해',
    text: '대상의 반응 카드를 발동 없이 없앤 뒤 피해 4. 대상에게 실명 2.', play: c => { c.stripReact(c.target); c.attack(c.target, 4); c.give(c.target, 'blind', 2); } },
  p62: { name: '병뚜껑탄환', cost: 0, type: 'atk', scope: 'one', tag: '연타', limit: 2,
    text: '피해 2. 카드 1장을 뽑는다. 한 턴에 2번까지.', play: c => { c.attack(c.target, 2); c.draw(1); } },
  p63: { name: '강제로그아웃', cost: 2, type: 'atk', scope: 'one', tag: '방해',
    text: '피해 7. 대상의 다음 턴 에너지 1 감소.', play: c => { c.attack(c.target, 7); c.energyPenalty(c.target); } },
  p65: { name: '너거기', cost: 1, type: 'atk', scope: 'one', tag: '연타',
    text: '피해 5. 대상이 반응 카드를 설치해 두었다면 피해 +4.', play: c => c.attack(c.target, c.target.react ? 9 : 5) },
  p67: { name: '전설의등장', cost: 3, type: 'atk', scope: 'one', tag: '연타',
    text: '피해 18.', play: c => c.attack(c.target, 18) },
  p78: { name: '놀랐죠?', cost: 1, type: 'atk', scope: 'one', tag: '방해',
    text: '대상의 방어도를 무시하고 피해 5.', play: c => c.attack(c.target, 5, { pierce: true }) },
  p90: { name: '볼빵빵반격', cost: 1, type: 'atk', scope: 'one', tag: '반격',
    text: '내 방어도만큼 피해를 준다. 방어도는 그대로 남는다.', play: c => c.attack(c.target, c.me.block) },

  // ── 광역·무작위 공격 ──
  p08: { name: '웃음폭발', cost: 2, type: 'atk', scope: 'others', tag: '폭탄',
    text: '모든 상대에게 피해 5.', play: c => c.attackOthers(5) },
  p12: { name: '단체필살기', cost: 3, type: 'atk', scope: 'others', tag: '폭탄',
    text: '모든 상대에게 피해 9.', play: c => c.attackOthers(9) },
  p13: { name: '마이크공격', cost: 1, type: 'atk', scope: 'others', tag: '폭탄',
    text: '모든 상대에게 피해 3.', play: c => c.attackOthers(3) },
  p44: { name: '전부날아가', cost: 2, type: 'atk', scope: 'others', tag: '폭탄',
    text: '모든 상대의 방어도를 없앤 뒤 피해 4.', play: c => c.others().forEach(t => { c.stripBlock(t); c.attack(t, 4); }) },
  p45: { name: '분위기반전', cost: 1, type: 'skill', scope: 'all', tag: '폭탄',
    text: '자신을 포함한 전원에게 낙원 1.', play: c => { c.gain('paradise', 1); c.giveOthers('paradise', 1); } },
  p46: { name: '눈사태주의', cost: 2, type: 'atk', scope: 'all', tag: '폭탄',
    text: '자신을 포함한 전원에게 피해 7.', play: c => { c.attackOthers(7); c.selfDamage(7); } },
  p47: { name: '다같이웃자', cost: 1, type: 'atk', scope: 'others', tag: '폭탄',
    text: '모든 상대에게 피해 4. 자신도 피해 3.', play: c => { c.attackOthers(4); c.selfDamage(3); } },
  p48: { name: '단체대혼란', cost: 2, type: 'atk', scope: 'random', tag: '폭탄',
    text: '나를 포함한 무작위 생존자에게 피해 4를 5번 준다.',
    play: c => { for (let i = 0; i < 5; i++) { const t = c.randomAlive(true); if (t === c.me) c.selfDamage(4); else if (t) c.attack(t, 4); } } },
  p52: { name: '충격의외침', cost: 2, type: 'atk', scope: 'others', tag: '방해',
    text: '모든 상대에게 피해 3, 둔화 1.', play: c => c.others().forEach(t => { c.attack(t, 3); c.give(t, 'slow', 1); }) },
  p60: { name: '노래방궁극기', cost: 3, type: 'atk', scope: 'others', tag: '폭탄',
    text: '모든 상대에게 피해 7, 둔화 1.', play: c => c.others().forEach(t => { c.attack(t, 7); c.give(t, 'slow', 1); }) },
  p64: { name: '바람의장난', cost: 1, type: 'atk', scope: 'random', tag: '연타',
    text: '무작위 상대에게 피해 3. 분신을 모두 없애고, 없앤 분신 1개당 무작위 상대에게 피해 7.',
    play: c => {
      const t = c.randomAlive(false); if (t) c.attack(t, 3);
      const n = c.me.st.clone || 0;
      c.gain('clone', -n);
      for (let i = 0; i < n; i++) { const u = c.randomAlive(false); if (u) c.attack(u, 7); }
    } },
  p68: { name: '우정의합동기', cost: 3, type: 'atk', scope: 'others', tag: '폭탄',
    text: '모든 상대에게 피해 6. 나는 방어도 6.', play: c => { c.attackOthers(6); c.block(6); } },
  p72: { name: '과제가 펑.', cost: 2, type: 'atk', scope: 'all', tag: '폭탄',
    text: '자신을 포함한 전원에게 피해 7.', play: c => { c.attackOthers(7); c.selfDamage(7); } },
  p84: { name: '삼인방출격', cost: 2, type: 'atk', scope: 'one', tag: '연타',
    text: '피해 5. 분신 1개당 피해 5를 한 번 더 준다.',
    play: c => { for (let i = 0; i <= (c.me.st.clone || 0); i++) c.attack(c.target, 5); } },

  // ── 방어 ──
  p18: { name: '괜찮아엄지척', cost: 1, type: 'def', scope: 'self', tag: '반격',
    text: '방어도 5. 요이 2를 얻는다.', play: c => { c.block(5); c.gain('dex', 2); } },
  p19: { name: '빙벽세우기', cost: 2, type: 'def', scope: 'self', tag: '반격',
    text: '방어도 12. 반응 카드가 설치되어 있으면 방어도 +4.', play: c => c.block(c.me.react ? 16 : 12) },
  p20: { name: '책상엄폐', cost: 1, type: 'def', scope: 'self', tag: '연타',
    text: '방어도 5. 카드 1장을 뽑는다.', play: c => { c.block(5); c.draw(1); } },
  p22: { name: '웃으면서버티기', cost: 2, type: 'def', scope: 'self', tag: '반격',
    text: '방어도 9. 체력 2 회복.', play: c => { c.block(9); c.heal(2); } },
  p23: { name: '계산된방어', cost: 1, type: 'def', scope: 'self', tag: '연타',
    text: '방어도 3. 지금 손패 1장당 방어도 +2.', play: c => c.block(3 + 2 * c.me.hand.length) },
  p24: { name: '든든한지원', cost: 0, type: 'def', scope: 'self', tag: '반격', limit: 1,
    text: '요이 1을 얻은 뒤 방어도 3. 한 턴에 1번.', play: c => { c.gain('dex', 1); c.block(3); } },
  p25: { name: '귀찮음의장벽', cost: 2, type: 'def', scope: 'self', tag: '반격',
    text: '방어도 9, 다음 턴까지 방어도가 유지된다.', play: c => { c.block(9); c.keepBlock(); } },
  p51: { name: '볼빵빵방어', cost: 1, type: 'def', scope: 'self', tag: '반격',
    text: '방어도 6. 내 체력이 20 이하면 방어도 +5.', play: c => c.block(c.me.hp <= 20 ? 11 : 6) },
  p66: { name: '일시적동맹', cost: 1, type: 'def', scope: 'self', tag: '반격',
    text: '나와 체력이 가장 낮은 상대가 방어도 6을 얻는다.', play: c => { c.block(6); c.giveBlock(c.lowestOther(), 6); } },
  p73: { name: '여기서버틴다', cost: 1, type: 'def', scope: 'self', tag: '반격',
    text: '방어도 5. 내 체력이 10 이하면 방어도 15.', play: c => c.block(c.me.hp <= 10 ? 15 : 5) },
  p82: { name: '이동식개발팀', cost: 2, type: 'def', scope: 'self', tag: '연타',
    text: '방어도 8. AI 2를 얻는다.', play: c => { c.block(8); c.gain('ai', 2); } },
  p87: { name: '이불갑옷', cost: 2, type: 'def', scope: 'self', tag: '반격',
    text: '방어도 8. 분신 1개당 방어도 +4.', play: c => c.block(8 + 4 * (c.me.st.clone || 0)) },
  p88: { name: '아 안보여', cost: 1, type: 'def', scope: 'self', tag: '반격',
    text: '방어도 9, 실명 2', play: c => { c.block(9); c.gain('blind', 2); } },

  // ── 반응 ──
  p21: { name: '옆으로피하기', cost: 1, type: 'react', scope: 'self', tag: '반격', react: { nullify: true },
    text: '반응 설치: 다음에 받는 공격의 피해를 무효로 한다.' },
  p26: { name: '거울반사', cost: 1, type: 'react', scope: 'self', tag: '반격', react: { reflect: 0.5 },
    text: '반응 설치: 다음 공격 피해의 절반(내림)을 막고 그만큼 공격자에게 돌려준다.' },
  p27: { name: '눈덩이되돌리기', cost: 1, type: 'react', scope: 'self', tag: '반격', react: { counter: 3, give: { slow: 1 } },
    text: '반응 설치: 다음 공격을 받은 뒤 공격자에게 피해 3. 둔화 1' },
  p28: { name: '가짜나', cost: 1, type: 'skill', scope: 'self', tag: '반격',
    text: '분신 1을 얻는다. 카드 1장을 뽑는다.', play: c => { c.gain('clone', 1); c.draw(1); } },
  p29: { name: '렌즈반사', cost: 2, type: 'react', scope: 'self', tag: '반격', react: { reflect: 1 },
    text: '반응 설치: 다음 공격 피해를 모두 막고 그만큼 공격자에게 돌려준다.' },
  p30: { name: '입력반전', cost: 1, type: 'react', scope: 'self', tag: '방해', react: { drain: 1, gain: { ai: 1 } },
    text: '반응 설치: 다음에 나를 공격한 대상의 에너지를 즉시 1 감소 시키고, 자신에게 AI 1 부여' },
  p54: { name: '수상한미소', cost: 1, type: 'react', scope: 'self', tag: '방해', react: { curse: 2 },
    text: "반응 설치: 다음에 나를 공격한 사람의 손패에 '속이부글부글' 2장을 넣는다." },
  p58: { name: '옆으로쏙', cost: 0, type: 'react', scope: 'self', tag: '반격', react: { reduce: 4 },
    text: '반응 설치: 다음에 받는 공격의 피해를 4 줄인다.' },
  p71: { name: '통신보안', cost: 1, type: 'react', scope: 'self', tag: '반격', react: { block: 10 },
    text: '반응 설치: 다음 공격을 받기 직전에 방어도 10을 얻는다.' },
  p76: { name: '절대거절', cost: 2, type: 'react', scope: 'self', tag: '반격', react: { nullify: true, give: { slow: 1 } },
    text: '반응 설치: 다음 공격의 피해를 무효로 하고 공격자에게 둔화 1' },
  p80: { name: '뒤돌아반격', cost: 2, type: 'react', scope: 'self', tag: '반격', react: { counter: 10 },
    text: '반응 설치: 다음 공격을 받은 뒤 공격자에게 피해 10.' },
  p86: { name: '미끄러운회피', cost: 1, type: 'react', scope: 'self', tag: '반격', react: { reduce: 8 },
    text: '반응 설치: 다음에 받는 공격의 피해를 8 줄인다.' },

  // ── 회복·드로우 ──
  p31: { name: '국물한입', cost: 1, type: 'skill', scope: 'self', tag: '반격',
    text: '체력 6 회복.', play: c => c.heal(6) },
  p32: { name: '한잔쉬기', cost: 0, type: 'skill', scope: 'self', tag: '폭탄',
    text: '체력 4 회복 후 즉시 내 턴 종료.', play: c => { c.heal(4); c.endTurn(); } },
  p33: { name: '심호흡', cost: 0, type: 'skill', scope: 'self', tag: '연타', limit: 1,
    text: '에너지 1을 얻고 카드 1장을 뽑는다. 한 턴에 1번.', play: c => { c.gainEnergy(1); c.draw(1); } },
  p34: { name: '잠깐눈붙임', cost: 1, type: 'skill', scope: 'self', tag: '폭탄',
    text: '체력 9 회복 후 즉시 내 턴 종료.', play: c => { c.heal(9); c.endTurn(); } },
  p35: { name: '응원받기', cost: 2, type: 'skill', scope: 'self', tag: '반격',
    text: '체력을 3 회복하고, 방어도 6. 쌀먹단 1을 얻는다.', play: c => { c.heal(3); c.block(6); c.gain('rice', 1); } },
  p55: { name: '전화찬스', cost: 1, type: 'skill', scope: 'self', tag: '연타',
    text: '카드 3장을 뽑는다.', play: c => c.draw(3) },
  p56: { name: '한잔의기적', cost: 2, type: 'skill', scope: 'self', tag: '반격', exhaust: true,
    text: '체력 8 회복. 만준 2를 얻는다. 사용하면 덱에서 사라진다.', play: c => { c.heal(8); c.gain('manjun', 2); } },
  p59: { name: '도발하기', cost: 0, type: 'skill', scope: 'self', tag: '폭탄', limit: 1,
    text: '치녀 2를 얻는다. 자신에게 피해 3. 한 턴에 1번.', play: c => { c.gain('str', 2); c.selfDamage(3, true); } },
  p70: { name: '계획대로', cost: 1, type: 'skill', scope: 'self', tag: '연타', limit: 1,
    text: '쉿 2를 얻는다. 카드 2장을 뽑는다. 한 턴에 1번.', play: c => { c.gain('hush', 2); c.draw(2); } },
  p74: { name: '마지막술잔', cost: 0, type: 'skill', scope: 'self', tag: '반격', limit: 1,
    text: '티~원 1을 얻는다. 한 턴에 1번.', play: c => c.gain('tione', 1) },
  p77: { name: '누워서회복', cost: 1, type: 'skill', scope: 'self', tag: '반격',
    text: '만준 2를 얻는다. 체력 3 회복.', play: c => { c.gain('manjun', 2); c.heal(3); } },
  p81: { name: '완전방전', cost: 0, type: 'skill', scope: 'self', tag: '폭탄',
    text: '보유한 에너지 x 3만큼 체력 회복 후 에너지를 0으로.', play: c => { c.heal(3 * c.me.energy); c.me.energy = 0; } },
  p83: { name: '전원집합', cost: 2, type: 'skill', scope: 'self', tag: '반격',
    text: '체력 5 회복, 방어도 5. 카드 1장을 뽑는다.', play: c => { c.heal(5); c.block(5); c.draw(1); } },

  // ── 방해 ──
  p36: { name: '수상한거래', cost: 1, type: 'skill', scope: 'one', tag: '방해',
    text: "대상의 버린 카드 더미에 '속이부글부글' 2장을 넣는다.", play: c => c.addCards(c.target, CURSE, 2, 'discard') },
  p37: { name: '숙제폭탄', cost: 2, type: 'skill', scope: 'others', tag: '방해',
    text: "모든 상대의 버린 카드 더미에 '속이부글부글' 1장씩 넣는다.", play: c => c.others().forEach(t => c.addCards(t, CURSE, 1, 'discard')) },
  p38: { name: '신분바꾸기', cost: 1, type: 'skill', scope: 'one', tag: '방해',
    text: '나와 대상의 방어도를 맞바꾼다.', play: c => c.swapBlock(c.target) },
  p40: { name: '시야차단', cost: 2, type: 'skill', scope: 'others', tag: '방해',
    text: '모든 상대에게 실명 2.', play: c => c.giveOthers('blind', 2) },
  p41: { name: '생각멈춤', cost: 2, type: 'skill', scope: 'one', tag: '방해',
    text: '대상에게 둔화 2. 대상의 다음 턴 에너지 1 감소.', play: c => { c.give(c.target, 'slow', 2); c.energyPenalty(c.target); } },
  p42: { name: '시끄러운방해', cost: 2, type: 'skill', scope: 'others', tag: '방해',
    text: '모든 대상의 반응 카드를 제거하고, 둔화 1', play: c => c.others().forEach(t => { c.stripReact(t); c.give(t, 'slow', 1); }) },
  p43: { name: '배터리없음', cost: 1, type: 'skill', scope: 'one', tag: '방해',
    text: '대상에게 예? 3. 카드 1장을 뽑는다.', play: c => { c.give(c.target, 'ye', 3); c.draw(1); } },
  p61: { name: '무언의압박', cost: 1, type: 'skill', scope: 'one', tag: '방해',
    text: '대상의 방어도를 모두 없애고 성능평가 2.', play: c => { c.stripBlock(c.target); c.give(c.target, 'weak', 2); } },
  p69: { name: '수상한칭찬', cost: 1, type: 'skill', scope: 'one', tag: '방해',
    text: "대상의 체력 3 회복. 대상의 버린 카드 더미에 '속이부글부글' 2장을 넣는다.",
    play: c => { c.healOther(c.target, 3); c.addCards(c.target, CURSE, 2, 'discard'); } },
  p75: { name: '빤히보기', cost: 1, type: 'skill', scope: 'one', tag: '방해',
    text: '대상에게 둔화 1. 카드 1장을 뽑는다.', play: c => { c.give(c.target, 'slow', 1); c.draw(1); } },
  p89: { name: '동맹', cost: 1, type: 'skill', scope: 'random', tag: '방해',
    text: '자신에게 피해 3. 무작위 대상에게도 피해 3.', play: c => { c.selfDamage(3); const t = c.randomAlive(false); if (t) c.attack(t, 3); } },

  // ── 추가 카드 91~140 · 공격 ──
  p91: { name: '지면 강타', cost: 1, type: 'atk', scope: 'one', tag: '연타',
    text: '피해 4. 둔화 1', play: c => { c.attack(c.target, 4); c.give(c.target, 'slow', 1); } },
  p92: { name: '날아차기', cost: 2, type: 'atk', scope: 'one', tag: '연타',
    text: '피해 9. 대상에게 둔화 1.', play: c => { c.attack(c.target, 9); c.give(c.target, 'slow', 1); } },
  p93: { name: '거기 너! 빵점!', cost: 1, type: 'atk', scope: 'one', tag: '방해',
    text: '대상의 방어도를 무시하고 피해 3, 에너지를 1 얻는다.', play: c => { c.attack(c.target, 3, { pierce: true }); c.gainEnergy(1); } },
  p94: { name: '박수 두번 시작!', cost: 1, type: 'atk', scope: 'others', tag: '방해',
    text: '모든 상대에게 피해 2를 2번 입히고, 성능평가 1', play: c => c.others().forEach(t => { c.attack(t, 2); c.attack(t, 2); c.give(t, 'weak', 1); }) },
  p95: { name: '스노우 보딩', cost: 1, type: 'atk', scope: 'random', tag: '연타',
    text: '무작위 상대에게 피해 5, 둔화 1', play: c => { const t = c.randomAlive(false); if (t) { c.attack(t, 5); c.give(t, 'slow', 1); } } },
  p96: { name: '국물해일', cost: 2, type: 'atk', scope: 'others', tag: '폭탄',
    text: '모든 상대에게 피해 5. 만준인 상대에게는 피해 +5.', play: c => c.others().forEach(t => c.attack(t, t.st.manjun ? 10 : 5)) },
  p97: { name: '새총 사냥', cost: 0, type: 'atk', scope: 'one', tag: '연타', limit: 2,
    text: '피해 2. 내가 치녀를 가지고 있으면 피해 +3. 한 턴에 2번까지.', play: c => c.attack(c.target, c.me.st.str ? 5 : 2) },
  p98: { name: '텐링즈', cost: 2, type: 'atk', scope: 'random', tag: '연타',
    text: '피해 1을 10번 동안 각각 무작위 대상에게 입힌다.', play: c => { for (let i = 0; i < 10; i++) { const t = c.randomAlive(false); if (t) c.attack(t, 1); } } },
  p99: { name: '키보드 배틀', cost: 2, type: 'atk', scope: 'one', tag: '연타',
    text: '피해를 2만큼 3번 입힌다. 이번 턴에 낸 카드 수가 3개 이상이라면 피해가 5로 증가한다.',
    play: c => { const d = c.playsThisTurn() >= 3 ? 5 : 2; for (let i = 0; i < 3; i++) c.attack(c.target, d); } },
  p101: { name: '종이폭풍', cost: 2, type: 'atk', scope: 'others', tag: '방해',
    text: '모든 상대에게 피해 3, 실명 2.', play: c => c.others().forEach(t => { c.attack(t, 3); c.give(t, 'blind', 2); }) },
  p102: { name: '불똥 튀기', cost: 1, type: 'atk', scope: 'random', tag: '폭탄',
    text: '나를 포함한 무작위 생존자에게 피해를 7 준다.', play: c => { const t = c.randomAlive(true); if (t === c.me) c.selfDamage(7); else if (t) c.attack(t, 7); } },
  p105: { name: '꼬X', cost: 2, type: 'atk', scope: 'random', tag: '폭탄',
    text: '부타 1을 얻은 뒤 무작위 상대에게 피해 4를 3번 준다.',
    play: c => { c.gain('buta', 1); for (let i = 0; i < 3; i++) { const t = c.randomAlive(false); if (t) c.attack(t, 4); } } },
  p137: { name: '대혼돈의 술자리', cost: 2, type: 'atk', scope: 'all', tag: '폭탄',
    text: '자신을 포함한 전원에게 피해 5, 낙원 1.', play: c => { c.attackOthers(5); c.selfDamage(5); c.gain('paradise', 1); c.giveOthers('paradise', 1); } },
  p138: { name: '둘이서눈싸움', cost: 1, type: 'atk', scope: 'one', tag: '방해',
    text: '피해 6. 대상과 나 모두 실명 2.', play: c => { c.attack(c.target, 6); c.give(c.target, 'blind', 2); c.gain('blind', 2); } },
  p140: { name: '깜!짝!파!티!', cost: 3, type: 'atk', scope: 'all', tag: '폭탄',
    text: '자신을 포함한 전원에게 피해 12.', play: c => { c.attackOthers(12); c.selfDamage(12); } },

  // ── 추가 카드 · 방어 ──
  p106: { name: '비의 인도자 윤', cost: 3, type: 'atk', scope: 'all', tag: '반격',
    text: '자신을 포함한 모두에게 피해 5, 이후 AI 2, 치녀 2', play: c => { c.attackOthers(5); c.selfDamage(5); c.gain('ai', 2); c.gain('str', 2); } },
  p107: { name: '베개요새', cost: 1, type: 'def', scope: 'self', tag: '반격',
    text: '방어도 11. 자신에게 둔화 1.', play: c => { c.block(11); c.gain('slow', 1); } },
  p108: { name: '멍석말이', cost: 1, type: 'def', scope: 'self', tag: '반격',
    text: '방어도 5. 다음 내 턴 시작 때 방어도가 사라지지 않는다.', play: c => { c.block(5); c.keepBlock(); } },
  p109: { name: '눈사람갑옷', cost: 2, type: 'def', scope: 'self', tag: '반격',
    text: '요이 2를 얻은 뒤 방어도 8.', play: c => { c.gain('dex', 2); c.block(8); } },
  p110: { name: '예측 회피', cost: 0, type: 'def', scope: 'self', tag: '반격', limit: 2,
    text: '방어도 4, 턴당 2회까지 사용 가능', play: c => c.block(4) },
  p111: { name: '이거 방탄 가방이야!', cost: 1, type: 'def', scope: 'self', tag: '연타',
    text: '방어도 5, 손에 있는 카드 수 x 2만큼 방어도를 추가 획득', play: c => c.block(5 + 2 * c.me.hand.length) },
  p113: { name: '안들리죠?', cost: 1, type: 'def', scope: 'self', tag: '반격',
    text: '방어도 5. 쉿 3을 얻는다.', play: c => { c.block(5); c.gain('hush', 3); } },
  p114: { name: '파초선', cost: 1, type: 'def', scope: 'others', tag: '반격',
    text: '방어도 3을 즉시 획득, 이후 자신을 제외한 모두에게 자신의 방어도만큼 피해', play: c => { c.block(3); const b = c.me.block; c.others().forEach(t => c.attack(t, b)); } },
  p128: { name: '이불 밖은 위험해!', cost: 2, type: 'def', scope: 'self', tag: '반격',
    text: '방어도 7. 만준 2를 얻는다.', play: c => { c.block(7); c.gain('manjun', 2); } },

  // ── 추가 카드 · 반응 ──
  p112: { name: '불주먹밥', cost: 1, type: 'react', scope: 'self', tag: '반격', react: { gain: { str: 2 } },
    text: '반응 설치: 다음에 공격 받으면, 치녀 2 획득' },
  p115: { name: '전파 방해', cost: 1, type: 'react', scope: 'self', tag: '반격', react: { gain: { ai: 2 } },
    text: '반응 설치: 다음 공격을 받으면, 자신에게 AI 2 부여' },
  p116: { name: '스윙', cost: 0, type: 'react', scope: 'self', tag: '반격', react: { swing: 3 },
    text: '반응 설치: 자신 이외의 대상이 피해를 입으면 즉시 그 대상에게 피해를 3 입힘' },
  p117: { name: '숟가락질', cost: 1, type: 'react', scope: 'self', tag: '방해', react: { reduce: 3, penalty: true },
    text: '반응 설치: 다음에 받는 공격의 피해를 3 줄이고, 공격자에게 둔화 1, 다음 턴 에너지 1 감소.' },
  p118: { name: '공간 전이', cost: 2, type: 'react', scope: 'self', tag: '반격', react: { redirect: true },
    text: '반응 설치: 다음에 자신을 대상으로 하는 카드를 무효화 시키고, 카드의 대상자를 무작위 대상으로 변경' },
  p119: { name: '고무고무', cost: 1, type: 'react', scope: 'self', tag: '방해', react: { reduce: 4, gain: { str: 1 } },
    text: '반응 설치: 다음에 받는 공격의 피해를 4 줄이고, 자신에게 치녀 1' },
  p120: { name: '무지개 안경', cost: 2, type: 'react', scope: 'self', tag: '반격', react: { reduce: 6, counter: 6 },
    text: '반응 설치: 다음에 받는 공격의 피해를 6 줄이고, 받은 뒤 공격자에게 피해 6.' },

  // ── 추가 카드 · 회복·기술 ──
  p103: { name: '도박', cost: 1, type: 'skill', scope: 'self', tag: '폭탄',
    text: '낙원 2를 얻는다. 카드 2장을 뽑는다.', play: c => { c.gain('paradise', 2); c.draw(2); } },
  p121: { name: '치즈 피자', cost: 2, type: 'skill', scope: 'self', tag: '반격',
    text: '체력 7 회복. 쌀먹단 1을 얻는다.', play: c => { c.heal(7); c.gain('rice', 1); } },
  p122: { name: '야식 라면', cost: 1, type: 'skill', scope: 'self', tag: '연타',
    text: '체력 4 회복. 카드 1장을 뽑는다.', play: c => { c.heal(4); c.draw(1); } },
  p123: { name: '고속 충전', cost: 1, type: 'skill', scope: 'self', tag: '연타', limit: 1,
    text: 'AI 2를 얻는다. 한 턴에 1번.', play: c => c.gain('ai', 2) },
  p124: { name: '쭉~ 쭉~', cost: 0, type: 'skill', scope: 'self', tag: '반격', limit: 1,
    text: '자신에게 있는 둔화를 모두 제거한다. 턴당 1회', play: c => c.gain('slow', -(c.me.st.slow || 0)) },
  p125: { name: '과자 파티', cost: 1, type: 'skill', scope: 'all', tag: '반격',
    text: '자신을 포함한 전원이 체력 5 회복. 나는 카드 1장을 뽑는다.', play: c => { c.heal(5); c.others().forEach(t => c.healOther(t, 5)); c.draw(1); } },
  p126: { name: '성사된 거래', cost: 0, type: 'skill', scope: 'self', tag: '폭탄', limit: 1,
    text: '에너지 2를 얻고, 무작위 대상에게 턴 시작 시 에너지 +2', play: c => { c.gainEnergy(2); const t = c.randomAlive(false); if (t) c.energyBonus(t, 2); } },
  p127: { name: '카페인 수혈', cost: 1, type: 'skill', scope: 'self', tag: '연타', limit: 1,
    text: '에너지 1을 얻고 카드 2장을 뽑는다. 자신에게 둔화 1. 한 턴에 1번.', play: c => { c.gainEnergy(1); c.draw(2); c.gain('slow', 1); } },
  p130: { name: '카드 마술', cost: 0, type: 'skill', scope: 'self', tag: '연타', limit: 1,
    text: '손패를 모두 버리고 버린 장수만큼 카드를 뽑는다. 턴마다 1회',
    play: c => { const n = c.me.hand.length; c.me.discard.push(...c.me.hand.splice(0)); c.draw(n); } },
  p139: { name: '선의의경쟁', cost: 3, type: 'skill', scope: 'all', tag: '반격',
    text: '자신을 포함한 모두에게 티~원 부여', play: c => [c.me, ...c.others()].forEach(t => c.give(t, 'tione', 1)) },

  // ── 추가 카드 · 방해 ──
  p100: { name: '허식 자', cost: 3, type: 'skill', scope: 'one', tag: '방해',
    text: '대상의 방어도와 모든 기믹을 제거한다.', play: c => { c.stripBlock(c.target); c.clearGimmicks(c.target); } },
  p104: { name: '방울 불기', cost: 2, type: 'skill', scope: 'one', tag: '방해',
    text: '대상에게 둔화 2, 실명 2.', play: c => { c.give(c.target, 'slow', 2); c.give(c.target, 'blind', 2); } },
  p129: { name: '시간아 멈춰라!', cost: 2, type: 'skill', scope: 'one', tag: '방해',
    text: '대상에게 둔화 2. 성능평가 2', play: c => { c.give(c.target, 'slow', 2); c.give(c.target, 'weak', 2); } },
  p131: { name: '은밀한 거래', cost: 1, type: 'skill', scope: 'one', tag: '방해',
    text: '대상에게 예? 2. 체력 3 회복.', play: c => { c.give(c.target, 'ye', 2); c.heal(3); } },
  p132: { name: '자석도둑', cost: 1, type: 'skill', scope: 'one', tag: '방해',
    text: '대상의 방어도 절반을 없애고, 자신에게 없앤만큼 방어도 부여',
    play: c => { const b = c.takeBlock(c.target, Math.floor(c.target.block / 2)); if (b) c.block(b); } },
  p133: { name: '꼼짝 마!', cost: 2, type: 'skill', scope: 'one', tag: '방해',
    text: '대상의 다음 턴 에너지 최대치를 1로 고정.', play: c => c.energyCap(c.target, 1) },
  p134: { name: '3단 고음', cost: 2, type: 'skill', scope: 'others', tag: '방해',
    text: '모든 상대의 반응 카드와 쉿을 없앤다. 카드 1장을 뽑는다.',
    play: c => { c.others().forEach(t => { c.stripReact(t); c.give(t, 'hush', -(t.st.hush || 0)); }); c.draw(1); } },
  p135: { name: '이게 왜 니꺼야.', cost: 1, type: 'skill', scope: 'one', tag: '방해',
    text: '나와 대상이 가진 기믹을 모두 맞바꾼다.',
    play: c => {
      const t = c.target, mine = { ...c.me.st }, theirs = { ...t.st };
      for (const [id, n] of Object.entries(mine)) c.gain(id, -n);
      for (const [id, n] of Object.entries(theirs)) c.give(t, id, -n);
      for (const [id, n] of Object.entries(theirs)) c.gain(id, n);
      for (const [id, n] of Object.entries(mine)) c.give(t, id, n);
    } },
  p136: { name: '종이비행정찰', cost: 1, type: 'skill', scope: 'one', tag: '방해',
    text: '대상의 반응 카드 1개를 제거한다.', play: c => c.stripReact(c.target) },

  // ── 방해 카드 (보상으로 나오지 않음) ──
  p79: { name: '속이부글부글', cost: 1, type: 'curse', scope: 'self', curse: true, exhaust: true, endInHand: 2,
    text: '사용하면 덱에서 사라진다. 턴이 끝날 때 손패에 있으면 자신에게 피해 2.', play: () => {} },
};

// 기본 카드: 시작 덱에 들어가고 라운드 보상으로는 나오지 않는다
const BASIC = ['p01', 'p17', 'p85', 'p04', 'p06', 'p13', 'p20', 'p31', 'p58'];
for (const id of BASIC) CARDS[id].basic = true;

for (const [id, c] of Object.entries(CARDS)) {
  c.id = id;
  c.photo ??= id;
  c.play ??= x => x.installReact();
}

// ── 등급 ──
// w: 라운드 보상에서 그 등급이 나올 비중. boost: 역전 배율.
// 역전: 카드를 쓸 때 내 체력이 살아 있는 다른 모든 사람보다 낮으면 이 카드의 피해·방어도·회복·기믹·드로우·에너지가 배율만큼 커진다 (자해는 그대로).
export const RARITY = {
  common: { name: '일반', w: 55 },
  rare: { name: '희귀', w: 30 },
  epic: { name: '영웅', w: 12, boost: 1.5 },
  legend: { name: '전설', w: 3, boost: 2 },
};
const LEGEND = ['p67', 'p12', 'p60', 'p68', 'p140', 'p106'];
const EPIC = ['p05', 'p11', 'p15', 'p63', 'p44', 'p92', 'p96', 'p98', 'p99', 'p56', 'p83', 'p139'];
for (const c of Object.values(CARDS)) {
  c.rarity = LEGEND.includes(c.id) ? 'legend' : EPIC.includes(c.id) ? 'epic' : c.cost >= 2 && !c.basic ? 'rare' : 'common';
}

// 시작 덱 12장: 공격 6, 방어 3, 반응 1, 회복 1, 카드 뽑기 1
export const STARTER = [
  'p01', 'p01', 'p01', 'p04', 'p06', 'p13', // 주먹부터 3, 눈덩이투척, 복도돌진, 마이크공격
  'p17', 'p17', 'p20', 'p58',               // 철벽팔뚝 2, 책상엄폐, 옆으로쏙
  'p31', 'p85',                             // 국물한입, 머리굴리는중
];

export const REWARD_POOL = Object.values(CARDS).filter(c => !c.basic && !c.curse).map(c => c.id);
