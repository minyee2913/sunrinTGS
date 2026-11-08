import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const motionSource = await readFile(new URL('../js/motion.js', import.meta.url), 'utf8');
const { createMotion } = await import('data:text/javascript;base64,' + Buffer.from(motionSource).toString('base64'));
// Run the real replay loop with only DOM, sound, particle rendering and clock adapters replaced.
const source = (await readFile(new URL('../js/replay.js', import.meta.url), 'utf8')).replace(/^import .*;\r?$/gm, '').replace('export function playReplay', 'function playReplay');
const makeReplay = new Function('deps', `const {CARDS,cardName,CURSE,cardHTML,hiddenCardHTML,replayMs,V,sfx,createMotion,document,setTimeout}=deps;\n${source}\nreturn playReplay;`);

function setup(timer = fn => { queueMicrotask(fn); }) {
  const actions = [];
  function element(uid = '', x = 0) {
    const classes = new Set();
    const animations = [];
    const rect = { left: x, top: 0, width: 120, height: 160, bottom: 160 };
    const el = { dataset: { attack: uid === 'a' ? 'punch' : 'cast' }, style: {},
      classList: { add: c => classes.add(c), remove: (...cs) => cs.forEach(c => classes.delete(c)), contains: c => classes.has(c), toggle() {} },
      getBoundingClientRect: () => rect,
      animate(keys, opts) { const animation = { finished: Promise.resolve(), cancel() {} }; animations.push(animation); return animation; },
      getAnimations: () => animations, remove() {}, appendChild() {},
    };
    const sprite = { animate(keys, opts) { actions.push([uid, el.dataset.motion]); return el.animate(keys, opts); } };
    const hp = { style: {}, classList: el.classList, textContent: '' };
    el.querySelector = selector => selector === '.sprite-frames' ? sprite : selector === '.f-body' ? el : hp;
    return el;
  }
  const a = element('a', 0), b = element('b', 500);
  const field = element();
  field.querySelector = selector => selector.includes('"a"') ? a : selector.includes('"b"') ? b : null;
  field.querySelectorAll = () => [a, b];
  const silent = new Proxy({}, { get: () => () => {} });
  const playReplay = makeReplay({ CARDS: {}, cardName: id => id, CURSE: 'p79', cardHTML: () => '', hiddenCardHTML: () => '', replayMs: () => 900,
    V: silent, sfx: silent, createMotion, document: { createElement: () => element() }, setTimeout: timer });
  const options = { field, shakeEl: field, players: { a: { maxHp: 40 }, b: { maxHp: 40 } }, nameOf: u => u };
  return { playReplay, options, actions, a, b };
}

test('real replay events drive attacker, defender, healing, casting and KO motion', async () => {
  const { playReplay, options, actions } = setup();
  const replay = playReplay({ by: 'a', plays: [{ k: 'card', t: 'atk', by: 'a', id: 'p01', fx: [
    { k: 'dmg', u: 'b', s: 'a', v: 5, h: 35 }, { k: 'block', u: 'b', v: 7 },
    { k: 'heal', u: 'a', v: 3 }, { k: 'react', u: 'a' }, { k: 'trigger', u: 'b', v: 'react' },
    { k: 'nullify', u: 'b' }, { k: 'debuff', u: 'b', v: 'slow' },
    { k: 'gimmick', u: 'a', kind: 'buff', v: 'buff' }, { k: 'ko', u: 'b' },
  ] }] }, options);
  await replay.finished;
  for (const pair of [['a','attack'], ['b','hit'], ['b','guard'], ['a','heal'], ['a','cast'], ['b','down']]) {
    assert.ok(actions.some(([u,state]) => u === pair[0] && state === pair[1]), pair.join(':'));
  }
});

test('stopping replay while its initial wait is pending prevents subsequent actions', async () => {
  const timers = [];
  const { playReplay, options, actions } = setup(fn => timers.push(fn));
  const replay = playReplay({ by:'a', plays:[{ k:'card', t:'atk', by:'a', id:'p01', fx:[{k:'dmg',u:'b',s:'a',v:8}] }] }, options);
  replay.stop();
  await replay.finished;
  timers.forEach(fn => fn());
  await new Promise(resolve => queueMicrotask(resolve));
  assert.deepEqual(actions, []);
});
