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
  turnMs: 40000,
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
  replayBaseMs: 1000, // 턴 종료 전투 연출: 기본 시간 + 카드 1장당 시간, 최대 시간 (넘으면 빨라진다)
  replayPerMs: 1900,
  replayMaxMs: 13000,
  // 돈
  startGold: 10,
  roundGold: 3,       // 라운드가 끝날 때마다 살아 있는 사람에게 주는 돈
  sellMinDeck: 4,     // 덱이 이 장수 이하면 카드를 팔 수 없다
  exRate: { hp: 1, gold: 1, en: 3 }, // 환전 가치: 에너지 1 = 체력 3 = 돈 3
  exEnergyMax: 3,     // 한 턴에 환전으로 얻을 수 있는 에너지
  shopSize: 4,        // 상점에 놓이는 카드 수 (라운드마다 새로 채운다)
  price: { common: 4, rare: 7, epic: 12, legend: 20 },
  sellRate: 0.5,      // 팔 때는 산 값의 절반 (내림, 최소 1)
  tradeMs: 20000,     // 거래 제안에 답할 시간
  tradePerTurn: 3,    // 한 턴에 할 수 있는 거래 제안 수
};
