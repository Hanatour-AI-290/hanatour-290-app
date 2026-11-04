# API 계약

기본 주소: `http://localhost:8787/api` (배포: `https://hanatour-290.vercel.app/api`) · 데이터 형식은 `packages/shared/src/schemas.js` 기준.
금액은 최소 단위 정수 (EUR 12.30 → `1230`, TRY 600.00 → `60000`, KRW 5,000 → `5000`).
괄호 안 R-xx · FR-xxx 는 요구사항 정의서 번호 (FR-001 = R-01).

| 메서드 | 경로                                | 하는 일                                  | 상태   |
| ------ | ----------------------------------- | ---------------------------------------- | ------ |
| GET    | `/health`                           | 서버 확인                                | 완료   |
| POST   | `/estimate`                         | 상품 문구 → 따로 내는 비용 항목 + 환율 (R-01) | 완료 (프로토타입) |
| POST   | `/record`                           | 사진 · 카드 문자 · 말 → 지출 하나 (R-15·16·18) | 완료 (프로토타입) |
| GET    | `/fx`                               | 결제일 환율 (R-20)                       | 완료   |
| POST   | `/settle`                           | 지출 목록 → 통화별 정산 · 원화 합계 (R-06·12·19·20) | 완료   |
| POST   | `/settle/wallets`                   | 확인 끝난 지출 · 현금 주고받기 → 지갑 차감 (R-05·12·13) | 완료   |
| POST   | `/settle/wallets/replay`            | 처음 지갑부터 확인 끝난 지출 · 현금 주고받기를 다시 계산 (R-05·12·13) | 완료   |
| POST   | `/settle/day`                       | 하루 끝 요약 · 이 속도면 모자라는 금액 (R-23) | 완료   |
| POST   | `/settle/duplicates`                | 새 지출과 비슷한 기존 지출 → "같은 결제인가요?" (R-14) | 완료   |
| POST   | `/budget`                           | 상품 분석 결과 → 하루 예산 (R-03)        | 완료   |
| POST   | `/report`                           | 예상 vs 실제 · 진짜 총비용 (R-22)        | 완료   |
| GET    | `/trips`                            | 여행 목록                                | 뼈대   |
| GET    | `/trips/:tripId`                    | 여행 하나                                | 뼈대   |
| POST   | `/trips`                            | 여행 만들기                              | 할 일  |
| GET    | `/trips/:tripId/records`            | 지출 목록                                | 뼈대   |
| POST   | `/trips/:tripId/records`            | 지출 저장                                | 할 일  |
| POST   | `/trips/:tripId/receipts/analyze`   | 사진 + 말 → 줄 단위 · 배정 · 검증 결과  | 받는 쪽 완료 · AI 대기 (지금은 501) |

`/settle*` · `/budget` · `/report` 는 서버에 저장하지 않고 **보낸 데이터로 계산만** 한다.
Vercel 함수는 요청마다 메모리가 비워질 수 있고, 시연은 한 기기에서 한다 (요구사항 AVL-004). 지출·지갑 데이터는 화면이 들고 있다.

## 오류 응답

모든 오류는 `{ "error": "사용자에게 보여 줄 문장" }` 모양이다.

| 상태 | 뜻 | 덧붙는 값 |
| ---- | -- | --------- |
| 400 | 보낸 값의 형식이 틀림 | JSON 본문 API: `issues` 예) `["days: Invalid input: expected number, received undefined"]` |
| 404 | 찾는 것이 없음 (환율 등) | |
| 413 | 사진이 너무 큼 | |
| 422 | 형식은 맞지만 앞뒤가 안 맞음 | `errors` (틀린 점 목록) |
| 502 | AI 호출 실패 | |
| 503 | AI 사용 한도 초과 (`AI 사용 한도를 넘었어요`) | 화면은 직접 입력으로 넘긴다 |
| 429 | AI 요청이 많음 | |
| 502 | AI 호출 실패 | |

## 값 목록

| 이름            | 값                                                                 |
| --------------- | ------------------------------------------------------------------ |
| `PaymentMethod` | `card` 카드 · `cash` 현금                                          |
| `Category`      | `식사` · `선택관광` · `교통` · `쇼핑` · `팁` · `기타` (`/record` 응답의 `category` 와 같은 값) |
| 줄 `kind`       | `item` 메뉴 (기본) · `tax` 세금 (배정하지 않고 몫 비율대로 나눔)   |
| 확인 `status`   | `pending` 확인 전 (기본) · `confirmed` 맞아요 · `declined` 안 갔어요 |

## 로컬에 AI 키가 없을 때

`.env` 에 `ANTHROPIC_API_KEY` 가 비어 있고 `AI_UPSTREAM`(예: `https://hanatour-290.vercel.app/api`)이 있으면, `/estimate` · `/record` 요청을 그 주소로 그대로 넘긴다 (`apps/api/src/lib/upstream.js`). 키가 있으면 넘기지 않는다. 영수증 줄 단위 분석은 넘기지 않는다 (배포본에 아직 없음).

## POST /estimate

요청 `{ "text": "상품 문구 (10~8000자)" }`
응답 `{ "title", "base_price_krw", "items": [{ "name", "category", "amount", "currency", "required", "evidence" }], "fx": { "date", "krw": { "EUR": 1580.2 } } | null }`

## POST /record

요청 `{ "text"?: "말 한 줄 (500자 이하)", "image"?: "data:image/jpeg;base64,...", "kind"?: "sms", "members": ["지우", ...], "me": "지우" }`
응답 `{ "name", "category", "amount", "currency", "payer", "payers": [], "people": [], "evidence" }` - 팀원 이름이 아닌 payer·payers·people 은 서버가 버린다.
`payers` 는 결제자들 `[{ name, amount }]` (소수, FR-008). 한 명이면 총액, 금액을 모르는 사람이 한 명이면 나머지 금액, 둘 이상이면 amount null. 화면은 두 명 이상이고 금액을 다 알 때만 나눠 낸 것으로 넣는다.

이 응답을 정산에 쓰려면 화면이 `Expense` 로 바꿔서 `/settle` 에 보낸다.
`amount` 는 소수(예: `620`) 이므로 최소 단위로 바꾸고 (`62000`), `payer` → `payers`, `people` → `memberIds` (이름 → 멤버 id).

## GET /fx

결제일 환율 (R-20). 외화 1 단위가 몇 원인지.

요청 `GET /api/fx?currency=TRY&date=2026-11-01` (`date` 를 비우면 최신)

응답

```json
{ "currency": "TRY", "rate": 26.754, "date": "2026-11-01", "source": "Frankfurter" }
```

- 먼저 Frankfurter v2 (유럽중앙은행 등, 170개 통화, 과거 날짜 무료). 결제일 값이 없으면(미래 날짜) 최신 값
- 거기에도 없는 통화는 ExchangeRate-API 최신 값. 이때 응답에 `"attribution": "Rates By Exchange Rate API"` 가 붙고, **화면에 이 문구를 표시해야 한다** (이용 조건)
- 응답의 `date` 는 요청한 날과 다를 수 있다. 화면에는 `1 TRY = 26.75원 (2026-11-01, Frankfurter)` 처럼 응답의 `date` · `source` 를 그대로 보여 준다
- 받은 값은 지출의 `fx` 칸에 `{ rate, date, source }` 로 넣는다

## POST /settle

지출 목록 → 통화별 정산 (R-06, R-12, R-19, R-20). 계산 규칙 (요구사항 PER-003):

1. 기본은 1/N. `memberIds` 가 비면 정산방 전원, 있으면 그 사람끼리
2. 영수증 줄(`lines`)이 있으면 줄마다 `splits` 에 적힌 사람끼리, 배정이 없는 줄은 1번의 사람끼리
3. 세금 줄(`kind: "tax"`)과 줄 합계에 안 잡힌 금액은 각자 몫 비율대로
4. `confirmations` 에서 `declined`(안 갔어요) 인 사람은 빼고 다시 나눈다
5. 통화별로 따로 계산한다 (원화로 묶지 않음)
6. 최소 단위로 내림하고, 남는 금액은 가장 많이 낸 결제자가 부담한다

요청

```json
{
  "members": [{ "id": "m1", "name": "지우" }, { "id": "m2", "name": "하린" }, { "id": "m3", "name": "도윤" }, { "id": "m4", "name": "서준" }],
  "expenses": [
    {
      "id": "e1", "tripId": "t1", "category": "식사",
      "payers": [{ "memberId": "m1", "amount": 120000, "method": "card" }],
      "total": { "amount": 120000, "currency": "TRY" },
      "lines": [
        { "name": "Adana Kebap", "nameKo": "아다나 케밥", "qty": 4, "unitPrice": 20000, "total": 80000 },
        { "name": "Efes Bira", "nameKo": "에페스 맥주", "qty": 2, "unitPrice": 15000, "total": 30000 },
        { "name": "KDV", "nameKo": "부가세", "kind": "tax", "unitPrice": 10000, "total": 10000 }
      ],
      "splits": [{ "lineIndex": 1, "memberIds": ["m2", "m3"], "source": "맥주는 하린이랑 도윤" }],
      "confirmations": [{ "memberId": "m2", "status": "confirmed" }, { "memberId": "m3", "status": "confirmed" }, { "memberId": "m4", "status": "confirmed" }],
      "paidAt": "2026-11-05T20:00:00+03:00",
      "fx": { "rate": 26.754, "date": "2026-11-05", "source": "Frankfurter" },
      "createdAt": "2026-11-05T20:05:00+03:00"
    },
    {
      "id": "e2", "tripId": "t1", "category": "선택관광",
      "payers": [{ "memberId": "m3", "amount": 18000, "method": "card" }],
      "total": { "amount": 18000, "currency": "EUR" },
      "memberIds": ["m1", "m2", "m3"],
      "createdAt": "2026-11-06T10:00:00+03:00"
    }
  ]
}
```

응답 (위 요청을 실제로 보낸 결과)

```json
{
  "byCurrency": {
    "TRY": {
      "shares": { "m1": 21820, "m2": 38181, "m3": 38181, "m4": 21818 },
      "paid":   { "m1": 120000, "m2": 0, "m3": 0, "m4": 0 },
      "net":    { "m1": 98180, "m2": -38181, "m3": -38181, "m4": -21818 },
      "transfers": [
        { "fromId": "m2", "toId": "m1", "amount": 38181 },
        { "fromId": "m3", "toId": "m1", "amount": 38181 },
        { "fromId": "m4", "toId": "m1", "amount": 21818 }
      ]
    },
    "EUR": {
      "shares": { "m1": 6000, "m2": 6000, "m3": 6000, "m4": 0 },
      "paid":   { "m1": 0, "m2": 0, "m3": 18000, "m4": 0 },
      "net":    { "m1": -6000, "m2": -6000, "m3": 12000, "m4": 0 },
      "transfers": [{ "fromId": "m1", "toId": "m3", "amount": 6000 }, { "fromId": "m2", "toId": "m3", "amount": 6000 }]
    }
  },
  "krw": { "m1": { "share": 5838, "paid": 32105 }, "m2": { "share": 10215, "paid": 0 }, "m3": { "share": 10215, "paid": 0 }, "m4": { "share": 5837, "paid": 0 } },
  "pendingIds": [],
  "missingFx": ["e2"]
}
```

| 칸 | 뜻 | 화면에서 |
| -- | -- | -------- |
| `shares` | 사람별 몫 (그 통화 최소 단위) | 가계부 "내 몫" (R-19) |
| `paid` | 사람별로 낸 돈 | |
| `net` | `paid - shares`. 양수 = 받을 돈, 음수 = 보낼 돈. 합은 항상 0 | "받을 돈" (R-19) |
| `transfers` | 누가 누구에게 얼마 보내면 끝나는지 | 정산 화면 |
| `krw` | 사람별 원화 합계 (지출마다 그 지출의 `fx` 로 환산) | 원화 합계 (R-20) |
| `pendingIds` | 아직 확인(맞아요/안 갔어요)이 남은 지출 | "확인 대기" 표시 |
| `missingFx` | `fx` 가 없어서 원화 합계에서 빠진 외화 지출 | `/fx` 로 환율을 받아 다시 보낸다 |

위 예에서 TRY 몫: 케밥 80,000 은 4명이 20,000씩, 맥주 30,000 은 하린·도윤이 15,000씩 → 메뉴 몫 합 110,000. 세금까지 120,000 을 같은 비율로 늘리면 21,818.18 · 38,181.81 … → 내림 후 남는 2(0.02 TRY)는 결제자 지우가 부담.

검사 (422 + `errors`, R-09 의 계산 부분)

- 결제자가 낸 금액 합 = 총액
- 줄이 있으면 줄 합계 = 총액
- `splits` 의 줄 번호가 있는 줄이고, 세금 줄이 아님
- 결제자 · 나눌 사람 · 배정된 사람 · 확인한 사람이 모두 `members` 안에 있음
- "안 갔어요" 를 빼고 나눌 사람이 한 명 이상 남음

```json
{ "error": "지출 기록이 앞뒤가 맞지 않아요", "errors": ["e1: 결제자가 낸 금액 합 100000 ≠ 총액 120000"] }
```

## POST /settle/wallets

확인이 끝난 지출 하나, 또는 현금 주고받기 하나를 지갑에 반영한다 (R-05, R-12, R-13). 앱 안의 기록상 차감이고 실제 송금이 아니다.
보낸 지갑은 바꾸지 않고, 반영된 새 지갑을 돌려준다. 화면은 받은 `wallets` 로 바꿔 끼운다.

요청 `{ "members": [...], "wallets": [Wallet, ...], "expense": Expense }` 또는 `{ "members", "wallets", "cashTransfer": CashTransfer }`

**지출 반영 규칙**

1. `confirmations` 에 `pending` 이 남아 있으면 반영하지 않는다 → `"applied": false`
2. 결제자: 낸 금액만큼 그 결제 수단(`card`/`cash`) 잔액에서 빠진다
3. 참여자: 자기 몫을 **카드 잔액**에서 결제자 카드 잔액으로 옮긴다 (`moves`)
4. 카드 잔액이 모자라면 옮기지 않고 `shortages` 로 돌려준다 → 화면은 나와 결제자에게 "잔액 부족" 을 알리고, 현금으로 주고받기(`CashTransfer`)를 만든다

위 `/settle` 예의 e1 을, 서준(m4) 카드 잔액이 TRY 50.00 인 상태로 보낸 응답:

```json
{
  "applied": true,
  "wallets": [
    { "memberId": "m1", "balances": [{ "amount": 256362, "currency": "TRY", "method": "card" }, { "amount": 100000, "currency": "TRY", "method": "cash" }] },
    { "memberId": "m2", "balances": [{ "amount": 261819, "currency": "TRY", "method": "card" }, { "amount": 100000, "currency": "TRY", "method": "cash" }] },
    { "memberId": "m3", "balances": [{ "amount": 261819, "currency": "TRY", "method": "card" }, { "amount": 100000, "currency": "TRY", "method": "cash" }] },
    { "memberId": "m4", "balances": [{ "amount": 5000, "currency": "TRY", "method": "card" }, { "amount": 100000, "currency": "TRY", "method": "cash" }] }
  ],
  "moves": [
    { "fromId": "m2", "toId": "m1", "amount": 38181, "currency": "TRY" },
    { "fromId": "m3", "toId": "m1", "amount": 38181, "currency": "TRY" }
  ],
  "shortages": [{ "memberId": "m4", "toId": "m1", "currency": "TRY", "need": 21818, "have": 5000 }]
}
```

**현금 주고받기 반영 규칙**: `given`(줬어요) · `received`(받았어요) 가 둘 다 `true` 일 때만 준 사람 현금 잔액 → 받은 사람 현금 잔액. 아니면 `"applied": false`.

같은 지출을 두 번 보내면 두 번 빠진다. 반영했는지는 화면이 기억한다 (서버에 저장하지 않으므로).

## POST /settle/wallets/replay

화면이 쓰는 지갑 계산. 시연 시작 지갑(환전 직후)에서 출발해 지출을 차례로 반영하고, 모자란 몫은 현금 주고받기로 만든다.
지출을 고치면 처음부터 다시 계산하면 되므로, 어떤 지출을 이미 반영했는지 화면이 기억하지 않아도 된다.

요청 `{ "members": [...], "wallets": [처음 지갑], "expenses": [...], "cashStatus": { "e1:m3": { "given": true, "received": false } } }`

응답

```json
{
  "wallets": [...],
  "applied": ["e1"],
  "pending": ["e2"],
  "moves": [{ "expenseId": "e1", "fromId": "m2", "toId": "m1", "amount": 118666, "currency": "TRY" }],
  "cashTransfers": [{ "id": "e1:m3", "expenseId": "e1", "fromId": "m3", "toId": "m1", "money": { "amount": 118666, "currency": "TRY" }, "have": 30000, "given": true, "received": false, "tripId": "t1", "createdAt": "..." }]
}
```

- `pending`: 확인 대기(`pending`)가 남아 아직 반영하지 않은 지출
- `cashTransfers`: 카드 잔액이 모자라 현금으로 주고받아야 하는 건. id 는 `지출 id:보낼 사람 id`. `cashStatus` 에서 `given` · `received` 가 둘 다 `true` 인 건만 현금 잔액에 반영
- 원화(KRW) 지출은 화면이 보내지 않는다 (지갑은 환전해 둔 외화만)

## POST /settle/day

하루 끝 요약 (R-23). "오늘 4.2만 원 · 리라 1,200 남음", "이 속도면 마지막 날 리라 300 부족해요" 에 쓴다.

요청 `{ "members": [...], "memberId": "m1", "expenses": [...], "wallets": [...], "date": "2026-11-05", "day": 2, "days": 9 }`
(`date` = 오늘, `day` = 오늘이 여행 며칠째인지 1부터, `days` = 전체 일수)

응답

```json
{
  "date": "2026-11-05", "day": 2, "days": 9, "daysLeft": 7,
  "todayKrw": 12000, "todayCount": 1,
  "byCurrency": [{ "currency": "TRY", "balance": 120000, "spent": 60000, "perDay": 30000, "need": 210000, "shortfall": 90000 }],
  "missingFx": []
}
```

| 칸 | 뜻 |
| -- | -- |
| `todayKrw` · `todayCount` | 오늘(`paidAt`, 없으면 `createdAt` 의 날짜) 지출 중 내 몫의 원화 합계 · 건수 |
| `balance` | 내 지갑 잔액 (카드 + 현금) |
| `spent` | 오늘까지 그 통화로 쓴 내 몫 |
| `perDay` · `need` | `spent ÷ day` · `perDay × 남은 일수` |
| `shortfall` | `need - balance` (모자라지 않으면 0). 0 보다 크면 "이 속도면 … 부족해요" |

## POST /settle/duplicates

새로 올라온 지출과 비슷한 기존 지출을 찾는다 (R-14). 화면은 후보가 있으면 "같은 결제인가요?" 를 묻는다.

요청 `{ "expense": Expense, "expenses": [Expense, ...], "amountRate"?: 0.01, "minutes"?: 30 }`

후보 기준: 같은 통화 · 금액 차이가 `amountRate`(기본 1%) 이하 · 결제 시각 차이가 `minutes`(기본 30분) 이하.
`merchant`(가게 이름)가 양쪽에 다 있으면 대소문자·띄어쓰기·기호를 빼고 한쪽이 다른 쪽을 포함해야 한다. 한쪽이라도 없으면 금액·시각만 본다.

응답 `{ "duplicates": [{ "id": "e1", "amountDiff": 300, "minutesApart": 2, "sameMerchant": true }] }` (`sameMerchant: null` = 가게 이름을 비교하지 못함)

## POST /match/plan

새 기록(카드 문자 · 말 · 영수증)이 일정의 예정 항목(선택관광 · 경비)과 같은 지출인지 후보를 찾는다. 화면은 후보가 있으면 "‘카파도키아 열기구 투어’ 예정 지출인가요?" 를 묻고, 사용자가 "맞아요" 를 누를 때만 일정 항목을 "했다" 로 바꾼다.
Claude 를 부르지 않는다. 이름 비교는 서버 안의 문장 임베딩 모델(`Xenova/multilingual-e5-small`), 통화 · 금액과 후보 결정은 `packages/shared/src/match.js` 규칙.

요청
```json
{
  "record": { "text": "괴레메 열기구 투어", "amount": 320, "currency": "EUR", "people": 1 },
  "items": [
    { "idx": 1, "name": "카파도키아 열기구 투어", "aliases": ["열기구", "hot air balloon", "balon turu"], "amount": 320, "currency": "EUR" },
    { "idx": 5, "name": "지프 사파리", "amount": null, "currency": null }
  ]
}
```
- `record.text`: 기록 이름 (화면은 Claude 가 만든 `name`, 1~500자). `amount` 는 화면 단위(소수)
- `items`: 아직 "했다" 가 아니고 예산에 넣은 일정 항목 (최대 50개). `idx` = `/estimate` 의 `items` 번호, `aliases` = `/estimate` 가 만든 다른 이름 (최대 12개, 길면 잘라 씀)
- 이름 비교 전에 "투어" 같은 흔한 말을 양쪽에서 빼고, 항목은 이름 · 별칭 중 가장 가까운 값을 쓴다

응답 `{ "candidates": [{ "idx": 1, "score": 0.922, "sim": 0.902, "amountMatch": true }], "model": "Xenova/multilingual-e5-small" }`

| 규칙 | 값 |
| --- | --- |
| 통화 | 둘 다 아는데 다르면 후보에서 뺀다 |
| 금액 일치 (`amountMatch`) | 기록 금액 = 항목 1인 금액 또는 × 인원 (1% 이내) → 점수 +0.02 |
| 후보 조건 | 점수 0.87 이상, 2등과 0.01 이상 차이 (애매하면 묻지 않는다), 이름 유사도 0.86 이상 (금액만 같은 다른 가게는 잇지 않는다) |

- 후보는 0개 또는 1개. 모델을 못 불러오면 `{ "candidates": [], "model": null }` (기록 흐름을 막지 않음)
- 첫 호출은 모델을 받느라 느리다 (Vercel 측정 6.9초, 이후 0.4초)

## POST /budget

하루 예산 (R-03) = (예상 비용에 넣은 항목의 1인 금액 합 + 하루 생활비 × 일수) ÷ 일수.

요청 `{ "estimate": /estimate 응답 그대로, "picks": [1, 3], "days": 9, "livingPerDayKrw": 50000 }`

- `picks`: 사용자가 고른 항목 번호 (`estimate.items` 순서)
- 예상 비용에 넣는 항목: `required: true` 인 항목(싱글차지 빼고) + `picks` (프로토타입과 같은 기준)
- `livingPerDayKrw`: 하루 생활비. 근거 데이터가 없는 **예시 값**이므로 화면에 "예시 값" 이라고 표시한다 (R-03)

응답 (열기구 320유로를 고르고 EUR 1,491.758원, 9일, 생활비 5만 원)

```json
{ "days": 9, "extraKrw": 477363, "livingPerDayKrw": 50000, "livingIsExample": true, "perDayKrw": 103040, "unknownItems": [], "fxDate": "2026-10-30" }
```

- `unknownItems`: 금액이나 환율을 몰라 빠진 항목 번호 → 화면에 "금액 미정"

## POST /report

여행 후 리포트 (R-22). 진짜 총비용 = 상품가 + 현지에서 쓴 내 몫. 원화 기준.

요청 `{ "estimate": /estimate 응답, "picks": [...], "members": [...], "memberId": "m1", "expenses": [...] }`

- 예상: `/budget` 과 같은 항목의 1인 금액
- 실제: 지출마다 `/settle` 과 같은 규칙으로 나눈 내 몫을 그 지출의 `fx` 로 환산
- 실제 지출의 항목: `planItem`(일정에서 기록한 상품 분석 항목 번호)이 있으면 그 항목의 분류, 없으면 지출의 `category`
- 분류 → 항목: `불포함 식사` → `식사`, `싱글차지` · 모르는 값 → `기타`

응답 (상품가 124만 원, 항목 0 가이드 경비 10만 원(필수) · 1 열기구 320유로 · 2 유람선 60유로, EUR 1,500원, `picks: [1, 2]`.
지출: 열기구 4명분 1,280유로를 지우가 결제(`planItem: 1`), 저녁 600리라 4명 1/N (TRY 40원). 지우(m1) 기준)

```json
{
  "rows": [
    { "key": "상품가", "predicted": 1240000, "actual": 1240000 },
    { "key": "선택관광", "predicted": 570000, "actual": 480000 },
    { "key": "가이드·기사 경비", "predicted": 100000, "actual": 0 },
    { "key": "식사", "predicted": 0, "actual": 6000 },
    { "key": "교통", "predicted": 0, "actual": 0 },
    { "key": "쇼핑", "predicted": 0, "actual": 0 },
    { "key": "팁", "predicted": 0, "actual": 0 },
    { "key": "기타", "predicted": 0, "actual": 0 }
  ],
  "predictedTotal": 1910000,
  "actualTotal": 1726000,
  "unrecordedItems": [0, 2],
  "extraCount": 1,
  "unknownItems": [],
  "missingFx": []
}
```

| 칸 | 뜻 |
| -- | -- |
| `actualTotal` | 진짜 총비용 (상품가 포함) |
| `unrecordedItems` | 예상에 넣었는데 아직 기록(`planItem` 연결)이 없는 항목 → "아직 기록 안 한 예정 지출 N건" |
| `extraCount` | 예상에 없던 지출 건수 (내 몫이 있는 것만) |

## POST /trips/:tripId/receipts/analyze

`runPipeline`(영수증 줄 단위 읽기 → 검사 틀리면 1회 다시 읽기 → 말로 줄별 배정 → 남은 오류는 질문)을 부른다.
2026-11-04 기준 해커톤 키의 작업공간 사용 한도가 차서 실제 호출은 503 으로 실패하고, 성공 응답은 아직 실호출로 확인하지 못했다.

요청 (multipart): `image` 파일 (jpg · png · webp · gif, 3MB 이하), `utterance` 문자열 (500자 이하), `members` JSON 문자열 `[{"id":"m1","name":"지우"}, ...]`, `me` 올린 사람 이름 (선택, 기본 첫 멤버)

응답에는 아래 예시 외에 `payerId`(첫 결제자 id, 없으면 null), `payers`(결제자들 `[{ memberId, amount }]`, 금액은 최소 단위, 여러 명이 금액을 말하지 않았으면 amount null + 질문, FR-008)와 `retried`(다시 읽었는지)가 더 붙는다. `receipt` 에는 `merchant` · `paidAt` · `category`(식사·선택관광·교통·쇼핑·팁·기타, FR-018) 도 있다.

응답 예시:

```json
{
  "receipt": {
    "lines": [
      { "name": "Efes Bira", "nameKo": "에페스 맥주", "kind": "item", "qty": 2, "unitPrice": 500, "total": 1000, "source": "EFES BIRA 2 x 5.00" },
      { "name": "KDV", "nameKo": "부가세", "kind": "tax", "qty": 1, "unitPrice": 80, "total": 80, "source": "KDV 0.80" }
    ],
    "total": 1080,
    "currency": "EUR"
  },
  "splits": [{ "lineIndex": 0, "memberIds": ["m1", "m2"], "source": "맥주는 하린이랑 도윤" }],
  "questions": [{ "lineIndex": 0, "field": "memberIds", "text": "맥주를 마신 사람이 하린·도윤 맞나요?" }],
  "check": { "ok": true, "errors": [] }
}
```

- `lines[].source`: 영수증에서 읽은 원문, `splits[].source`: 배정 근거가 된 말 원문 (확인 카드에 줄마다 표시)
- `questions`: AI 가 모르는 칸. 비어 있지 않으면 확인 카드에 질문으로 띄운다
- `check.errors`: 규칙 검사(AI 안 씀)에서 남은 오류. 줄 합계 ≠ 합계, 결제자 금액 합 ≠ 합계, 수량 × 단가 ≠ 줄 금액, 없는 줄·세금 줄에 배정, 같은 줄 두 번 배정, 낼 사람 없는 배정, 명단에 없는 멤버. 남은 오류는 `questions` 에도 붙는다. `splits` 에 없는 줄은 기본 1/N 이라 오류가 아니다

## Expense (지출 한 건)

`/settle` · `/settle/wallets` 요청에 들어가는 지출. (`POST /trips/:tripId/records` 를 만들면 같은 모양)

```json
{
  "id": "e1",
  "tripId": "t1",
  "payers": [
    { "memberId": "m1", "amount": 440000, "method": "cash" },
    { "memberId": "m3", "amount": 560000, "method": "card" }
  ],
  "total": { "amount": 1000000, "currency": "PHP" },
  "lines": [],
  "splits": [],
  "memberIds": [],
  "confirmations": [
    { "memberId": "m2", "status": "confirmed" },
    { "memberId": "m4", "status": "declined" }
  ],
  "category": "식사",
  "paidAt": "2026-11-30T19:20:00+08:00",
  "fx": { "rate": 23.9, "date": "2026-11-30", "source": "Frankfurter" },
  "createdAt": "2026-11-30T19:25:00+08:00"
}
```

| 칸 | 필수 | 뜻 |
| -- | ---- | -- |
| `payers` | O (1명 이상) | 결제자별 낸 금액·수단. 합 = `total.amount` |
| `total` | O | 총액 (최소 단위) + 통화 |
| `lines` | | 영수증 줄. 비면 줄 없이 1/N |
| `splits` | | 줄마다 나눌 사람 (`lineIndex` = `lines` 순서) |
| `memberIds` | | 나눌 사람. 비면 정산방 전원 (기본 1/N) |
| `confirmations` | | 지목된 사람의 확인. `declined` 는 빼고 다시 나눈다 |
| `category` | | 값 목록의 `Category` |
| `merchant` | | 가게 이름 (영수증 · 카드 문자). 중복 결제 찾기에 씀 |
| `planItem` | | 일정에서 기록한 지출이면 `/estimate` 의 `items` 번호. 리포트 예상 vs 실제에 씀 |
| `paidAt` | | 결제 시각. 이 날짜로 `/fx` 를 부른다 |
| `fx` | | 결제일 환율. 없으면 원화 합계에서 빠진다 (`missingFx`) |

## Wallet (내 지갑)

```json
{
  "memberId": "m1",
  "balances": [
    { "amount": 1200000, "currency": "TRY", "method": "cash" },
    { "amount": 30000, "currency": "EUR", "method": "card" }
  ]
}
```

- 통화 + 결제 수단(`card`/`cash`)마다 잔액 하나. 시연은 이미 환전된 상태에서 시작한다 (R-05)

## CashTransfer (현금으로 주고받기)

```json
{
  "id": "c1", "tripId": "t1", "fromId": "m2", "toId": "m1",
  "money": { "amount": 60000, "currency": "TRY" },
  "given": true, "received": false,
  "createdAt": "2026-11-30T21:00:00+03:00"
}
```

- 준 사람이 `given`, 받은 사람이 `received` 를 누른다. 둘 다 `true` 여야 끝 (`/settle/wallets` 로 반영)
