# 카드 사진

이 폴더에 `<카드ID>.jpg`(또는 `.png`, `.webp`) 파일을 넣으면 해당 카드 그림으로 나온다.
파일이 없으면 이모지가 대신 보인다. 세로 5:7 비율 카드의 윗부분(약 40%)에 꽉 차게 잘려 들어가므로 가로로 조금 긴 사진이 잘 맞는다. 한 장당 200KB 이하를 권장한다.

같은 사진을 여러 카드에 쓰려면 `js/cards.js`에서 카드에 `photo: '파일이름'`을 지정한다.
예: `jab: { ..., photo: 'p01' }` → `img/cards/p01.jpg`

| 카드ID | 이름 | | 카드ID | 이름 |
| --- | --- | --- | --- | --- |
| jab | 툭 치기 | | whyme | 왜 나만 |
| eating | 먹는 중 건들지 마 | | groupshot | 다 같이 망하자 |
| peek | 폰 보기 | | kamikaze | 물귀신 |
| combo | 딱밤 한 대 더 | | bomb | 폭탄주 |
| flick | 손가락 튕기기 | | yolo | 잃을 게 없다 |
| rush | 몰아치기 | | nap | 나 안 함 |
| coffee | 아아 수혈 | | gimme | 일단 내놔 |
| stretch | 허리펴라! | | snitch | 일러바치기 |
| glare | 방금 뭐라 했냐? | | spam | 단톡 폭탄 |
| ignore | 읽씹 | | alarm | 새벽 알람 |
| mirror | 반사 | | steal | 간식 뺏기 |
| wall | 이불 밖은 위험해 | | hyeonta | 현타 (방해 카드) |
