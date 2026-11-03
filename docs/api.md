# API 계약

기본 주소: `http://localhost:8787/api` · 데이터 형식은 `packages/shared/src/schemas.js` 기준.
금액은 최소 단위 정수 (EUR 12.30 → `1230`).

| 메서드 | 경로                                | 하는 일                                  | 상태   |
| ------ | ----------------------------------- | ---------------------------------------- | ------ |
| GET    | `/health`                           | 서버 확인                                | 완료   |
| GET    | `/trips`                            | 여행 목록                                | 뼈대   |
| GET    | `/trips/:tripId`                    | 여행 하나                                | 뼈대   |
| POST   | `/trips`                            | 여행 만들기                              | 할 일  |
| GET    | `/trips/:tripId/records`            | 지출 목록                                | 뼈대   |
| POST   | `/trips/:tripId/records`            | 지출 저장                                | 할 일  |
| POST   | `/trips/:tripId/receipts/analyze`   | 사진 + 말 → 줄 단위 · 배정 · 검증 결과  | 할 일  |
| GET    | `/trips/:tripId/settle`             | 통화별 정산                              | 할 일  |

## POST /trips/:tripId/receipts/analyze

요청 (multipart): `image` 파일, `utterance` 문자열

응답 예시:

```json
{
  "receipt": { "lines": [{ "name": "Beer", "qty": 2, "unitPrice": 500, "total": 1000, "source": "BEER 2 x 5.00" }], "total": 1000, "currency": "EUR" },
  "splits": [{ "lineIndex": 0, "memberIds": ["m1", "m2"] }],
  "questions": [],
  "check": { "ok": true, "errors": [] }
}
```
