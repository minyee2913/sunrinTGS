// 직접 그린 스프라이트의 칸을 교체한다. 필드 이동은 replay.js가 처리한다.
const PRIORITY = { cast: 1, heal: 2, attack: 3, guard: 4, hit: 5, down: 6 };
// Sheet rows: idle, attack, hit, guard, heal, down. Casting reuses the attack row.
export const SPRITE_ROWS = { idle: 0, attack: 1, hit: 2, guard: 3, heal: 4, cast: 1, down: 5 };
export function spriteFrames(state, reduced = false) {
  const row = SPRITE_ROWS[state];
  const sequence = reduced ? [state === 'down' ? 3 : 2] : [0, 1, 2, 3];
  const frame = col => ({ backgroundPosition: `${col / 3 * 100}% ${row / 5 * 100}%` });
  if (reduced) return [frame(sequence[0]), frame(sequence[0])];
  return [...sequence.map((col, i) => ({ ...frame(col), offset: i / 4, easing: 'steps(1, end)' })), { ...frame(3), offset: 1 }];
}

export function createMotion({ speed = 1, reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false } = {}) {
  const active = new Map();
  function play(fighter, state) {
    const sprite = fighter?.querySelector('.sprite-frames');
    if (!sprite || !PRIORITY[state]) return Promise.resolve();
    if (state !== 'down' && fighter.classList.contains('down')) return Promise.resolve();
    const current = active.get(fighter);
    if (current && PRIORITY[current.state] > PRIORITY[state]) return current.animation.finished.catch(() => {});
    current?.animation.cancel();
    fighter.dataset.motion = state;
    const less = reduced();
    const duration = { attack: 420, hit: 300, guard: 420, heal: 540, cast: 420, down: 750 }[state];
    const keys = spriteFrames(state, less);
    const animation = sprite.animate(keys, {
      duration: Math.max(70, (less ? 160 : duration) * speed),
      easing: 'linear', fill: state === 'down' ? 'forwards' : 'none',
    });
    const record = { state, animation };
    active.set(fighter, record);
    return animation.finished.catch(() => {}).then(() => {
      if (active.get(fighter) !== record) return;
      if (state !== 'down') {
        delete fighter.dataset.motion;
        active.delete(fighter);
      }
    });
  }
  function stop() {
    for (const [fighter, { animation }] of active) {
      animation.cancel();
      delete fighter.dataset.motion;
    }
    active.clear();
  }
  return { play, stop };
}

// 일반 효과 표시용. 리플레이는 별도 컨트롤러를 사용한다.
export const liveMotion = createMotion();
