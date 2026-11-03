import Anthropic from '@anthropic-ai/sdk'

let client

/** Anthropic 클라이언트 (키는 .env 의 ANTHROPIC_API_KEY) */
export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY 가 없어요 (.env 확인)')
  client ??= new Anthropic()
  return client
}

export const MODEL = process.env.AI_MODEL ?? 'claude-sonnet-5-5'
