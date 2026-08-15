import { request } from './http'

export async function sendMessage(message) {
  const data = await request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message })
  })
  return data.reply
}
