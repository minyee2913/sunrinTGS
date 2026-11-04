// 통신 계층. Firebase Realtime Database와 로컬 테스트용(같은 브라우저 탭끼리) 구현이 같은 모양을 가진다.
//   on(path, cb, onErr) → 구독 해제 함수     get(path)     set(path, v)
//   update({ 'a/b': v, ... })          transaction(path, fn) → 반영 여부
//   presence(path) → 접속 중에만 path=true, 해제 함수 반환
//   now() → 서버 기준 시각(ms)
import { FIREBASE, ROOT } from './config.js';

export const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export async function createNet() {
  const q = new URLSearchParams(location.search);
  if (FIREBASE.apiKey && !q.has('local')) return firebaseNet();
  return localNet(q.get('p') || '');
}

async function firebaseNet() {
  const V = '10.12.2';
  const [{ initializeApp }, A, D] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`),
  ]);
  const app = initializeApp(FIREBASE);
  const auth = A.getAuth(app);
  await auth.authStateReady();
  const user = auth.currentUser || (await A.signInAnonymously(auth)).user;
  const db = D.getDatabase(app);
  const r = p => D.ref(db, p ? `${ROOT}/${p}` : ROOT);

  let offset = 0;
  D.onValue(D.ref(db, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });

  return {
    mode: 'firebase',
    uid: user.uid,
    now: () => Date.now() + offset,
    on: (path, cb, onErr) => D.onValue(r(path), s => cb(s.val()), e => {
      console.warn('구독 실패', path, e.message);
      onErr?.(e);
    }),
    get: async path => (await D.get(r(path))).val(),
    set: (path, v) => D.set(r(path), v),
    update: up => D.update(r(''), up),
    async transaction(path, fn) {
      // 서버가 받아들인 뒤에만 반영되도록 (권한이 아직 없는데 호스트로 동작하지 않게)
      const res = await D.runTransaction(r(path), cur => fn(cur), { applyLocally: false });
      return res.committed;
    },
    presence(path) {
      const off = D.onValue(D.ref(db, '.info/connected'), s => {
        if (!s.val()) return;
        D.onDisconnect(r(path)).remove().then(() => D.set(r(path), true));
      });
      return async () => {
        off();
        await D.onDisconnect(r(path)).cancel();
        await D.remove(r(path));
      };
    },
  };
}

// ── 로컬 테스트 모드: localStorage 하나를 DB처럼 쓰고 storage 이벤트로 다른 탭에 알린다 ──
function localNet(slot) {
  const KEY = 'hp_localdb';
  const idKey = 'hp_local_uid' + slot;
  let uid = sessionStorage.getItem(idKey);
  if (!uid) {
    uid = 'L' + rid();
    sessionStorage.setItem(idKey, uid);
  }
  const keys = p => p.split('/').filter(Boolean);
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  const getAt = (t, p) => keys(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] ?? null : null), t);
  const setAt = (t, p, v) => {
    const ks = keys(p);
    let o = t;
    for (const k of ks.slice(0, -1)) {
      if (!o[k] || typeof o[k] !== 'object') o[k] = {};
      o = o[k];
    }
    if (v == null) delete o[ks.at(-1)];
    else o[ks.at(-1)] = JSON.parse(JSON.stringify(v));
  };
  // Firebase처럼 빈 객체는 사라진다
  const clean = o => {
    if (!o || typeof o !== 'object') return o;
    for (const k of Object.keys(o)) {
      o[k] = clean(o[k]);
      if (o[k] == null || (typeof o[k] === 'object' && !Object.keys(o[k]).length)) delete o[k];
    }
    return o;
  };
  const write = fn => {
    const t = load();
    const ok = fn(t);
    if (ok === false) return false;
    localStorage.setItem(KEY, JSON.stringify(clean(t)));
    notify();
    return true;
  };

  const listeners = new Set();
  let scheduled = false;
  const notify = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      const t = load();
      for (const l of listeners) {
        const j = JSON.stringify(getAt(t, l.path));
        if (j !== l.last) {
          l.last = j;
          l.cb(JSON.parse(j));
        }
      }
    });
  };
  addEventListener('storage', e => { if (e.key === KEY) notify(); });

  const net = {
    mode: 'local',
    uid,
    now: () => Date.now(),
    on(path, cb) {
      const l = { path, cb, last: undefined };
      listeners.add(l);
      notify();
      return () => listeners.delete(l);
    },
    get: async path => getAt(load(), path),
    set: async (path, v) => { write(t => setAt(t, path, v)); },
    update: async up => { write(t => { for (const [p, v] of Object.entries(up)) setAt(t, p, v); }); },
    async transaction(path, fn) {
      return write(t => {
        const nv = fn(getAt(t, path));
        if (nv === undefined) return false;
        setAt(t, path, nv);
      });
    },
    presence(path) {
      net.set(path, true);
      const bye = () => write(t => setAt(t, path, null));
      addEventListener('pagehide', bye);
      return async () => {
        removeEventListener('pagehide', bye);
        bye();
      };
    },
  };
  return net;
}
