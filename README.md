# 하나투어 AI 해커톤 - 팀 290

여행 중 함께 쓴 돈을 **찍고 → 말하고 → 확인** 으로 자동 정산하는 앱.
읽는 건 AI, 계산은 규칙.

## 구조

| 폴더              | 내용                                        | 담당 |
| ----------------- | ------------------------------------------- | ---- |
| `apps/web`        | 프론트 (React + Vite)                       | FE   |
| `apps/api`        | API 서버 (Hono, Node)                       | BE   |
| `packages/shared` | 공통 데이터 형식(zod), 정산 계산 규칙       | BE   |
| `packages/ai`     | 영수증 읽기 · 말로 배정 · 규칙 검증, 평가 세트 | AI   |
| `docs`            | API 계약, 협업 규칙                         | 모두 |

## 시작하기

Node 22 이상이 필요해요.

```bash
npm install
cp .env.example .env     # ANTHROPIC_API_KEY 채우기
npm run dev              # web http://localhost:5173 · api http://localhost:8787/api/health
```

| 명령            | 하는 일                         |
| --------------- | ------------------------------- |
| `npm run dev`   | web + api 같이 실행             |
| `npm run lint`  | 린트 (oxlint)                   |
| `npm test`      | 테스트 (node:test)              |
| `npm run eval`  | AI 평가 세트 정확도             |

## 지금 되는 것 (프로토타입에서 옮김)

| 화면·기능 | 코드 | 요구사항 |
| --- | --- | --- |
| 스플래시 · 홈 · 문구 입력 · 결과 · 가계부 · 정산 · 리포트 화면 | `apps/web/src/App.jsx`, 예시 데이터 `sample.js` | R-02, R-04, R-22 등 |
| 상품 문구 → 따로 내는 비용 + 환율 | `packages/ai/src/estimate.js`, `apps/api/src/routes/estimate.js` | R-01 |
| 영수증 · 카드 문자 · 말 → 지출 하나, 자동 분류 | `packages/ai/src/record.js`, `apps/api/src/routes/record.js` | R-15, R-16, R-18 |
| 환율 (유럽중앙은행 최신, 4개 통화) | `apps/api/src/lib/fx.js` | R-20 일부 |

정산 계산(`balances`·`myShare`)은 아직 `App.jsx` 안에 있다 → `packages/shared` 로 옮기는 게 R-24.

## 실시간으로 보기

- `npm run dev` 터미널에 API 요청마다 `→ POST /api/record`, `← 200 2.77s {...응답 요약}` 이 찍힌다. `.env` 에 `LOG_LEVEL=debug` 면 응답 전체.
- api 코드는 저장하면 바로 재시작, 화면은 바로 새로 고쳐진다.

## 협업

[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) - 브랜치, 커밋, PR 규칙
[docs/api.md](docs/api.md) - API 계약
