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

## 협업

[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) - 브랜치, 커밋, PR 규칙
[docs/api.md](docs/api.md) - API 계약
