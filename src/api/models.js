import { request } from './http'

export function listModels() {
  return request('/api/models')
}
