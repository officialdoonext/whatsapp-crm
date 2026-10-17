import { AiError, type ChatMessage, type ProviderResult } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  normalizeUsage,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'
import { getT } from '@/lib/i18n/translate'

const t = getT('LibErrors')

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[]
      role?: string
    }
    finishReason?: string
  }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}

/**
 * Format conversation turns for Google Gemini's generateContent endpoint.
 * Gemini requires roles to be strictly 'user' or 'model'.
 */
function normalizeForGemini(messages: ChatMessage[]) {
  const merged = mergeConsecutive(messages)
  while (merged.length > 0 && merged[0].role === 'assistant') {
    merged.shift()
  }
  if (merged.length === 0) {
    return [
      {
        role: 'user',
        parts: [{ text: '(The customer has not sent a message yet.)' }],
      },
    ]
  }
  return merged.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
}

/**
 * Call Google Gemini's generateContent endpoint with the caller's own API key.
 * Returns the raw assistant text + token usage (handoff parsing happens in `generateReply`).
 */
export async function generateGemini(args: ProviderArgs): Promise<ProviderResult> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args
  const url = `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`

  const body: Record<string, unknown> = {
    contents: normalizeForGemini(messages),
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  }

  if (systemPrompt && systemPrompt.trim()) {
    body.system_instruction = {
      parts: [{ text: systemPrompt.trim() }],
    }
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw toNetworkError(err)
  }

  if (!res.ok) {
    throw await providerHttpError('Gemini', res)
  }

  const data = (await res.json().catch(() => null)) as GeminiResponse | null
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim()

  if (!text) {
    throw new AiError(t('ai.emptyResponse', { provider: 'Gemini' }), {
      code: 'empty_response',
    })
  }

  const usage = normalizeUsage({
    prompt: data?.usageMetadata?.promptTokenCount,
    completion: data?.usageMetadata?.candidatesTokenCount,
    total: data?.usageMetadata?.totalTokenCount,
  })

  return { text, usage }
}
