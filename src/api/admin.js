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

export function listAdminUsers({ page = 1, size = 20 } = {}) {
  return request(`/api/admin/users?page=${page}&size=${size}`)
}

export function updateAdminUser(id, payload) {
  return request(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export function listAdminAgents() {
  return request('/api/admin/agents')
}

export function createAdminAgent(payload) {
  return request('/api/admin/agents', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateAdminAgent(agentKey, payload) {
  return request(`/api/admin/agents/${encodeURIComponent(agentKey)}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function deleteAdminAgent(agentKey) {
  return request(`/api/admin/agents/${encodeURIComponent(agentKey)}`, { method: 'DELETE' })
}

export function listAdminProviders() {
  return request('/api/admin/providers')
}

export function createAdminProvider(payload) {
  return request('/api/admin/providers', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateAdminProvider(providerKey, payload) {
  return request(`/api/admin/providers/${encodeURIComponent(providerKey)}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function listAuditLogs({ page = 1, size = 20 } = {}) {
  return request(`/api/admin/audits?page=${page}&size=${size}`)
}
