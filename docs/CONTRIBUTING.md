# 협업 규칙

## 브랜치

```
main  ← 항상 돌아가는 상태. 바로 push 금지, PR 로만 합친다
 ├ feat/fe-영수증화면
 ├ feat/be-정산api
 └ feat/ai-줄단위읽기
```

1. `git switch main && git pull` 로 최신 main 받기
2. `git switch -c feat/be-정산api` 처럼 작업 브랜치 만들기 (작업 하나에 브랜치 하나)
3. 작업 → push → **main 으로 PR** → CI(lint + test + build) 통과하면 합치기
4. 합친 작업 브랜치는 자동으로 지워진다

브랜치 이름: `feat/fe-*`, `feat/be-*`, `feat/ai-*`, `fix/*`, `docs/*`, `chore/*`
브랜치는 짧게 살린다 - 하루 넘기기 전에 PR 로 합치면 충돌이 적다.

## 커밋 메시지

`[접두어] 무엇을 했는지` - 한국어로.

| 접두어     | 쓰는 때                 |
| ---------- | ----------------------- |
| `[Add]`    | 기능 추가               |
| `[Fix]`    | 버그 수정               |
| `[Refactor]` | 동작 그대로, 구조 정리 |
| `[Docs]`   | 문서                    |
| `[Chore]`  | 설정·의존성             |

## 비밀값

- API 키는 `.env` 에만. `.env.example` 에는 키 **이름**만 적는다.
- 공개 저장소라서 실수로 올렸으면 바로 키를 폐기하고 새로 발급한다.

## 데이터 형식을 바꿀 때

`packages/shared/src/schemas.js` 를 고치면 `docs/api.md` 도 같이 고치고, PR 설명에 적는다.
