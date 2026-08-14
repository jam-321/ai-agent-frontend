<script setup>
import { ref } from 'vue'
import { sendMessage } from './api/chat'

const messages = ref([])
const input = ref('')
const loading = ref(false)

async function handleSend() {
  const text = input.value.trim()
  if (!text || loading.value) return
  messages.value.push({ role: 'user', content: text })
  input.value = ''
  loading.value = true
  try {
    const reply = await sendMessage(text)
    messages.value.push({ role: 'assistant', content: reply })
  } catch (e) {
    messages.value.push({ role: 'assistant', content: '请求失败：' + e.message })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>🤖 AI Agent</h1>
      <span class="sub">Vue3 + Spring AI</span>
    </header>

    <main class="chat">
      <div v-if="messages.length === 0" class="empty">开始和 Agent 对话吧！</div>
      <div v-for="(m, i) in messages" :key="i" class="row" :class="m.role">
        <div class="bubble">{{ m.content }}</div>
      </div>
      <div v-if="loading" class="row assistant">
        <div class="bubble">思考中…</div>
      </div>
    </main>

    <footer class="footer">
      <input
        v-model="input"
        placeholder="输入消息，回车发送"
        :disabled="loading"
        @keyup.enter="handleSend"
      />
      <button :disabled="loading || !input.trim()" @click="handleSend">发送</button>
    </footer>
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { height: 100%; }
body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f5f6f8; }
.app { display: flex; flex-direction: column; height: 100%; max-width: 760px; margin: 0 auto; }
.header { display: flex; align-items: baseline; gap: 12px; padding: 16px 20px; border-bottom: 1px solid #e5e7eb; }
.header h1 { font-size: 20px; }
.sub { color: #888; font-size: 13px; }
.chat { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.empty { color: #aaa; text-align: center; margin-top: 40px; }
.row { display: flex; }
.row.user { justify-content: flex-end; }
.row.assistant { justify-content: flex-start; }
.bubble { max-width: 78%; padding: 10px 14px; border-radius: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.user .bubble { background: #4f7cff; color: #fff; border-bottom-right-radius: 4px; }
.assistant .bubble { background: #fff; color: #333; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
.footer { display: flex; gap: 10px; padding: 14px 20px; border-top: 1px solid #e5e7eb; background: #fff; }
.footer input { flex: 1; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; }
.footer input:focus { border-color: #4f7cff; }
.footer button { padding: 10px 22px; border: none; border-radius: 8px; background: #4f7cff; color: #fff; font-size: 14px; cursor: pointer; }
.footer button:disabled { background: #b9c7f0; cursor: not-allowed; }
</style>
