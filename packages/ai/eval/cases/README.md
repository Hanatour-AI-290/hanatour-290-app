# 평가 케이스 (PER-001)

케이스 하나 = 영수증 이미지 + 정답 JSON 한 쌍.

```
cases/
  001.jpg
  001.json
```

```json
{
  "image": "001.jpg",
  "utterance": "차는 하린이랑 도윤만, 나머지는 다 같이",
  "me": "지우",
  "members": [{ "id": "m1", "name": "지우" }, ...],
  "expected": {
    "total": 356000,
    "lines": [{ "name": "TESTİ KEBABI", "qty": 4, "total": 260000 }, ...],
    "splits": [{ "lineIndex": 3, "memberIds": ["m2", "m3"] }]
  }
}
```

- 금액은 최소 단위 정수 (TRY 2.600,00 → `260000`). 세금 줄은 `"kind": "tax"`
- `splits` 에 없는 메뉴 줄은 전원(1/N)이 정답
- 실제 사람 이름·카드번호가 보이는 영수증은 가리고 넣기 (공개 저장소)

## 실행

```bash
npm run eval                 # 재시도 켬
npm run eval -- --no-retry   # 재시도 끔 (켬/끔 비교)
```

`.env` 의 `ANTHROPIC_API_KEY` 가 있어야 하고, 모델은 `AI_MODEL` 을 바꿔 비교한다. 결과는 `eval/results/날짜_모델_retry.json`.

| 지표 | 계산 |
| ---- | ---- |
| 줄 금액 일치율 | 정답 줄 중 같은 금액의 줄을 읽은 비율 |
| 합계 일치율 | 영수증 합계를 맞게 읽은 케이스 비율 |
| 배정 정답률 | 정답 메뉴 줄 중 나눌 사람이 정확히 같은 비율 |
| 잡아낸 비율 | 틀린 케이스 중 서버 검사 실패나 질문으로 표시된 비율 |
| 평균 시간 | 케이스당 초 |
