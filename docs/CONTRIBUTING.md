# 협업 규칙

## 브랜치

```
main      ← 시연·배포용. develop 에서만 PR 로 합친다
└ develop ← 기본 브랜치. 모든 작업 PR 은 여기로
   ├ feat/fe-영수증화면
   ├ feat/be-정산api
   └ feat/ai-줄단위읽기
```

1. `git switch develop && git pull` 로 최신 develop 받기
2. `git switch -c feat/be-정산api` 처럼 작업 브랜치 만들기
3. 작업 → push → **develop 으로 PR** → CI(lint + test + build) 통과하면 합치기
4. 합친 작업 브랜치는 자동으로 지워진다
5. 시연 전처럼 안정된 시점에 `develop → main` PR (Merge commit 으로 합치기)

브랜치 이름: `feat/fe-*`, `feat/be-*`, `feat/ai-*`, `fix/*`, `docs/*`, `chore/*`
main · develop 에는 바로 push 할 수 없다.

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
