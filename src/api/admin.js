import { request } from './http'

export function getMonitorOverview() {
  return request('/api/admin/monitor/overview')
}

export function listMonitoredConversations({ page = 1, size = 20, search = '' } = {}) {
  const parameters = new URLSearchParams({ page, size })
  if (search.trim()) parameters.set('search', search.trim())
  return request(`/api/admin/monitor/conversations?${parameters}`)
}

export function getMonitoredConversation(conversationId) {
  return request(`/api/admin/monitor/conversations/${encodeURIComponent(conversationId)}`)
}

export function getToolStatistics() {
  return request('/api/admin/monitor/tools')
}
