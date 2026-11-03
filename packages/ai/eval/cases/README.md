# 평가 케이스

케이스 하나 = 영수증 이미지 + 정답 JSON 한 쌍.

```
cases/
  001.jpg
  001.json   # { "utterance": "...", "members": [...], "expected": { "lines": [...], "splits": [...] } }
```

- 실제 사람 이름·카드번호가 보이는 영수증은 가리고 넣기 (공개 저장소).
- `npm run eval` 로 줄 단위 정확도·배정 정확도를 출력한다.
