// Claude 클라이언트 (프로토타입 api/_shared.js 에서 옮김)
import Anthropic from '@anthropic-ai/sdk'

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
