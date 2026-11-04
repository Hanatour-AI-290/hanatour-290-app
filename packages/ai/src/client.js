// Claude 클라이언트 (프로토타입 api/_shared.js 에서 옮김)
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'

export { Anthropic }

let client

/** 키는 .env 의 ANTHROPIC_API_KEY, 작업공간 키면 ANTHROPIC_WORKSPACE_ID 도 함께 */
export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY 가 없어요 (.env 확인)')
  client ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultHeaders: process.env.ANTHROPIC_WORKSPACE_ID
      ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID }
      : undefined,
  })
  return client
}

export const MODEL = process.env.AI_MODEL || 'claude-opus-5-5'

/** 거절(refusal)되면 서버가 거절 종류에 맞는 다른 모델로 한 번 더 돌린다 (fallbacks: "default") */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

/**
 * 정해진 모양(zod)으로 답을 받는다. 모든 Claude 호출이 이걸 쓴다.
 * @template {import('zod').ZodType} S
 * @param {{ schema: S } & Record<string, any>} params schema 외에는 messages.create 와 같은 값
 * @returns {Promise<{ stop_reason: string | null, parsed_output: import('zod').infer<S> | null, model: string }>}
 */
export function parse({ schema, ...params }) {
  return getClient().beta.messages.parse({
    model: MODEL,
    ...params,
    output_config: { ...params.output_config, format: betaZodOutputFormat(schema) },
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
  })
}
