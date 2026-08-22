import { request } from './http'

export async function sendMessage(
  message,
  conversationId = null,
  agentKey = null,
  modelProviderKey = null,
  modelName = null,
  images = []
) {
  const form = new FormData()
  form.append('message', message)
  if (conversationId != null) form.append('conversationId', String(conversationId))
  if (agentKey) form.append('agentKey', agentKey)
  if (modelProviderKey) form.append('modelProviderKey', modelProviderKey)
  if (modelName) form.append('modelName', modelName)
  images.forEach((image) => form.append('images', image, image.name))
  const data = await request('/api/chat', {
    method: 'POST',
    body: form
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
