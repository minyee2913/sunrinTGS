// 호스트 판정기. 활성 호스트 탭 하나에서만 돈다.
// 요청은 한 번에 하나씩 순서대로 처리하고, 결과 상태·개인 정보·처리한 요청 삭제를 한 번의 update로 반영한다.
import { createGame, handleRequest, tick, publicView, privateView, provisional } from './engine.js';
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
    this.listenReq();
    this.timer = setInterval(() => this.enqueue(() => this.onTick()), 400);
  }

  // 호스트 권한이 서버에 반영되기 전에 구독하면 거부되므로 다시 시도한다
  listenReq() {
    this.offReq = this.net.on('req', all => this.onReqs(all || {}), () => {
      if (this.timer) this.retry = setTimeout(() => this.listenReq(), 1500);
    });
  }

  stop() {
    clearTimeout(this.retry);
    this.offReq?.();
    clearInterval(this.timer);
    this.G = null;
  }

  // 호스트를 넘기기 전에: 새 요청은 그만 받고, 이미 받은 요청은 끝까지 처리해서 hs에 남긴다
  async halt() {
    clearTimeout(this.retry);
    this.offReq?.();
    clearInterval(this.timer);
    this.timer = null;
    await this.q;
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
      // 같은 update 안에서 priv와 priv/<uid>를 함께 쓸 수 없어서 이전 판 데이터는 먼저 지운다
      await this.net.update({ priv: null, req: null });
      await this.commit({ 'meta/status': 'playing', 'meta/gameId': gameId, 'meta/notice': null });
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
    // 호스트 요청·투표는 판과 상관없이 app이 처리한다
    if (r.gameId === 'host') {
      this.onHostReq?.(uid, r);
      return this.net.update(del);
    }
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
    const prov = provisional(G);
    for (const uid of G.order) {
      const s = JSON.stringify(privateView(G, uid, prov));
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
