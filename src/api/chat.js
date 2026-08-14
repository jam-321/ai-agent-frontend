// 后端聊天接口封装
export async function sendMessage(message) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  const res = await fetch(`${apiBaseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  })
  if (!res.ok) {
    throw new Error('HTTP ' + res.status)
  }
  const data = await res.json()
  return data.reply
}
