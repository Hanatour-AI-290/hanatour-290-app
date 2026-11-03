# API 계약

기본 주소: `http://localhost:8787/api` · 데이터 형식은 `packages/shared/src/schemas.js` 기준.
금액은 최소 단위 정수 (EUR 12.30 → `1230`).

| 메서드 | 경로                                | 하는 일                                  | 상태   |
| ------ | ----------------------------------- | ---------------------------------------- | ------ |
| GET    | `/health`                           | 서버 확인                                | 완료   |
| POST   | `/estimate`                         | 상품 문구 → 따로 내는 비용 항목 + 환율 (R-01) | 완료 (프로토타입) |
| POST   | `/record`                           | 사진 · 카드 문자 · 말 → 지출 하나 (R-15·16·18) | 완료 (프로토타입) |
| GET    | `/trips`                            | 여행 목록                                | 뼈대   |
| GET    | `/trips/:tripId`                    | 여행 하나                                | 뼈대   |
| POST   | `/trips`                            | 여행 만들기                              | 할 일  |
| GET    | `/trips/:tripId/records`            | 지출 목록                                | 뼈대   |
| POST   | `/trips/:tripId/records`            | 지출 저장                                | 할 일  |
| POST   | `/trips/:tripId/receipts/analyze`   | 사진 + 말 → 줄 단위 · 배정 · 검증 결과  | 할 일  |
| GET    | `/trips/:tripId/settle`             | 통화별 정산                              | 할 일  |

## POST /estimate

요청 `{ "text": "상품 문구 (10~8000자)" }`
응답 `{ "title", "base_price_krw", "items": [{ "name", "category", "amount", "currency", "required", "evidence" }], "fx": { "date", "krw": { "EUR": 1580.2 } } | null }`

## POST /record

요청 `{ "text"?: "말 한 줄 (500자 이하)", "image"?: "data:image/jpeg;base64,...", "kind"?: "sms", "members": ["지우", ...], "me": "지우" }`
응답 `{ "name", "category", "amount", "currency", "payer", "people": [], "evidence" }` - 팀원 이름이 아닌 payer·people 은 서버가 버린다.

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
