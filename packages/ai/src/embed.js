// 문장 임베딩 (ML 모델, 사전학습 그대로 · 추가 학습 없음). 기록 ↔ 예정 항목 연결 후보를 찾는 데 쓴다.
// Claude API 를 부르지 않고 서버 안에서 ONNX 모델을 돌린다 (API 비용 0).
// 모델은 처음 부를 때 한 번만 받아 메모리에 둔다. Vercel 은 쓰기 가능한 곳이 /tmp 뿐이라 캐시를 거기에 둔다.

export const EMBED_MODEL = process.env.EMBED_MODEL || 'Xenova/multilingual-e5-small'

/** e5 계열은 검색 쪽(query)과 문서 쪽(passage) 앞에 접두어를 붙여야 성능이 난다 */
const PREFIX = { query: 'query: ', passage: 'passage: ' }
const needsPrefix = (model) => /e5/i.test(model)

/** @type {Map<string, Promise<any>>} 모델 이름 → 파이프라인 (동시에 여러 번 불러도 한 번만 로드) */
const loaded = new Map()

async function extractor(model) {
  if (!loaded.has(model)) {
    const job = (async () => {
      // 다른 API 의 콜드 스타트를 늦추지 않게, 쓸 때만 불러온다
      const { pipeline, env } = await import('@huggingface/transformers')
      if (process.env.VERCEL) env.cacheDir = '/tmp/hf'
      return pipeline('feature-extraction', model, { dtype: 'q8' })
    })()
    job.catch(() => loaded.delete(model)) // 실패하면 다음 요청에서 다시 시도
    loaded.set(model, job)
  }
  return loaded.get(model)
}

/**
 * 문장들을 길이 1 로 정규화한 벡터로. 두 벡터의 내적 = 코사인 유사도.
 * @param {string[]} texts
 * @param {'query' | 'passage'} kind query = 사용자가 남긴 기록, passage = 예정 항목
 * @param {{ model?: string }} [opts]
 * @returns {Promise<number[][]>}
 */
export async function embed(texts, kind, { model = EMBED_MODEL } = {}) {
  if (!texts.length) return []
  const fe = await extractor(model)
  const input = needsPrefix(model) ? texts.map((t) => PREFIX[kind] + t) : texts
  const out = await fe(input, { pooling: 'mean', normalize: true })
  return out.tolist()
}

/** 정규화된 두 벡터의 코사인 유사도 */
export const cosine = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)

/**
 * 기록 하나와 예정 항목들의 유사도. 항목마다 이름이 여러 개(이름 + 별칭)면 그중 가장 높은 값.
 * @param {string} query 기록 문장
 * @param {string[][]} groups 항목마다 [이름, ...별칭]
 * @returns {Promise<number[]>} groups 순서대로
 */
export async function groupSimilarities(query, groups, opts) {
  const flat = groups.flat()
  if (!flat.length) return groups.map(() => 0)
  const all = await similarities(query, flat, opts)
  let k = 0
  return groups.map((g) => {
    const s = all.slice(k, k + g.length)
    k += g.length
    return s.length ? Math.max(...s) : 0
  })
}

/**
 * 기록 하나와 예정 항목들의 유사도.
 * @param {string} query 기록 문장
 * @param {string[]} passages 예정 항목 이름들
 * @returns {Promise<number[]>} passages 순서대로
 */
export async function similarities(query, passages, opts) {
  if (!passages.length) return []
  // 같은 모델 세션을 쓰므로 차례로 돌린다
  const [q] = await embed([query], 'query', opts)
  const ps = await embed(passages, 'passage', opts)
  return ps.map((p) => cosine(q, p))
}
