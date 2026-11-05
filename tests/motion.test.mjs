import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const load = async path => import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL(path, import.meta.url))).toString('base64'));
const { createMotion, spriteFrames, SPRITE_ROWS } = await load('../js/motion.js');
const { CHARACTERS, charSVG } = await load('../js/chars.js');

test('every character renders its own sheet and keeps a separate static head portrait', async () => {
  const paths = new Set();
  for (let i = 0; i < CHARACTERS.length; i++) {
    const character = CHARACTERS[i];
    await access(new URL('../' + character.sheet, import.meta.url));
    paths.add(character.sheet);
    const full = charSVG({ c: i, hair: 0, face: 0, acc: 0 });
    assert.ok(full.includes(character.sheet));
    assert.ok(full.includes('sprite-frames'));
    assert.ok(!charSVG({ c: i, hair: 0, face: 0, acc: 0 }, { head: true }).includes('sprite-frames'));
  }
  assert.equal(paths.size, 16);
});

function fighter(style = 'punch') {
  const classes = new Set();
  const animations = [];
  const sprite = {
    animate(keys, options) {
      let finish, reject;
      const animation = { keys, options, cancelled: false,
        finished: new Promise((r, j) => { finish = r; reject = j; }),
        finish() { finish(); },
        cancel() { this.cancelled = true; reject(new Error('cancelled')); },
      };
      animations.push(animation);
      return animation;
    },
  };
  return { dataset: { attack: style }, classList: { contains: c => classes.has(c), add: c => classes.add(c) },
    querySelector: () => sprite, animations };
}

test('all 16 characters play four drawn frames on the correct row and return to idle', async () => {
  for (const character of CHARACTERS) {
    const motion = createMotion({ reduced: () => false });
    const el = fighter(character.motion);
    for (const state of ['attack', 'guard', 'hit', 'heal', 'cast']) {
      const pending = motion.play(el, state);
      const animation = el.animations.at(-1);
      assert.equal(el.dataset.motion, state);
      assert.equal(new Set(animation.keys.map(k => k.backgroundPosition)).size, 4);
      assert.ok(animation.keys.every(k => k.backgroundPosition.endsWith(`${SPRITE_ROWS[state] / 5 * 100}%`)));
      assert.ok(animation.keys.every(k => !('transform' in k)));
      assert.ok(animation.keys.slice(0, 4).every(k => k.easing === 'steps(1, end)'));
      assert.equal(animation.options.easing, 'linear');
      animation.finish();
      await pending;
      assert.equal(el.dataset.motion, undefined);
    }
  }

});

test('hit interrupts attack; lower priority actions cannot erase hit; stale cleanup cannot erase new state', async () => {
  const motion = createMotion({ reduced: () => false });
  const el = fighter();
  const attack = motion.play(el, 'attack');
  const hit = motion.play(el, 'hit');
  assert.ok(el.animations[0].cancelled);
  const heal = motion.play(el, 'heal');
  await attack;
  assert.equal(el.dataset.motion, 'hit');
  assert.equal(el.animations.length, 2);
  el.animations[1].finish();
  await Promise.all([hit, heal]);
  assert.equal(el.dataset.motion, undefined);
});

test('KO wins over hit, stays down and cleans up on replay stop', async () => {
  const motion = createMotion({ reduced: () => false });
  const el = fighter();
  const hit = motion.play(el, 'hit');
  const down = motion.play(el, 'down');
  el.classList.add('down');
  await motion.play(el, 'attack');
  assert.equal(el.animations.length, 2);
  el.animations[1].finish();
  await Promise.all([hit, down]);
  assert.equal(el.dataset.motion, 'down');
  motion.stop();
  assert.equal(el.dataset.motion, undefined);
  assert.ok(el.animations[1].cancelled);
});

test('stop cancels every active fighter and late completion is harmless', async () => {
  const motion = createMotion({ reduced: () => false });
  const a = fighter(), b = fighter('hop');
  const pending = [motion.play(a, 'attack'), motion.play(b, 'heal')];
  motion.stop();
  const next = motion.play(a, 'guard');
  await Promise.all(pending);
  assert.equal(a.dataset.motion, 'guard');
  assert.equal(b.dataset.motion, undefined);
  a.animations.at(-1).finish();
  await next;
});

test('reduced motion selects one drawn pose; replay speed scales action duration', async () => {
  const normal = createMotion({ speed: .5, reduced: () => false });
  const reduced = createMotion({ reduced: () => true });
  const a = fighter(), b = fighter();
  const pending = [normal.play(a, 'attack'), reduced.play(b, 'hit')];
  assert.equal(a.animations[0].options.duration, 210);
  assert.equal(new Set(b.animations[0].keys.map(k => k.backgroundPosition)).size, 1);
  assert.ok(b.animations[0].keys.every(k => !('transform' in k)));
  a.animations[0].finish(); b.animations[0].finish();
  await Promise.all(pending);
});

test('frame coordinates select exact sheet cells and KO holds the final drawing', () => {
  assert.deepEqual(spriteFrames('attack').map(k => k.backgroundPosition), ['0% 20%', '33.33333333333333% 20%', '66.66666666666666% 20%', '100% 20%', '100% 20%']);
  assert.equal(spriteFrames('down').at(-1).backgroundPosition, '100% 100%');
  assert.equal(spriteFrames('down', true)[0].backgroundPosition, '100% 100%');
});
