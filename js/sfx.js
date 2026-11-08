// 효과음과 배경음악. 파일 없이 Web Audio로 합성한다. 첫 터치/클릭 이후에 소리가 난다 (브라우저 자동재생 정책).
let ac = null, master = null, noiseBuf = null, musicGain = null;
const MUSIC_VOL = .2;
let muted = (() => { try { return localStorage.getItem('hp_mute') === '1'; } catch { return false; } })();
let musicOn = (() => { try { return localStorage.getItem('hp_music') !== '0'; } catch { return true; } })();

export const isMuted = () => muted;
export function setMuted(v) {
  muted = v;
  try { localStorage.setItem('hp_mute', v ? '1' : '0'); } catch {}
  if (master) master.gain.value = v ? 0 : .55;
}

export function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : .55;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp).connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    musicGain = ac.createGain();
    musicGain.gain.value = musicOn ? MUSIC_VOL : 0;
    musicGain.connect(master);
    setInterval(schedule, 25);
  }
  if (ac.state === 'suspended') ac.resume();
}

const ok = () => ac && !muted && ac.state === 'running';

// at: 절대 시각을 직접 줄 때 (배경음악 예약), out: 연결할 출력 (기본은 효과음)
function tone({ f = 440, f2 = f, type = 'sine', t = 0, at = null, dur = .15, vol = .3, attack = .005, out = master }) {
  const o = ac.createOscillator(), g = ac.createGain();
  const t0 = at ?? ac.currentTime + t;
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + dur + .02);
}

function noise({ t = 0, at = null, dur = .2, vol = .3, f = 1200, f2 = f, q = 1, type = 'bandpass', out = master }) {
  const s = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
  const t0 = at ?? ac.currentTime + t;
  s.buffer = noiseBuf;
  flt.type = type;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(f, t0);
  flt.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
  s.connect(flt).connect(g).connect(out);
  s.start(t0, Math.random() * .5);
  s.stop(t0 + dur + .02);
}

export const sfx = {
  // 피해량에 따라 묵직해지는 타격음
  hit(dmg = 6) {
    if (!ok()) return;
    const p = Math.min(1, dmg / 14);
    noise({ dur: .12 + p * .15, vol: .5 + p * .3, f: 2400 - p * 1200, f2: 300, q: .7 });
    tone({ f: 180 - p * 80, f2: 40, type: 'sine', dur: .18 + p * .2, vol: .7 + p * .3 });
    if (p > .6) tone({ f: 90, f2: 30, type: 'square', dur: .3, vol: .18, t: .01 });
  },
  blocked() {
    if (!ok()) return;
    tone({ f: 1400, f2: 900, type: 'triangle', dur: .25, vol: .25 });
    tone({ f: 2100, f2: 1500, type: 'sine', dur: .2, vol: .12, t: .01 });
    noise({ dur: .06, vol: .25, f: 5000, q: 2 });
  },
  shield() {
    if (!ok()) return;
    tone({ f: 300, f2: 620, type: 'triangle', dur: .28, vol: .22 });
    tone({ f: 600, f2: 1240, type: 'sine', dur: .3, vol: .1, t: .04 });
  },
  heal() {
    if (!ok()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone({ f, type: 'sine', dur: .25, vol: .14, t: i * .06 }));
  },
  whoosh() {
    if (!ok()) return;
    noise({ dur: .22, vol: .22, f: 400, f2: 2600, q: 1.5 });
  },
  card() {
    if (!ok()) return;
    noise({ dur: .08, vol: .18, f: 3000, q: 1 });
    tone({ f: 660, f2: 880, type: 'triangle', dur: .1, vol: .12 });
  },
  pickup() {
    if (!ok()) return;
    tone({ f: 500, f2: 700, type: 'triangle', dur: .07, vol: .1 });
  },
  undo() {
    if (!ok()) return;
    tone({ f: 800, f2: 400, type: 'triangle', dur: .14, vol: .14 });
  },
  react() {
    if (!ok()) return;
    tone({ f: 220, f2: 880, type: 'sawtooth', dur: .35, vol: .08 });
    [880, 1175, 1568].forEach((f, i) => tone({ f, type: 'sine', dur: .3, vol: .08, t: .05 + i * .05 }));
  },
  trigger() {
    if (!ok()) return;
    tone({ f: 1568, f2: 784, type: 'square', dur: .12, vol: .1 });
    tone({ f: 392, f2: 1568, type: 'sawtooth', dur: .25, vol: .1, t: .05 });
    noise({ dur: .18, vol: .2, f: 3000, f2: 800, q: 3, t: .05 });
  },
  debuff() {
    if (!ok()) return;
    tone({ f: 400, f2: 140, type: 'sawtooth', dur: .35, vol: .1 });
  },
  // 낙원 동전이 한 번 뒤집힐 때
  flip(hi = false) {
    if (!ok()) return;
    tone({ f: hi ? 1320 : 990, f2: hi ? 1100 : 820, type: 'triangle', dur: .05, vol: .08 });
  },
  // 낙원 결과: 좋으면 밝게 올라가고, 나쁘면 낮게 떨어진다
  luck(good) {
    if (!ok()) return;
    if (good) [784, 988, 1175, 1568].forEach((f, i) => tone({ f, type: 'triangle', dur: .22, vol: .14, t: i * .055 }));
    else { tone({ f: 330, f2: 110, type: 'sawtooth', dur: .45, vol: .14 }); tone({ f: 233, f2: 82, type: 'square', dur: .5, vol: .07, t: .04 }); }
  },
  dash() {
    if (!ok()) return;
    noise({ dur: .16, vol: .18, f: 800, f2: 3000, q: 2 });
  },
  // 카드 컷인: 빨려 올라가는 바람 소리 + 짧은 화음
  cutin() {
    if (!ok()) return;
    noise({ dur: .32, vol: .3, f: 300, f2: 4200, q: 1.2 });
    tone({ f: 220, f2: 440, type: 'sawtooth', dur: .22, vol: .08 });
    [440, 554, 659].forEach(f => tone({ f, type: 'square', dur: .16, vol: .05, t: .2 }));
  },
  // 회방: 유리 깨지는 소리 + 낮은 쿵
  ambush() {
    if (!ok()) return;
    noise({ dur: .4, vol: .45, f: 6000, f2: 1800, q: 1.5 });
    tone({ f: 80, f2: 30, type: 'sine', dur: .6, vol: .9, t: .02 });
    [1568, 1175, 784].forEach((f, i) => tone({ f, type: 'square', dur: .12, vol: .06, t: .05 + i * .07 }));
  },
  // 내려찍기: 묵직한 착지음
  slam() {
    if (!ok()) return;
    tone({ f: 110, f2: 35, type: 'sine', dur: .45, vol: .85 });
    noise({ dur: .35, vol: .45, f: 600, f2: 80, q: .6 });
  },
  // 에너지탄 발사
  zap() {
    if (!ok()) return;
    tone({ f: 900, f2: 300, type: 'sawtooth', dur: .22, vol: .08 });
    tone({ f: 1800, f2: 600, type: 'sine', dur: .2, vol: .08 });
    noise({ dur: .15, vol: .12, f: 4000, f2: 1500, q: 2 });
  },
  // 베기
  slash() {
    if (!ok()) return;
    noise({ dur: .14, vol: .3, f: 1800, f2: 6000, q: 3 });
    tone({ f: 2400, f2: 1200, type: 'triangle', dur: .1, vol: .06 });
  },
  // 치명타: 낮게 울리는 폭발음
  crit() {
    if (!ok()) return;
    tone({ f: 70, f2: 28, type: 'sine', dur: .7, vol: .9 });
    noise({ dur: .5, vol: .55, f: 900, f2: 60, q: .4 });
    tone({ f: 1760, f2: 440, type: 'sawtooth', dur: .18, vol: .08, t: .02 });
  },
  ko() {
    if (!ok()) return;
    tone({ f: 120, f2: 30, type: 'sine', dur: .9, vol: .9 });
    noise({ dur: .8, vol: .5, f: 1800, f2: 80, q: .5 });
    [784, 622, 523, 392].forEach((f, i) => tone({ f, type: 'square', dur: .18, vol: .08, t: .2 + i * .12 }));
  },
  turn() {
    if (!ok()) return;
    tone({ f: 660, type: 'triangle', dur: .12, vol: .18 });
    tone({ f: 990, type: 'triangle', dur: .2, vol: .18, t: .1 });
  },
  click() {
    if (!ok()) return;
    tone({ f: 900, f2: 700, type: 'triangle', dur: .05, vol: .08 });
  },
  win() {
    if (!ok()) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, type: 'triangle', dur: .35, vol: .16, t: i * .1 }));
  },
};

// ── 배경음악: 16분음표 단위 시퀀서 ──
const hz = m => 440 * 2 ** ((m - 69) / 12);
const MAJ = [0, 4, 7, 12, 16], MIN = [0, 3, 7, 12, 15];

const drum = {
  kick: at => tone({ f: 150, f2: 40, type: 'sine', at, dur: .16, vol: .9, out: musicGain }),
  snare: at => { noise({ at, dur: .12, vol: .35, f: 1800, q: .8, out: musicGain }); tone({ f: 220, f2: 140, type: 'triangle', at, dur: .08, vol: .2, out: musicGain }); },
  hat: (at, v = .08, dur = .03) => noise({ at, dur, vol: v, f: 8000, q: 1, type: 'highpass', out: musicGain }),
};

const TRACKS = {
  // 대기실·결과: 경쾌한 C장조 (C Am F G)
  lobby: {
    bpm: 104, bars: 4,
    chords: [[60, MAJ], [57, MIN], [53, MAJ], [55, MAJ]],
    lead: [
      [2, , , 1, , 0, , , 1, , 2, , 3, , , ,],
      [3, , 2, , 1, , 2, , 0, , , , 1, , 0, ,],
    ],
    step(i, at, sp) {
      const bar = Math.floor(i / 16) % this.bars, s = i % 16;
      const [root, q] = this.chords[bar];
      if (s === 0) q.slice(0, 3).forEach(n => tone({ f: hz(root + n), type: 'triangle', at, dur: sp * 15, vol: .05, attack: .08, out: musicGain }));
      if ([0, 6, 8, 14].includes(s)) tone({ f: hz(root - 12 + (s === 6 || s === 14 ? 7 : 0)), type: 'triangle', at, dur: sp * 1.8, vol: .32, out: musicGain });
      const li = this.lead[bar % 2][s];
      if (li !== undefined) tone({ f: hz(root + 12 + q[li]), type: 'square', at, dur: sp * 1.6, vol: .06, out: musicGain });
      if (s === 0 || s === 8 || (s === 10 && bar === 3)) drum.kick(at);
      if (s === 4 || s === 12) drum.snare(at);
      if (s % 2 === 0) drum.hat(at, .05);
    },
  },
  // 전투: 빠르고 긴장감 있는 A단조 (Am F G E)
  battle: {
    bpm: 148, bars: 4,
    chords: [[57, MIN], [53, MAJ], [55, MAJ], [52, MAJ]],
    arp: [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 4, 3, 2, 1],
    step(i, at, sp) {
      const bar = Math.floor(i / 16) % this.bars, s = i % 16;
      const [root, q] = this.chords[bar];
      if (s % 2 === 0) tone({ f: hz(root - 24 + (s % 4 === 2 ? 12 : 0)), type: 'square', at, dur: sp * 1.5, vol: .12, out: musicGain });
      tone({ f: hz(root + 12 + q[this.arp[s]]), type: 'square', at, dur: sp * .8, vol: .035, out: musicGain });
      if (s === 0) tone({ f: hz(root + 24), f2: hz(root + 24) * .98, type: 'sawtooth', at, dur: sp * 6, vol: .035, attack: .02, out: musicGain });
      if (s % 4 === 0) drum.kick(at);
      if (s === 4 || s === 12) drum.snare(at);
      if (bar === 3 && s >= 12) drum.snare(at);
      drum.hat(at, s % 4 === 2 ? .09 : .04, s % 4 === 2 ? .08 : .03);
    },
  },
};

let want = null, track = null, step = 0, nextT = 0;

function schedule() {
  if (!ac || ac.state !== 'running') return;
  if (want !== track) {
    track = want;
    step = 0;
    nextT = ac.currentTime + .1;
  }
  // 백그라운드 탭에서는 예약하지 않는다 (돌아오면 이어서)
  if (!track || !musicOn || muted || document.hidden) { nextT = ac.currentTime + .1; return; }
  if (nextT < ac.currentTime - .1) nextT = ac.currentTime + .05;
  const T = TRACKS[track], sp = 60 / T.bpm / 4;
  while (nextT < ac.currentTime + .15) {
    T.step(step, nextT, sp);
    step = (step + 1) % (16 * T.bars);
    nextT += sp;
  }
}

export const music = {
  play(name) { want = TRACKS[name] ? name : null; },
  isOn: () => musicOn,
  setOn(v) {
    musicOn = v;
    try { localStorage.setItem('hp_music', v ? '1' : '0'); } catch {}
    if (musicGain) musicGain.gain.setTargetAtTime(v ? MUSIC_VOL : 0, ac.currentTime, .05);
  },
};
