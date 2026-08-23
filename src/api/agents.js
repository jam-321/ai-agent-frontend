import { request } from './http'

export function listAgents() {
  return request('/api/agents')
}