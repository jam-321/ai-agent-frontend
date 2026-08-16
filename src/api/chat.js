import { request } from './http'

export async function sendMessage(message, conversationId = null) {
  const data = await request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ conversationId, message })
  })
  return data
}

export function getProgress(conversationId, turnId) {
  return request(`/api/chat/progress?conversationId=${encodeURIComponent(conversationId)}&turnId=${encodeURIComponent(turnId)}`)
}

export function listConversations() {
  return request('/api/conversations')
}

export function getConversationTurns(conversationId) {
  return request(`/api/conversations/${encodeURIComponent(conversationId)}/turns`)
}

export function deleteConversation(conversationId) {
  return request(`/api/conversations/${encodeURIComponent(conversationId)}`, { method: 'DELETE' })
}
