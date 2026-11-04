// 호스트 판정기. 활성 호스트 탭 하나에서만 돈다.
// 요청은 한 번에 하나씩 순서대로 처리하고, 결과 상태·개인 정보·처리한 요청 삭제를 한 번의 update로 반영한다.
import { createGame, handleRequest, tick, publicView, privateView } from './engine.js';
import { rid } from './net.js';

export class Host {
  constructor(net) {
    this.net = net;
    this.G = null;
    this.q = Promise.resolve();
    this.seen = new Set();
    this.sent = {};
    this.offReq = null;
    this.timer = null;
  }

  async start(meta) {
    if (meta.status === 'playing') {
      const hs = await this.net.get('hs');
      if (hs && hs.gameId === meta.gameId) this.G = JSON.parse(hs.s);
      else await this.toLobby('게임 정보를 복구하지 못해 대기실로 돌아왔어요');
    }
    this.offReq = this.net.on('req', all => this.onReqs(all || {}));
    this.timer = setInterval(() => this.enqueue(() => this.onTick()), 400);
  }

  stop() {
    this.offReq?.();
    clearInterval(this.timer);
    this.G = null;
  }

  enqueue(fn) {
    this.q = this.q.then(fn).catch(e => console.error('호스트 처리 오류', e));
    return this.q;
  }

  startGame(players) {
    return this.enqueue(async () => {
      const gameId = 'g' + rid();
      this.G = createGame({ gameId, players, seed: (Math.random() * 2 ** 31) | 0, now: this.net.now() });
      this.sent = {};
      await this.commit({
        'meta/status': 'playing', 'meta/gameId': gameId, 'meta/notice': null,
        priv: null, req: null,
      });
    });
  }

  onReqs(all) {
    for (const [uid, list] of Object.entries(all)) {
      for (const [reqId, r] of Object.entries(list || {})) {
        if (this.seen.has(reqId)) continue;
        this.seen.add(reqId);
        this.enqueue(() => this.handle(uid, reqId, r));
      }
    }
  }

  handle(uid, reqId, r) {
    const del = { [`req/${uid}/${reqId}`]: null };
    if (!this.G) return this.net.update(del);
    handleRequest(this.G, uid, reqId, r, this.net.now());
    return this.commit(del);
  }

  onTick() {
    if (!this.G || this.G.phase === 'ended') return;
    if (tick(this.G, this.net.now())) return this.commit();
  }

  commit(extra = {}) {
    const G = this.G;
    const up = { ...extra };
    const pub = JSON.stringify(publicView(G));
    if (pub !== this.sent.pub) up.pub = { gameId: G.gameId, s: pub };
    for (const uid of G.order) {
      const s = JSON.stringify(privateView(G, uid));
      if (s !== this.sent[uid]) up[`priv/${uid}`] = { gameId: G.gameId, s };
    }
    up.hs = { gameId: G.gameId, s: JSON.stringify(G) };
    return this.net.update(up).then(() => {
      if (up.pub) this.sent.pub = pub;
      for (const uid of G.order) if (up[`priv/${uid}`]) this.sent[uid] = up[`priv/${uid}`].s;
    });
  }

  // 다시 하기 / 비정상 종료: 판 데이터를 지우고 대기실로. 접속이 끊긴 참가자는 목록에서 정리한다.
  toLobby(notice = null, lobby = {}) {
    return this.enqueue(async () => {
      this.G = null;
      this.sent = {};
      const up = {
        'meta/status': 'lobby', 'meta/gameId': null, 'meta/notice': notice,
        pub: null, priv: null, req: null, hs: null,
      };
      for (const [uid, m] of Object.entries(lobby)) if (!m.conn) up[`lobby/${uid}`] = null;
      await this.net.update(up);
    });
  }
}
