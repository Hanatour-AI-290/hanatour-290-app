# 백엔드 MVP 계획

기준: 요구사항정의서_밍글링정산.pdf (2026-11-04) · 브랜치 `feat/be` (프로토타입 합친 상태, 커밋 `8aee0e5`) 위에서 작업.
BE 범위는 `apps/api`, `packages/shared` (CONTRIBUTING.md). AI 호출 코드(`packages/ai`)는 AI 담당.

## 1. 원칙

- **읽는 건 AI, 계산은 규칙 (R-24, PER-002)**: 나누기 · 환산 · 차감은 `packages/shared/src/settle.js` 의 함수만 한다. 같은 입력이면 항상 같은 결과.
- **계산 규칙 (PER-003)**: 1/N + 줄별 배정, 세금은 몫 비율대로, 통화별로 따로, 남는 금액은 낸 사람이 부담.
- **저장하지 않는다 (AVL-004)**: 시연은 한 기기, 여러 기기 동기화는 범위 밖. Vercel 함수는 요청마다 메모리가 비워질 수 있으므로 서버는 보낸 데이터로 계산만 하고, 데이터는 화면이 들고 있다.

## 2. BE 담당 요구사항과 상태

| 요구사항 | 우선순위 | 상태 | 코드 |
| -------- | -------- | ---- | ---- |
| FR-005 내 지갑 (통화별 · 카드/현금별 잔액) | 필수 | 완료 (형식 + 차감 계산) | `schemas.js` `Wallet`, `settle.js` `applyExpense` |
| FR-006 정산 기준 고정 (기본 1/N, 결제일 환율) | 필수 | 완료 | `settle.js` `expenseShares`, `GET /fx` |
| FR-008 말로 나누기 (결제자 여러 명) | 필수 | 형식 · 계산 · 받는 API 완료 / AI 대기 (지금은 501) | `Payer`, `Split`, `routes/receipts.js` |
| FR-009 AI 결과 서버 검사 | 필수 | 계산 검사 완료 / AI 재시도는 AI 담당 | `settle.js` `checkExpense`, `packages/ai/src/pipeline.js` |
| FR-011 참여자 확인 ("안 갔어요" 빼고 다시 나누기) | 필수 | 완료 | `expenseShares` (declined 제외) |
| FR-012 자동 차감 | 필수 | 완료 | `applyExpense`, `POST /settle/wallets` |
| FR-013 잔액 부족 알림 · 줬어요/받았어요 | 필수 | 완료 (부족 목록 + 현금 반영) | `shortages`, `applyCashTransfer` |
| FR-019 내 몫만 가계부에, 받을 돈 따로 | 필수 | 완료 | `/settle` 의 `shares` · `net` |
| FR-020 결제일 환율 원화 합계 | 필수 | 완료 | `lib/fx.js` `rateOn`, `/settle` 의 `krw` |
| FR-003 하루 예산 | 필수 | 완료 (생활비 예시 값은 화면이 보냄) | `budget.js` `dailyBudget`, `POST /budget` |
| FR-022 여행 후 리포트 (예상 vs 실제) | 필수 | 완료 | `budget.js` `report`, `POST /report` |
| FR-014 중복 결제 경고 | 있으면 좋아요 | 찾기 완료 / 고친 기록 남기기는 남음 | `settle.js` `findDuplicates`, `POST /settle/duplicates` |
| FR-023 하루 끝 요약 | 있으면 좋아요 | 완료 | `budget.js` `daySummary`, `POST /settle/day` |

## 3. 한 일

1. 데이터 형식 보완 (`packages/shared/src/schemas.js`): 결제자 여러 명(`payers`), 참여자 확인(`confirmations`), 나눌 사람(`memberIds`), 세금 줄(`kind`), 번역(`nameKo`), 질문(`Question`), 결제일 환율(`fx`), 가게 이름(`merchant`), 상품 분석 항목 연결(`planItem`), 지갑 잔액의 카드/현금(`WalletBalance`), 현금 주고받기(`CashTransfer`), 상품 분석 결과(`Estimate`)
2. 정산 계산 (`packages/shared/src/settle.js`): 몫 · 차액 · 최소 송금 · 원화 합계 · 검사 · 지갑 차감 · 현금 반영 · 중복 결제 찾기
3. 예산 계산 (`packages/shared/src/budget.js`): 하루 예산 · 리포트 · 하루 끝 요약
4. API (`apps/api`): `GET /fx`, `POST /settle`, `/settle/wallets`, `/settle/day`, `/settle/duplicates`, `/budget`, `/report`, `/trips/:tripId/receipts/analyze`
5. 테스트: 계산 19개 (`packages/shared/test/settle.test.js`, `budget.test.js`), API 12개 (`apps/api/test/settle.test.js`, `budget.test.js`). 전체 44개 통과
6. 명세: `docs/api.md` (예시 응답은 실제로 보내서 받은 값)

## 4. 화면 연동과 AI (2026-11-04 추가)

| 화면 · 기능 | 쓰는 API | 요구사항 |
| ----------- | -------- | -------- |
| 예상 비용 화면에 하루 예산 (생활비 "예시 값" 표시) | `/budget` | FR-003 |
| 모든 화면 위 "지금 누구로 보기" (지우 · 하린 · 도윤 · 서준) | | FR-004 |
| 정산: 기준 고정 표시, 나에게 온 확인(맞아요 / 안 갔어요), 통화별 정산 | `/settle` | FR-006, 011 |
| 지갑 탭 (새로 만듦): 통화 · 카드/현금 잔액, 자동으로 옮긴 몫, 잔액 부족 → 현금 줬어요/받았어요 | `/settle/wallets/replay` | FR-005, 012, 013 |
| 가계부: 하루 예산 막대 · 넘으면 알림, 오늘 내 몫, 남은 잔액, 받을 돈, 이 속도면 부족 경고 | `/settle/day`, `/settle`, `/budget` | FR-019, 021, 023 |
| 가계부: 기록마다 결제일 환율 "1 TRY = OO원 (날짜, 출처)" | `/fx` | FR-020 |
| 가계부: 직접 입력 (AI 가 못 읽으면 자동으로 열림) | | FR-017, AVL-003 |
| 가계부: 중복 결제 "같은 결제인가요?", 정산: 금액 고치면 고친 기록 | `/settle/duplicates` | FR-014 |
| 가계부: 영수증 줄 단위 확인 카드 (근거 원문, 줄별 사람, 질문, 맞아요/고치기) | `/trips/:tripId/receipts/analyze` | FR-007~010 |
| 리포트: 예상 vs 실제 | `/report` | FR-022 |
| AI: 영수증 줄 단위 읽기, 말로 줄별 배정, 검사 틀리면 1회 다시 읽기 | `packages/ai` `readReceipt` · `assignLines` · `runPipeline` | FR-007~009 |

화면 코드: `apps/web/src/api.js`(기록 → Expense 변환, API 호출), `App.jsx`, 시연 지갑 · 멤버 id · 날짜는 `sample.js`.
확인: 브라우저(Edge, 390×844)로 시나리오 1·3·5·7 을 눌러 보고 화면을 확인. 시나리오 2 확인 카드는 응답을 테스트용으로 가로채 화면만 확인.

## 5. 남은 일

| 할 일 | 막힌 이유 |
| ----- | --------- |
| AI 실호출 확인: 영수증 줄 단위 읽기 · 말로 배정 · 말/카드 문자 기록 | 2026-11-04 해커톤 키 작업공간 사용 한도 초과 ("You will regain access on 2026-12-01"). 키를 바꾸면 코드 수정 없이 동작해야 함 |
| 시연용 "저장된 영수증 분석 결과" (인터넷이 끊겨도 시연) | 위와 같음. 실제 AI 결과로 만들어야 함 |
| 정확도 측정 `npm run eval` (PER-001) | 위와 같음 + 평가 케이스 미작성 |

## 6. 팀에 확인할 것

| 항목 | 지금 코드 | 이유 |
| ---- | --------- | ---- |
| 서버에 저장 안 함 | `/settle` 은 보낸 데이터로 계산만. `trips` · `records` 뼈대는 그대로 둠 | AVL-004, Vercel 함수 메모리 |
| `GET /trips/:tripId/settle` 뼈대 | `POST /settle` 로 바꿈 | 위와 같음 |
| 분류 값 | 한국어 `식사 · 선택관광 · 교통 · 쇼핑 · 팁 · 기타` | `packages/ai/src/record.js` · `App.jsx` 가 이미 이 값을 씀 |
| 자동 차감 수단 | 참여자 몫은 카드 잔액끼리만 옮기고, 모자라면 현금 주고받기로 | 현금은 앱이 옮길 수 없는 실물 |
| 남는 금액 부담자 | 가장 많이 낸 결제자 | PER-003 "낸 사람이 부담", 결제자가 여러 명일 때 기준 필요 |
| 브랜치 규칙 | `feat/be` 에서 작업 | main 의 CONTRIBUTING.md(작업마다 `feat/be-*`)와 `feat/be` 의 CONTRIBUTING.md(영역 브랜치)가 다름 |
| 하루 생활비 예시 값 | 서버는 정하지 않고 화면이 `livingPerDayKrw` 로 보냄 | 근거 데이터 없음 (R-03), 값은 팀이 정함 |
| 중복 결제 기준 | 같은 통화 · 금액 1% · 30분 · 가게 이름 포함 (요청마다 바꿀 수 있음) | R-14 에 기준 숫자가 없음 |
| 하루 끝 "부족" 예상 | 오늘까지 하루 평균 내 몫 × 남은 일수 > 잔액(카드+현금) | R-23 에 계산 방법이 없음 |
| 시연 지갑 금액 | `sample.js` WALLETS (도윤 카드 리라를 ₺300 으로 적게 둬서 잔액 부족을 보여 줌) | 시나리오 5 |
| AI 영역 코드 | 사용자(BE)가 `readReceipt` · `assignLines` · `pipeline` 을 구현 | 마감 당일, 원격 feat/ai 에 새 작업이 없었음 → AI 담당과 겹치지 않게 공유 필요 |
| 영수증 분석 요청 형식 | multipart (api.md 원래 계약) | `/record` 는 JSON + data URL 이라 둘이 다름 |
| `AI_MODEL` 기본값 | `.env.example` 이 `claude-opus-5-5` | `docs/모델선정.md` 는 `claude-sonnet-5-5` 를 기본으로 적음 |

## 7. 확인 방법

```bash
npm test        # 계산 · API 테스트
npm run lint
npm run build
```
