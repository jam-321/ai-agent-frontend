export class ApiError extends Error {
  constructor(status, message) {
    super(message || `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

function getCookie(name) {
  const prefix = `${name}=`
  const cookie = document.cookie.split('; ').find((item) => item.startsWith(prefix))
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null
}

let csrfPromise

async function ensureCsrfToken() {
  if (getCookie('XSRF-TOKEN')) return
  if (!csrfPromise) {
    csrfPromise = fetch('/api/auth/csrf', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new ApiError(response.status, '无法初始化安全令牌。')
        await response.json()
      })
      .finally(() => {
        csrfPromise = null
      })
  }
  await csrfPromise
}

export async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    await ensureCsrfToken()
  }

  const headers = new Headers(options.headers || {})
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const csrfToken = getCookie('XSRF-TOKEN')
  if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-XSRF-TOKEN', csrfToken)
  }

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: 'same-origin'
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(response.status, data.message || `HTTP ${response.status}`)
  }
  return data
}
