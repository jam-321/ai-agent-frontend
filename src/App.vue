<script setup>
import { onMounted, ref } from 'vue'
import { getCurrentUser, login, logout, register } from './api/auth'
import { ApiError } from './api/http'
import { sendMessage } from './api/chat'

const currentUser = ref(null)
const initializing = ref(true)
const authMode = ref('login')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const authError = ref('')
const authNotice = ref('')
const authSubmitting = ref(false)
const logoutSubmitting = ref(false)

const messages = ref([])
const input = ref('')
const loading = ref(false)

onMounted(async () => {
  try {
    currentUser.value = await getCurrentUser()
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      authError.value = '无法连接服务器，请确认后端已启动。'
    }
  } finally {
    initializing.value = false
  }
})

function switchAuthMode(mode) {
  authMode.value = mode
  authError.value = ''
  authNotice.value = ''
  password.value = ''
  confirmPassword.value = ''
}

async function handleAuthSubmit() {
  authError.value = ''
  authNotice.value = ''
  if (authMode.value === 'register' && password.value !== confirmPassword.value) {
    authError.value = '两次输入的密码不一致。'
    return
  }

  authSubmitting.value = true
  try {
    if (authMode.value === 'register') {
      await register(username.value.trim(), password.value)
      authMode.value = 'login'
      password.value = ''
      confirmPassword.value = ''
      authNotice.value = '注册成功，请登录。'
    } else {
      currentUser.value = await login(username.value.trim(), password.value)
      password.value = ''
    }
  } catch (error) {
    authError.value = error.message || '请求失败，请稍后重试。'
  } finally {
    authSubmitting.value = false
  }
}

async function handleLogout() {
  logoutSubmitting.value = true
  try {
    await logout()
  } finally {
    currentUser.value = null
    messages.value = []
    logoutSubmitting.value = false
  }
}

async function handleSend() {
  const text = input.value.trim()
  if (!text || loading.value) return
  messages.value.push({ role: 'user', content: text })
  input.value = ''
  loading.value = true
  try {
    const reply = await sendMessage(text)
    messages.value.push({ role: 'assistant', content: reply })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      currentUser.value = null
      authError.value = '登录已过期，请重新登录。'
    } else {
      messages.value.push({ role: 'assistant', content: `请求失败：${error.message}` })
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="initializing" class="loading-screen">正在检查登录状态...</div>

  <div v-else-if="!currentUser" class="auth-shell">
    <section class="auth-panel">
      <div class="brand-mark">AI Agent</div>
      <h1>{{ authMode === 'login' ? '欢迎回来' : '创建账号' }}</h1>
      <p class="auth-subtitle">{{ authMode === 'login' ? '登录后继续使用 Agent' : '注册后即可开始对话' }}</p>

      <div class="auth-tabs">
        <button :class="{ active: authMode === 'login' }" @click="switchAuthMode('login')">登录</button>
        <button :class="{ active: authMode === 'register' }" @click="switchAuthMode('register')">注册</button>
      </div>

      <form class="auth-form" @submit.prevent="handleAuthSubmit">
        <label>
          用户名
          <input v-model="username" autocomplete="username" placeholder="4-30 位字母、数字或下划线" required />
        </label>
        <label>
          密码
          <input v-model="password" :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'" type="password" placeholder="至少 8 位" required />
        </label>
        <label v-if="authMode === 'register'">
          确认密码
          <input v-model="confirmPassword" autocomplete="new-password" type="password" placeholder="再次输入密码" required />
        </label>
        <p v-if="authError" class="error">{{ authError }}</p>
        <p v-if="authNotice" class="notice">{{ authNotice }}</p>
        <button class="primary-button" type="submit" :disabled="authSubmitting">
          {{ authSubmitting ? '处理中...' : authMode === 'login' ? '登录' : '注册' }}
        </button>
      </form>
    </section>
  </div>

  <div v-else class="app">
    <header class="header">
      <div>
        <h1>AI Agent</h1>
        <span class="sub">与你的 Agent 对话</span>
      </div>
      <div class="account">
        <span class="username">{{ currentUser.username }}</span>
        <button class="logout-button" :disabled="logoutSubmitting" @click="handleLogout">退出</button>
      </div>
    </header>

    <main class="chat">
      <div v-if="messages.length === 0" class="empty">开始和 Agent 对话吧！</div>
      <div v-for="(m, i) in messages" :key="i" class="row" :class="m.role">
        <div class="bubble">{{ m.content }}</div>
      </div>
      <div v-if="loading" class="row assistant">
        <div class="bubble">思考中...</div>
      </div>
    </main>

    <footer class="footer">
      <input v-model="input" placeholder="输入消息，回车发送" :disabled="loading" @keyup.enter="handleSend" />
      <button :disabled="loading || !input.trim()" @click="handleSend">发送</button>
    </footer>
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { height: 100%; }
body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f5f6f8; color: #1f2937; }
button, input { font: inherit; }
button { cursor: pointer; }
.loading-screen { display: grid; place-items: center; height: 100%; color: #6b7280; }
.auth-shell { display: grid; place-items: center; min-height: 100%; padding: 24px; }
.auth-panel { width: min(100%, 420px); padding: 36px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 12px 32px rgba(15, 23, 42, .08); }
.brand-mark { color: #4f7cff; font-weight: 700; letter-spacing: .04em; margin-bottom: 28px; }
.auth-panel h1 { font-size: 26px; margin-bottom: 8px; }
.auth-subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
.auth-tabs { display: flex; gap: 22px; border-bottom: 1px solid #e5e7eb; margin-bottom: 22px; }
.auth-tabs button { padding: 0 0 10px; border: 0; background: transparent; color: #9ca3af; border-bottom: 2px solid transparent; }
.auth-tabs button.active { color: #4f7cff; border-bottom-color: #4f7cff; }
.auth-form { display: grid; gap: 16px; }
.auth-form label { display: grid; gap: 7px; color: #374151; font-size: 14px; }
.auth-form input { width: 100%; padding: 11px 12px; border: 1px solid #d1d5db; border-radius: 7px; outline: none; }
.auth-form input:focus { border-color: #4f7cff; box-shadow: 0 0 0 3px rgba(79, 124, 255, .12); }
.primary-button { padding: 11px 16px; border: 0; border-radius: 7px; background: #4f7cff; color: white; }
.primary-button:disabled, .logout-button:disabled { opacity: .55; cursor: not-allowed; }
.error { color: #dc2626; font-size: 13px; line-height: 1.5; }
.notice { color: #15803d; font-size: 13px; line-height: 1.5; }
.app { display: flex; flex-direction: column; height: 100%; max-width: 760px; margin: 0 auto; }
.header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; border-bottom: 1px solid #e5e7eb; background: #fff; }
.header h1 { font-size: 20px; }
.sub { color: #888; font-size: 13px; }
.account { display: flex; align-items: center; gap: 12px; min-width: 0; }
.username { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }
.logout-button { padding: 7px 11px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #4b5563; font-size: 13px; }
.chat { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.empty { color: #aaa; text-align: center; margin-top: 40px; }
.row { display: flex; }
.row.user { justify-content: flex-end; }
.row.assistant { justify-content: flex-start; }
.bubble { max-width: 78%; padding: 10px 14px; border-radius: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.user .bubble { background: #4f7cff; color: #fff; border-bottom-right-radius: 4px; }
.assistant .bubble { background: #fff; color: #333; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
.footer { display: flex; gap: 10px; padding: 14px 20px; border-top: 1px solid #e5e7eb; background: #fff; }
.footer input { flex: 1; min-width: 0; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; }
.footer input:focus { border-color: #4f7cff; }
.footer button { padding: 10px 22px; border: none; border-radius: 8px; background: #4f7cff; color: #fff; font-size: 14px; }
.footer button:disabled { background: #b9c7f0; cursor: not-allowed; }
@media (max-width: 520px) {
  .auth-panel { padding: 28px 22px; }
  .header { padding: 14px 16px; }
  .chat { padding: 16px; }
  .footer { padding: 12px 16px; }
  .sub { display: none; }
}
</style>
