<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AdminMonitor from './components/AdminMonitor.vue'
import { getCurrentUser, login, logout, register } from './api/auth'
import { ApiError } from './api/http'
import { deleteConversation, getConversationTurns, getProgress, listConversations, sendMessage } from './api/chat'
import { listAgents } from './api/agents'
import { listModels } from './api/models'

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
const workspaceView = ref('chat')

const conversations = ref([])
const agents = ref([])
const models = ref([])
const selectedAgentKey = ref('general')
const selectedModelKey = ref('')
const activeConversationId = ref(null)
const messages = ref([])
const input = ref('')
const loading = ref(false)
const runStatus = ref(null)
const runTurnId = ref(null)
const runSteps = ref([])
const runError = ref('')
const runSelection = ref(null)
let pollTimer = null
let pollVersion = 0

const visibleRunSteps = computed(() => runSteps.value.filter((node) => node.nodeType !== 'LIFECYCLE' && node.nodeType !== 'GENERATE'))
const selectedModel = computed(() => models.value.find((item) => modelKey(item) === selectedModelKey.value))

onMounted(async () => {
  try {
    currentUser.value = await getCurrentUser()
    await loadConversations()
    await loadAgents()
    await loadModels()
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) authError.value = '无法连接服务器，请确认后端已启动。'
  } finally {
    initializing.value = false
  }
})

onUnmounted(stopPolling)

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
      await loadConversations()
      await loadAgents()
      await loadModels()
    }
  } catch (error) {
    authError.value = error.message || '请求失败，请稍后重试。'
  } finally {
    authSubmitting.value = false
  }
}

async function loadConversations() {
  conversations.value = await listConversations()
  if (activeConversationId.value && !conversations.value.some((item) => item.id === activeConversationId.value)) activeConversationId.value = null
}

async function loadAgents() {
  agents.value = await listAgents()
  if (!agents.value.some((item) => item.agentKey === selectedAgentKey.value)) {
    selectedAgentKey.value = agents.value[0]?.agentKey || 'general'
  }
}

async function loadModels() {
  models.value = await listModels()
  const current = models.value.find((item) => modelKey(item) === selectedModelKey.value && item.available)
  if (!current) {
    const defaultAgent = agents.value.find((item) => item.agentKey === selectedAgentKey.value)
    const preferredKey = defaultAgent
      ? `${defaultAgent.modelProviderKey}::${defaultAgent.modelName}`
      : ''
    const preferred = models.value.find((item) => modelKey(item) === preferredKey && item.available)
    const fallback = models.value.find((item) => item.available)
    selectedModelKey.value = modelKey(preferred || fallback)
  }
}

function modelKey(model) {
  return model ? `${model.providerKey}::${model.modelName}` : ''
}

function selectAgentDefaultModel(agentKey) {
  const agent = agents.value.find((item) => item.agentKey === agentKey)
  if (!agent) return

  const defaultModelKey = `${agent.modelProviderKey}::${agent.modelName}`
  const defaultModel = models.value.find((item) => modelKey(item) === defaultModelKey && item.available)
  if (defaultModel) selectedModelKey.value = defaultModelKey
}

function handleAgentSelectionChange() {
  selectAgentDefaultModel(selectedAgentKey.value)
}

async function selectConversation(id) {
  stopPolling()
  activeConversationId.value = id
  const conversation = conversations.value.find((item) => item.id === id)
  selectedAgentKey.value = conversation?.agentKey || selectedAgentKey.value
  const conversationModelKey = conversation?.modelProviderKey && conversation?.modelName
    ? `${conversation.modelProviderKey}::${conversation.modelName}`
    : ''
  if (models.value.some((item) => modelKey(item) === conversationModelKey && item.available)) {
    selectedModelKey.value = conversationModelKey
  }
  runStatus.value = null
  runTurnId.value = null
  runSteps.value = []
  runError.value = ''
  const turns = await getConversationTurns(id)
  messages.value = turns.map((turn) => ({
    role: turn.type,
    content: turn.content,
    turnId: turn.turnId,
    agentKey: turn.agentKey,
    modelProviderKey: turn.modelProviderKey,
    modelName: turn.modelName
  }))
  const grouped = new Map()
  for (const turn of turns) {
    if (!grouped.has(turn.turnId)) grouped.set(turn.turnId, [])
    grouped.get(turn.turnId).push(turn)
  }
  const pending = [...grouped.entries()].reverse().find(([, items]) => items.some((item) => item.type === 'user') && !items.some((item) => item.type === 'assistant'))
  if (pending) {
    const pendingUser = pending[1].find((item) => item.type === 'user')
    runSelection.value = pendingUser ? {
      agentKey: pendingUser.agentKey,
      modelProviderKey: pendingUser.modelProviderKey,
      modelName: pendingUser.modelName
    } : null
    startPolling(id, pending[0])
  }
}

function newConversation() {
  workspaceView.value = 'chat'
  stopPolling()
  activeConversationId.value = null
  selectedAgentKey.value = agents.value.some((item) => item.agentKey === 'general')
    ? 'general'
    : agents.value[0]?.agentKey || 'general'
  selectAgentDefaultModel(selectedAgentKey.value)
  messages.value = []
  runStatus.value = null
  runSteps.value = []
  runError.value = ''
  runSelection.value = null
  input.value = ''
}

function showChat() {
  workspaceView.value = 'chat'
}

function showMonitor() {
  stopPolling()
  workspaceView.value = 'monitor'
}

async function handleDeleteConversation(id) {
  if (!window.confirm('删除这个会话？')) return
  if (id === activeConversationId.value) newConversation()
  await deleteConversation(id)
  await loadConversations()
}

async function handleSend() {
  const text = input.value.trim()
  if (!text || loading.value) return
  const submittedSelection = {
    agentKey: selectedAgentKey.value,
    modelProviderKey: selectedModel.value?.providerKey || null,
    modelName: selectedModel.value?.modelName || null
  }
  runSelection.value = submittedSelection
  messages.value.push({ role: 'user', content: text, ...submittedSelection })
  input.value = ''
  loading.value = true
  runStatus.value = 'REASONING'
  runSteps.value = []
  runError.value = ''
  try {
    const accepted = await sendMessage(
      text,
      activeConversationId.value,
      selectedAgentKey.value,
      selectedModel.value?.providerKey || null,
      selectedModel.value?.modelName || null
    )
    activeConversationId.value = accepted.conversationId
    runTurnId.value = accepted.turnId
    await loadConversations()
    startPolling(accepted.conversationId, accepted.turnId)
  } catch (error) {
    loading.value = false
    runStatus.value = 'ERROR'
    runError.value = error.message || '请求失败，请稍后重试。'
    if (error instanceof ApiError && error.status === 401) {
      currentUser.value = null
      authError.value = '登录已过期，请重新登录。'
    }
  }
}

function startPolling(conversationId, turnId) {
  stopPolling()
  loading.value = true
  runTurnId.value = turnId
  runStatus.value = 'REASONING'
  const version = pollVersion
  const poll = async () => {
    if (version !== pollVersion || conversationId !== activeConversationId.value) return
    try {
      const progress = await getProgress(conversationId, turnId)
      if (version !== pollVersion) return
      runStatus.value = progress.turnStatus
      runSteps.value = progress.nodeList || []
      runError.value = progress.errorMessage || ''
      if (progress.turnStatus === 'COMPLETE') {
        if (progress.finalAnswer && !messages.value.some((item) => item.role === 'assistant' && item.turnId === turnId)) {
          messages.value.push({
            role: 'assistant',
            content: progress.finalAnswer,
            turnId,
            ...runSelection.value
          })
        }
        loading.value = false
        pollTimer = null
        await loadConversations()
        return
      }
      if (progress.turnStatus === 'ERROR') {
        loading.value = false
        pollTimer = null
        return
      }
      pollTimer = window.setTimeout(poll, 1500)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        currentUser.value = null
        authError.value = '登录已过期，请重新登录。'
        loading.value = false
        return
      }
      pollTimer = window.setTimeout(poll, 2000)
    }
  }
  poll()
}

function stopPolling() {
  pollVersion += 1
  if (pollTimer) window.clearTimeout(pollTimer)
  pollTimer = null
  loading.value = false
}

async function handleLogout() {
  logoutSubmitting.value = true
  try { await logout() } finally {
    stopPolling()
    currentUser.value = null
    workspaceView.value = 'chat'
    conversations.value = []
    agents.value = []
    models.value = []
    messages.value = []
    logoutSubmitting.value = false
  }
}

function nodeClass(node) { return `node-${String(node.nodeStatus || '').toLowerCase()}` }
function nodeLabel(node) { return node.nodeStatus === 'START' ? '执行中' : node.nodeStatus === 'SUCCESS' ? '完成' : node.nodeStatus === 'ERROR' ? '失败' : node.nodeName }
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
        <label>用户名<input v-model="username" autocomplete="username" placeholder="4-30 位字母、数字或下划线" required /></label>
        <label>密码<input v-model="password" :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'" type="password" placeholder="至少 8 位" required /></label>
        <label v-if="authMode === 'register'">确认密码<input v-model="confirmPassword" autocomplete="new-password" type="password" placeholder="再次输入密码" required /></label>
        <p v-if="authError" class="error">{{ authError }}</p>
        <p v-if="authNotice" class="notice">{{ authNotice }}</p>
        <button class="primary-button" type="submit" :disabled="authSubmitting">{{ authSubmitting ? '处理中...' : authMode === 'login' ? '登录' : '注册' }}</button>
      </form>
    </section>
  </div>

  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-head">
        <div class="brand-mark">AI Agent</div>
        <nav class="workspace-nav">
          <button :class="{ active: workspaceView === 'chat' }" @click="showChat">会话</button>
          <button v-if="currentUser.isAdmin" :class="{ active: workspaceView === 'monitor' }" @click="showMonitor">监控</button>
        </nav>
        <button v-if="workspaceView === 'chat'" class="new-button" @click="newConversation">＋ 新会话</button>
      </div>
      <div v-if="workspaceView === 'chat'" class="conversation-list">
        <div v-if="conversations.length === 0" class="sidebar-empty">还没有会话</div>
        <div v-for="conversation in conversations" :key="conversation.id" class="conversation-item" :class="{ active: activeConversationId === conversation.id }" @click="selectConversation(conversation.id)">
          <button class="conversation-select">{{ conversation.title || '未命名会话' }}</button>
          <span class="conversation-agent">{{ conversation.agentKey }} · {{ conversation.modelName || '默认模型' }}</span>
          <button class="delete-button" title="删除会话" @click.stop="handleDeleteConversation(conversation.id)">×</button>
        </div>
      </div>
    </aside>

    <section class="workspace">
      <header class="header">
        <div>
          <h1>{{ workspaceView === 'monitor' ? '运行监控' : activeConversationId ? (conversations.find((item) => item.id === activeConversationId)?.title || '会话') : '新会话' }}</h1>
          <span class="sub">{{ workspaceView === 'monitor' ? '管理员' : '工具调用与过程会显示在消息下方' }}</span>
        </div>
        <div class="account"><span class="username">{{ currentUser.username }}</span><button class="logout-button" :disabled="logoutSubmitting" @click="handleLogout">退出</button></div>
      </header>

      <AdminMonitor v-if="workspaceView === 'monitor' && currentUser.isAdmin" />

      <main v-else class="chat">
        <div v-if="messages.length === 0 && !runStatus" class="empty"><strong>开始和 Agent 对话</strong><span>当前会话的历史和工具过程会自动保存</span></div>
        <div v-for="(message, index) in messages" :key="`${message.turnId || 'draft'}-${index}`" class="row" :class="message.role">
          <div class="bubble">
            <span v-if="message.role === 'assistant' && message.modelName" class="message-model">
              {{ message.agentKey }} · {{ message.modelProviderKey }} / {{ message.modelName }}
            </span>
            {{ message.content }}
          </div>
        </div>
        <section v-if="runStatus" class="run-panel" :class="`run-${runStatus.toLowerCase()}`">
          <div class="run-head"><span>执行过程</span><span class="run-status">{{ runStatus === 'REASONING' ? '处理中' : runStatus === 'COMPLETE' ? '已完成' : '失败' }}</span></div>
          <div v-if="visibleRunSteps.length === 0 && runStatus === 'REASONING'" class="run-placeholder">正在准备 Agent...</div>
          <div v-for="node in visibleRunSteps" :key="node.structureType === 'multiple' ? node.aggrKey : node.dbId" class="step" :class="nodeClass(node)">
            <div class="step-head"><span>{{ node.nodeName }}</span><span>{{ nodeLabel(node) }}</span></div>
            <div v-if="node.structureType === 'multiple'" class="step-events">
              <div v-for="child in node.nodeList" :key="child.dbId" class="step-event"><span>{{ child.nodeStatus }}</span><pre>{{ child.content || '等待结果...' }}</pre></div>
            </div>
            <pre v-else-if="node.content">{{ node.content }}</pre>
          </div>
          <p v-if="runError" class="run-error">{{ runError }}</p>
        </section>
      </main>

      <footer v-if="workspaceView === 'chat'" class="footer">
        <select v-model="selectedAgentKey" class="agent-select footer-agent-select" aria-label="选择 Agent" title="切换后下一条消息生效" @change="handleAgentSelectionChange">
          <option v-for="agent in agents" :key="agent.agentKey" :value="agent.agentKey">{{ agent.agentKey }}</option>
        </select>
        <select v-model="selectedModelKey" class="agent-select footer-model-select" aria-label="选择模型" title="切换后下一条消息生效">
          <option
            v-for="model in models"
            :key="modelKey(model)"
            :value="modelKey(model)"
            :disabled="!model.available"
            :title="model.unavailableReason || ''"
          >{{ model.providerName }} · {{ model.displayName }}{{ model.available ? '' : '（暂不可用）' }}</option>
        </select>
        <input v-model="input" placeholder="输入消息，回车发送" :disabled="loading" @keyup.enter="handleSend" />
        <button :disabled="loading || !input.trim() || !selectedModel" @click="handleSend">发送</button>
      </footer>
    </section>
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { height: 100%; }
body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f5f6f8; color: #1f2937; }
button, input { font: inherit; } button { cursor: pointer; }
.loading-screen { display: grid; place-items: center; height: 100%; color: #6b7280; }
.auth-shell { display: grid; place-items: center; min-height: 100%; padding: 24px; }
.auth-panel { width: min(100%, 420px); padding: 36px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 12px 32px rgba(15, 23, 42, .08); }
.brand-mark { color: #4f7cff; font-weight: 700; letter-spacing: .04em; margin-bottom: 28px; }
.auth-panel h1 { font-size: 26px; margin-bottom: 8px; }.auth-subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
.auth-tabs { display: flex; gap: 22px; border-bottom: 1px solid #e5e7eb; margin-bottom: 22px; }.auth-tabs button { padding: 0 0 10px; border: 0; background: transparent; color: #9ca3af; border-bottom: 2px solid transparent; }.auth-tabs button.active { color: #4f7cff; border-bottom-color: #4f7cff; }
.auth-form { display: grid; gap: 16px; }.auth-form label { display: grid; gap: 7px; color: #374151; font-size: 14px; }.auth-form input { width: 100%; padding: 11px 12px; border: 1px solid #d1d5db; border-radius: 7px; outline: none; }.auth-form input:focus { border-color: #4f7cff; box-shadow: 0 0 0 3px rgba(79, 124, 255, .12); }
.primary-button { padding: 11px 16px; border: 0; border-radius: 7px; background: #4f7cff; color: #fff; }.primary-button:disabled, .logout-button:disabled { opacity: .55; cursor: not-allowed; }.error { color: #dc2626; font-size: 13px; line-height: 1.5; }.notice { color: #15803d; font-size: 13px; line-height: 1.5; }
.app-shell { display: flex; height: 100%; }.sidebar { width: 260px; flex: 0 0 260px; background: #202938; color: #dbe3ef; display: flex; flex-direction: column; }.sidebar-head { padding: 22px 18px 16px; border-bottom: 1px solid #344052; }.sidebar .brand-mark { margin-bottom: 18px; color: #92adff; }.new-button { width: 100%; padding: 9px 12px; border: 1px solid #52617a; border-radius: 6px; color: #eef3ff; background: #2c384b; text-align: left; }.new-button:hover { background: #35435a; }.conversation-list { overflow-y: auto; padding: 10px; }.sidebar-empty { padding: 18px 8px; color: #8f9caf; font-size: 13px; }.conversation-item { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; border-radius: 6px; }.conversation-item.active, .conversation-item:hover { background: #34445c; }.conversation-select { flex: 1; min-width: 0; overflow: hidden; padding: 9px 8px; border: 0; color: inherit; background: transparent; text-align: left; text-overflow: ellipsis; white-space: nowrap; }.delete-button { width: 28px; height: 28px; border: 0; background: transparent; color: #a9b4c5; font-size: 19px; }.delete-button:hover { color: #fff; }
.workspace-nav { display: flex; gap: 4px; margin-bottom: 12px; }
.workspace-nav button { flex: 1; padding: 7px 9px; border: 1px solid transparent; border-radius: 5px; background: transparent; color: #aeb9ca; }
.workspace-nav button:hover, .workspace-nav button.active { border-color: #52617a; background: #2c384b; color: #fff; }
.workspace { display: flex; flex: 1; min-width: 0; flex-direction: column; }.header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 24px; border-bottom: 1px solid #e5e7eb; background: #fff; }.header h1 { font-size: 20px; }.sub { color: #888; font-size: 13px; }.account { display: flex; align-items: center; gap: 12px; min-width: 0; }.username { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }.logout-button { padding: 7px 11px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #4b5563; font-size: 13px; }
.chat { flex: 1; overflow-y: auto; padding: 24px max(20px, calc((100% - 820px) / 2)); display: flex; flex-direction: column; gap: 12px; }.empty { display: grid; gap: 8px; place-items: center; color: #9ca3af; margin: auto; }.empty strong { color: #4b5563; font-size: 18px; }.empty span { font-size: 13px; }.row { display: flex; }.row.user { justify-content: flex-end; }.row.assistant { justify-content: flex-start; }.bubble { max-width: min(78%, 720px); padding: 10px 14px; border-radius: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }.user .bubble { background: #4f7cff; color: #fff; border-bottom-right-radius: 4px; }.assistant .bubble { background: #fff; color: #333; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
.message-model { display: block; margin-bottom: 5px; color: #7c8796; font-size: 11px; line-height: 1.4; }
.run-panel { width: min(100%, 720px); padding: 12px 14px; border: 1px solid #dbe2ed; border-radius: 8px; background: #fff; }.run-head, .step-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; font-size: 13px; font-weight: 600; }.run-status { color: #4f7cff; }.run-complete .run-status { color: #15803d; }.run-error .run-status, .run-error { color: #b91c1c; }.run-placeholder { padding: 12px 0 4px; color: #8b95a5; font-size: 13px; }.step { margin-top: 10px; padding: 10px; border-left: 3px solid #9db4ff; background: #f7f9fc; }.step-success { border-left-color: #57a773; }.step-error { border-left-color: #df6b6b; }.step-head span:last-child { color: #6b7280; font-size: 12px; font-weight: 400; }.step pre, .step-event pre { margin-top: 7px; color: #526071; font: 12px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }.step-events { display: grid; gap: 7px; }.step-event { padding-top: 7px; border-top: 1px solid #e5eaf1; }.step-event span { color: #7c8796; font-size: 11px; }
.footer { display: flex; gap: 10px; padding: 14px max(20px, calc((100% - 820px) / 2)); border-top: 1px solid #e5e7eb; background: #fff; }.footer input { flex: 1; min-width: 0; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; }.footer input:focus { border-color: #4f7cff; }.footer button { padding: 10px 22px; border: none; border-radius: 8px; background: #4f7cff; color: #fff; }.footer button:disabled { background: #b9c7f0; cursor: not-allowed; }
.agent-select { flex: 1; min-width: 0; padding: 5px 8px; border: 1px solid #52617a; border-radius: 5px; background: #2c384b; color: #eef3ff; font-size: 12px; }
.conversation-item { display: grid; grid-template-columns: minmax(0, 1fr) 28px; grid-template-rows: auto auto; column-gap: 4px; }
.conversation-select { grid-column: 1; grid-row: 1; padding-bottom: 3px; }
.conversation-agent { grid-column: 1; grid-row: 2; min-width: 0; overflow: hidden; padding: 0 8px 8px; color: #8f9caf; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.delete-button { grid-column: 2; grid-row: 1 / span 2; align-self: center; }
.footer-agent-select { flex: 0 0 auto; width: 110px; padding: 9px 8px; border-color: #d1d5db; background: #fff; color: #4b5563; }
.footer-model-select { flex: 0 1 210px; width: 210px; padding: 9px 8px; border-color: #d1d5db; background: #fff; color: #4b5563; }
@media (max-width: 720px) { .sidebar { width: 210px; flex-basis: 210px; }.header { padding: 14px 16px; }.sub { display: none; }.chat, .footer { padding-left: 14px; padding-right: 14px; }.bubble { max-width: 88%; } }
@media (max-width: 560px) { .app-shell { flex-direction: column; }.sidebar { width: 100%; flex: 0 0 auto; max-height: 142px; }.sidebar-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; }.sidebar .brand-mark { margin: 0; }.new-button { width: auto; }.conversation-list { display: flex; gap: 6px; overflow-x: auto; padding: 7px 10px; }.conversation-item { flex: 0 0 190px; margin: 0; background: #283447; }.footer { flex-wrap: wrap; }.footer-agent-select { flex: 0 0 105px; width: 105px; }.footer-model-select { flex: 0 0 calc(100% - 115px); width: auto; }.footer input { order: 3; flex: 1 1 calc(100% - 96px); }.footer button { order: 4; flex: 0 0 76px; } }
</style>
