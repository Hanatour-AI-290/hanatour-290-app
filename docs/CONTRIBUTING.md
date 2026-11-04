# 협업 규칙

## 브랜치

```
main      ← 항상 돌아가는 상태. 바로 push 금지, PR + CI 통과해야 합쳐짐
├ feat/fe ← 프론트 (apps/web)
├ feat/be ← 백엔드 (apps/api, packages/shared)
└ feat/ai ← AI (packages/ai)
```

1. `git fetch && git switch feat/be` - 자기 영역 브랜치로
2. 작업 → commit → push
3. GitHub 에서 `feat/be → main` PR → CI(lint + test + build) 통과하면 합치기
4. 합친 뒤 다른 영역 작업 받기: `git pull origin main` (자주 할수록 충돌이 적다)

영역 브랜치는 합쳐도 지워지지 않는다. 작은 실험은 `feat/be-환율` 처럼 따로 따서 자기 영역 브랜치로 PR 해도 된다.

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
