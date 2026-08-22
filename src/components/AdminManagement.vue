<script setup>
import { computed, onMounted, ref } from 'vue'
import { createAdminAgent, createAdminProvider, deleteAdminAgent, listAdminAgents, listAdminProviders, listAdminUsers, listAuditLogs, updateAdminAgent, updateAdminProvider, updateAdminUser } from '../api/admin'

const props = defineProps({ mode: { type: String, required: true } })
const rows = ref([])
const loading = ref(false)
const error = ref('')
const editing = ref(null)
const editingExisting = ref(false)
const form = ref({})
const title = computed(() => ({ users: '用户管理', agents: 'Agent 配置', providers: '供应商配置', audits: '操作审计' })[props.mode])

onMounted(load)

async function load() {
  loading.value = true; error.value = ''
  try {
    const result = props.mode === 'users' ? await listAdminUsers() : props.mode === 'agents' ? await listAdminAgents() : props.mode === 'providers' ? await listAdminProviders() : await listAuditLogs()
    rows.value = result.items || result
  } catch (exception) { error.value = exception.message || '数据加载失败。' } finally { loading.value = false }
}

function edit(row) { editing.value = row; editingExisting.value = true; form.value = JSON.parse(JSON.stringify(row)) }
function cancel() { editing.value = null; editingExisting.value = false; form.value = {} }

async function save() {
  try {
    if (props.mode === 'users') await updateAdminUser(form.value.id, { admin: form.value.admin, enabled: form.value.enabled })
    if (props.mode === 'agents') await updateAdminAgent(form.value.agentKey, form.value)
    if (props.mode === 'providers') await updateAdminProvider(form.value.providerKey, { ...form.value, models: parseModels(form.value.models) })
    cancel(); await load()
  } catch (exception) { error.value = exception.message || '保存失败。' }
}

async function create() {
  if (props.mode === 'agents') { editing.value = {}; editingExisting.value = false; form.value = { agentKey: '', executionType: 'LOOP', modelProviderKey: 'deepseek', modelName: 'deepseek-v4-flash', modelTemperature: 0.7, enabledPlugins: '[]', enabledTools: 'null', magicParams: '{}', imageHistoryMode: 'SUMMARY_TOOL' }; return }
  if (props.mode === 'providers') { editing.value = {}; editingExisting.value = false; form.value = { providerKey: '', providerName: '', protocolType: 'OPENAI_CHAT_COMPLETIONS', baseUrl: '', endpointPath: '/v1/chat/completions', apiKey: '', models: '[]', enabled: true }; return }
}

async function createSave() {
  try {
    if (props.mode === 'agents') await createAdminAgent(form.value)
    else await createAdminProvider({ ...form.value, models: parseModels(form.value.models) })
    cancel(); await load()
  } catch (exception) { error.value = exception.message || '创建失败。' }
}

async function remove(row) { if (window.confirm(`删除 Agent ${row.agentKey}？`)) { await deleteAdminAgent(row.agentKey); await load() } }
function parseModels(value) { try { return typeof value === 'string' ? JSON.parse(value || '[]') : value } catch { throw new Error('模型目录必须是合法 JSON 数组。') } }
function modelText(row) { return JSON.stringify(row.models || [], null, 2) }
function date(value) { return value ? new Date(value).toLocaleString('zh-CN') : '-' }
</script>

<template>
  <main class="admin-page"><div class="page-toolbar"><div><h2>{{ title }}</h2><span>敏感凭据只显示配置状态，不返回明文</span></div><div><button v-if="mode === 'agents' || mode === 'providers'" @click="create">新建</button><button @click="load">刷新</button></div></div><p v-if="error" class="page-error">{{ error }}</p>
    <div v-if="mode === 'users'" class="admin-table-wrap"><table><thead><tr><th>ID</th><th>用户名</th><th>管理员</th><th>启用</th><th>创建时间</th><th>操作</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id"><td>{{ row.id }}</td><td>{{ row.username }}</td><td>{{ row.admin ? '是' : '否' }}</td><td>{{ row.enabled ? '是' : '否' }}</td><td>{{ date(row.createdAt) }}</td><td><button class="text-button" @click="edit(row)">编辑</button></td></tr></tbody></table></div>
    <div v-else-if="mode === 'agents'" class="admin-table-wrap"><table><thead><tr><th>Agent</th><th>执行类型</th><th>默认模型</th><th>温度</th><th>工具</th><th>操作</th></tr></thead><tbody><tr v-for="row in rows" :key="row.agentKey"><td>{{ row.agentKey }}</td><td>{{ row.executionType }}</td><td>{{ row.modelProviderKey }} / {{ row.modelName }}</td><td>{{ row.modelTemperature }}</td><td>{{ row.enabledTools == null ? '全部' : [...row.enabledTools].join(', ') }}</td><td><button class="text-button" @click="edit(row)">编辑</button><button v-if="row.agentKey !== 'general'" class="text-button danger" @click="remove(row)">删除</button></td></tr></tbody></table></div>
    <div v-else-if="mode === 'providers'" class="admin-table-wrap"><table><thead><tr><th>供应商</th><th>协议</th><th>Base URL</th><th>模型</th><th>Key</th><th>操作</th></tr></thead><tbody><tr v-for="row in rows" :key="row.providerKey"><td>{{ row.providerName }}<small>{{ row.providerKey }}</small></td><td>{{ row.protocolType }}</td><td>{{ row.baseUrl }}</td><td>{{ row.models.length }}</td><td>{{ row.apiKeyConfigured ? '已配置' : '未配置' }}</td><td><button class="text-button" @click="edit({ ...row, models: modelText(row), apiKey: '' })">编辑</button></td></tr></tbody></table></div>
    <div v-else class="admin-table-wrap"><table><thead><tr><th>时间</th><th>用户</th><th>操作</th><th>对象</th><th>结果</th><th>请求</th><th>详情</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id"><td>{{ date(row.createdAt) }}</td><td>{{ row.username }}</td><td>{{ row.action }}</td><td>{{ row.targetType }} {{ row.targetId }}</td><td>{{ row.result }}</td><td>{{ row.requestMethod }} {{ row.requestUri }}</td><td>{{ row.detail || '-' }}</td></tr></tbody></table></div>

    <div v-if="editing" class="modal-backdrop"><form class="edit-modal" @submit.prevent="editingExisting ? save() : createSave()"><header><h3>{{ editingExisting ? '编辑' : '新建' }}{{ title }}</h3><button type="button" @click="cancel">×</button></header>
      <label v-if="mode === 'users'">管理员 <input v-model="form.admin" type="checkbox" /></label><label v-if="mode === 'users'">启用 <input v-model="form.enabled" type="checkbox" /></label>
      <template v-if="mode === 'agents'"><label>Agent Key<input v-model="form.agentKey" :disabled="!!form.id" required /></label><label>执行类型<input v-model="form.executionType" /></label><label>执行标识<input v-model="form.executionKey" /></label><label>模型供应商<input v-model="form.modelProviderKey" required /></label><label>模型名称<input v-model="form.modelName" required /></label><label>Temperature<input v-model.number="form.modelTemperature" type="number" step="0.1" min="0" max="2" /></label><label>图片历史模式<select v-model="form.imageHistoryMode"><option value="SUMMARY_TOOL">摘要工具</option><option value="FULL_IMAGE_HISTORY">完整图片历史</option></select></label><label>系统提示词<textarea v-model="form.systemPrompt" rows="5" /></label><label>启用工具 JSON<textarea v-model="form.enabledTools" rows="3" /></label><label>插件 JSON<textarea v-model="form.enabledPlugins" rows="3" /></label><label>运行参数 JSON<textarea v-model="form.magicParams" rows="4" /></label></template>
      <template v-if="mode === 'providers'"><label>Provider Key<input v-model="form.providerKey" :disabled="!!form.id" required /></label><label>名称<input v-model="form.providerName" required /></label><label>协议<input v-model="form.protocolType" required /></label><label>Base URL<input v-model="form.baseUrl" required /></label><label>Endpoint Path<input v-model="form.endpointPath" /></label><label>API Key（留空保持不变）<input v-model="form.apiKey" type="password" /></label><label>模型目录 JSON<textarea v-model="form.models" rows="8" /></label></template>
      <button class="primary-button" type="submit">保存</button>
    </form></div>
  </main>
</template>
