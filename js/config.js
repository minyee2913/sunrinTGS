// Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹)에서 복사한 값을 넣는다.
// apiKey가 비어 있으면 같은 브라우저의 탭끼리만 연결되는 로컬 테스트 모드로 실행된다.
export const FIREBASE = {
  apiKey: '',
  authDomain: '',
  databaseURL: '',
  projectId: '',
  appId: '',
};

// Realtime Database 안에서 이 게임이 쓰는 최상위 경로
export const ROOT = 'hp';

export const RULES = {
  maxHp: 40,
  energy: 3,
  drawPerTurn: 5,
  handMax: 10,
  turnMs: 30000,
  pickMs: 15000,
  minPlayers: 3,
  maxPlayers: 6,
  removeEvery: 3,     // N라운드마다 카드 제거 기회
  minDeck: 5,         // 제거 후 덱이 이보다 작아지지 않게
  suddenRound: 6,     // 이 라운드부터 회복 절반 + 라운드 종료 피해
  suddenBase: 2,
  hostGraceMs: 20000, // 게임 중 호스트가 끊긴 뒤 종료까지 기다리는 시간
  lobbyGraceMs: 4000,
  logKeep: 40,
};
