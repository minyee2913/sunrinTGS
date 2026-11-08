// 돈: 환전 비율, 상점 가격. 엔진과 화면이 함께 쓴다.
import { CARDS } from './cards.js';
import { RULES } from './config.js';

export const EX_NAMES = { hp: '체력', en: '에너지', gold: '돈' };

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// from k묶음을 주면 to를 받는다. 1묶음 = from give개 → to get개 (가치가 같게, 가장 작은 정수로)
export function exRate(from, to) {
  const v = RULES.exRate, g = gcd(v[from], v[to]);
  return { give: v[to] / g, get: v[from] / g };
}

export const buyPrice = id => RULES.price[CARDS[id].rarity] ?? RULES.price.common;
export const sellPrice = id => (CARDS[id].curse ? 0 : Math.max(1, Math.floor(buyPrice(id) * RULES.sellRate)));
