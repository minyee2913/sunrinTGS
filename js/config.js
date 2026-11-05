// Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹)에서 복사한 값을 넣는다.
// apiKey가 비어 있으면 같은 브라우저의 탭끼리만 연결되는 로컬 테스트 모드로 실행된다.
export const FIREBASE = {
  apiKey: 'AIzaSyA-GTFedyW3vlQdoypWQqzGCYHQoQ5-K-c',
  authDomain: 'sunrintgs.firebaseapp.com',
  databaseURL: 'https://sunrintgs-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'sunrintgs',
  appId: '1:30624952216:web:4604a839fa34212d5305ed',
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
  minPlayers: 2,
  removeEvery: 3,     // N라운드마다 카드 제거 기회
  removeOfferDeck: 20, // 덱이 이 장수 이상인 사람에게만 제거 기회를 준다
  minDeck: 5,         // 제거 후 덱이 이보다 작아지지 않게
  suddenRound: 6,     // 이 라운드부터 회복 절반 + 라운드 종료 피해
  suddenBase: 2,
  hostGraceMs: 20000, // 게임 중 호스트가 끊긴 뒤 종료까지 기다리는 시간
  lobbyGraceMs: 4000,
  voteMs: 30000,      // 호스트 요청 투표가 열려 있는 시간
  logKeep: 40,
  replayBaseMs: 900,  // 턴 종료 전투 연출: 기본 시간 + 카드 1장당 시간, 최대 시간
  replayPerMs: 1250,
  replayMaxMs: 9000,
};
