<script setup>
import { computed, onMounted, ref } from 'vue'
import { Delete, EditPen, Plus, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createAdminAgent,
  deleteAdminAgent,
  getAdminConfigOptions,
  listAdminAgents,
  listAdminProviders,
  updateAdminAgent
} from '../../api/admin'
import { prettyJson, runtimeConfigFromJson, runtimeConfigJson } from '../../utils/adminConfig'
import AdminPageHeader from './AdminPageHeader.vue'

const rows = ref([])
const providers = ref([])
const options = ref(null)
const loading = ref(false)
const saving = ref(false)
const drawerOpen = ref(false)
const editingExisting = ref(false)
const formRef = ref()
const form = ref(emptyForm())

const enabledProviders = computed(() => providers.value.filter((provider) => provider.enabled))
const selectedProvider = computed(() => providers.value.find(
  (provider) => provider.providerKey === form.value.modelProviderKey
))
const availableModels = computed(() => selectedProvider.value?.models || [])
const selectedFallbackProvider = computed(() => providers.value.find(
  (provider) => provider.providerKey === form.value.fallbackModelProviderKey
))
const availableFallbackModels = computed(() => selectedFallbackProvider.value?.models || [])
const configurablePlugins = computed(() => (options.value?.plugins || []).filter((plugin) => !plugin.system))
const systemPlugins = computed(() => (options.value?.plugins || []).filter((plugin) => plugin.system))
const jsonPreview = computed(() => prettyJson({
  enabled_plugins: form.value.enabledPlugins,
  enabled_tools: form.value.allTools ? null : form.value.enabledTools,
  magic_params: form.value.runtime ? JSON.parse(runtimeConfigJson(form.value.runtime)) : {}
}))

const rules = {
  agentKey: [
    { required: true, message: '请输入 Agent Key', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_-]{1,63}$/, message: '使用小写字母、数字、下划线或短横线', trigger: 'blur' }
  ],
  executionType: [{ required: true, message: '请选择执行类型', trigger: 'change' }],
  modelProviderKey: [{ required: true, message: '请选择模型供应商', trigger: 'change' }],
  modelName: [{ required: true, message: '请选择默认模型', trigger: 'change' }],
  systemPrompt: [{ required: true, message: '请输入系统提示词', trigger: 'blur' }]
}

onMounted(load)

async function load() {
  loading.value = true
  try {
    const [agentRows, providerRows, metadata] = await Promise.all([
      listAdminAgents(),
      listAdminProviders(),
      getAdminConfigOptions()
    ])
    rows.value = agentRows
    providers.value = providerRows
    options.value = metadata
  } catch (error) {
    ElMessage.error(error.message || 'Agent 配置加载失败。')
  } finally {
    loading.value = false
  }
}

function emptyForm() {
  return {
    agentKey: '',
    adminOnly: false,
    executionType: 'LOOP',
    executionKey: null,
    modelProviderKey: '',
    modelName: '',
    modelTemperature: 0.7,
    fallbackModelProviderKey: '',
    fallbackModelName: '',
    imageHistoryMode: 'SUMMARY_TOOL',
    systemPrompt: '',
    allTools: false,
    enabledTools: [],
    enabledPlugins: [],
    runtime: null
  }
}

function openCreate() {
  const provider = enabledProviders.value[0]
  form.value = {
    ...emptyForm(),
    modelProviderKey: provider?.providerKey || '',
    modelName: provider?.models?.[0]?.modelName || '',
    runtime: runtimeConfigFromJson('{}', options.value)
  }
  editingExisting.value = false
  drawerOpen.value = true
}

function openEdit(row) {
  form.value = {
    ...emptyForm(),
    agentKey: row.agentKey,
    adminOnly: row.adminOnly,
    executionType: row.executionType || 'LOOP',
    executionKey: row.executionKey || null,
    modelProviderKey: row.modelProviderKey,
    modelName: row.modelName,
    modelTemperature: row.modelTemperature ?? 0.7,
    fallbackModelProviderKey: row.fallbackModelProviderKey || '',
    fallbackModelName: row.fallbackModelName || '',
    imageHistoryMode: row.imageHistoryMode || 'SUMMARY_TOOL',
    systemPrompt: row.systemPrompt || '',
    allTools: row.enabledTools == null,
    enabledTools: row.enabledTools == null ? [] : [...row.enabledTools],
    enabledPlugins: [...(row.enabledPlugins || [])],
    runtime: runtimeConfigFromJson(row.magicParams, options.value)
  }
  editingExisting.value = true
  drawerOpen.value = true
}

function changeExecutionType(type) {
  if (type === 'WORKFLOW') {
    form.value.executionKey ||= options.value.workflowKeys[0] || null
  } else {
    form.value.executionKey = null
  }
}

function changeProvider() {
  form.value.modelName = availableModels.value[0]?.modelName || ''
}

function changeFallbackProvider() {
  form.value.fallbackModelName = availableFallbackModels.value[0]?.modelName || ''
}

async function save() {
  await formRef.value.validate()
  if (form.value.executionType === 'WORKFLOW' && !form.value.executionKey) {
    ElMessage.warning('Workflow 类型必须选择工作流定义。')
    return
  }
  const budget = form.value.runtime.budget
  if (Number(budget.maxOutputTokens) + Number(budget.safetyMarginTokens) >= Number(budget.maxContextTokens)) {
    ElMessage.warning('最大输出 Token 与安全余量之和必须小于上下文上限。')
    return
  }

  const payload = {
    agentKey: form.value.agentKey,
    adminOnly: form.value.adminOnly,
    executionType: form.value.executionType,
    executionKey: form.value.executionType === 'WORKFLOW' ? form.value.executionKey : null,
    systemPrompt: form.value.systemPrompt,
    enabledPlugins: JSON.stringify(form.value.enabledPlugins),
    enabledTools: form.value.allTools ? null : JSON.stringify(form.value.enabledTools),
    magicParams: runtimeConfigJson(form.value.runtime),
    imageHistoryMode: form.value.imageHistoryMode,
    modelProviderKey: form.value.modelProviderKey,
    modelName: form.value.modelName,
    modelTemperature: form.value.modelTemperature,
    fallbackModelProviderKey: form.value.fallbackModelProviderKey || null,
    fallbackModelName: form.value.fallbackModelName || null
  }

  saving.value = true
  try {
    if (editingExisting.value) await updateAdminAgent(form.value.agentKey, payload)
    else await createAdminAgent(payload)
    ElMessage.success(editingExisting.value ? 'Agent 配置已更新。' : 'Agent 已创建。')
    drawerOpen.value = false
    await load()
  } catch (error) {
    ElMessage.error(error.message || 'Agent 配置保存失败。')
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  await ElMessageBox.confirm(`确认删除 Agent “${row.agentKey}”吗？`, '删除 Agent', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  })
  try {
    await deleteAdminAgent(row.agentKey)
    ElMessage.success('Agent 已删除。')
    await load()
  } catch (error) {
    ElMessage.error(error.message || 'Agent 删除失败。')
  }
}

function toolLabel(tool) {
  return tool.description ? `${tool.name} - ${tool.description}` : tool.name
}
</script>

<template>
  <main class="admin-workspace">
    <AdminPageHeader title="Agent 配置" description="配置执行骨架、默认模型、工具能力和运行预算。">
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
      <el-button type="primary" :icon="Plus" @click="openCreate">新建 Agent</el-button>
    </AdminPageHeader>

    <section class="admin-data-panel">
      <el-table :data="rows" v-loading="loading" row-key="agentKey">
        <el-table-column label="Agent" min-width="170">
          <template #default="{ row }">
            <div class="primary-cell"><strong>{{ row.agentKey }}</strong><span>{{ row.executionKey || '标准循环' }}</span></div>
          </template>
        </el-table-column>
        <el-table-column label="访问范围" width="120">
          <template #default="{ row }"><el-tag :type="row.adminOnly ? 'warning' : 'info'" effect="plain">{{ row.adminOnly ? '仅管理员' : '普通用户' }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="executionType" label="执行类型" width="110" />
        <el-table-column label="默认模型" min-width="230">
          <template #default="{ row }"><span>{{ row.modelProviderName || row.modelProviderKey }}</span><small class="table-secondary">{{ row.modelName }}</small></template>
        </el-table-column>
        <el-table-column label="能力" min-width="220">
          <template #default="{ row }">
            <div class="tag-list">
              <el-tag size="small" effect="plain">{{ row.enabledTools == null ? '全部工具' : `${row.enabledTools.length} 个工具` }}</el-tag>
              <el-tag size="small" effect="plain" type="success">{{ row.enabledPlugins?.length || 0 }} 个插件</el-tag>
              <el-tag size="small" effect="plain" type="info">{{ row.imageHistoryMode }}</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :icon="EditPen" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="!['general', 'system_admin'].includes(row.agentKey)" link type="danger" :icon="Delete" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty class="empty-state" description="暂无 Agent 配置" /></template>
      </el-table>
    </section>

    <el-drawer v-model="drawerOpen" class="config-drawer" size="min(900px, 96vw)" destroy-on-close :title="editingExisting ? `编辑 Agent · ${form.agentKey}` : '新建 Agent'">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="config-form">
        <section class="config-section">
          <div class="config-section-heading"><div><h3>基础路由</h3><p>决定一次 Turn 使用哪种执行骨架和默认模型。</p></div></div>
          <div class="config-grid">
            <el-form-item label="Agent Key" prop="agentKey"><el-input v-model="form.agentKey" :disabled="editingExisting" /></el-form-item>
            <el-form-item label="访问范围"><div class="inline-switch"><el-switch v-model="form.adminOnly" :disabled="form.agentKey === 'system_admin'" /><span>仅管理员可选择</span></div></el-form-item>
            <el-form-item label="执行类型" prop="executionType">
              <el-select v-model="form.executionType" @change="changeExecutionType"><el-option v-for="type in options?.executionTypes || []" :key="type" :label="type" :value="type" /></el-select>
            </el-form-item>
            <el-form-item label="执行标识">
              <el-select v-if="form.executionType === 'WORKFLOW'" v-model="form.executionKey" placeholder="选择工作流"><el-option v-for="key in options?.workflowKeys || []" :key="key" :label="key" :value="key" /></el-select>
              <el-input v-else model-value="AgentLoop 内置执行器" disabled />
            </el-form-item>
            <el-form-item label="模型供应商" prop="modelProviderKey">
              <el-select v-model="form.modelProviderKey" filterable @change="changeProvider"><el-option v-for="provider in enabledProviders" :key="provider.providerKey" :label="provider.providerName" :value="provider.providerKey" /></el-select>
            </el-form-item>
            <el-form-item label="默认模型" prop="modelName">
              <el-select v-model="form.modelName" filterable><el-option v-for="model in availableModels" :key="model.modelName" :label="model.displayName" :value="model.modelName" /></el-select>
            </el-form-item>
            <el-form-item label="Temperature"><el-input-number v-model="form.modelTemperature" :min="0" :max="2" :step="0.1" :precision="1" /></el-form-item>
            <el-form-item label="降级模型供应商">
              <el-select v-model="form.fallbackModelProviderKey" clearable filterable placeholder="主模型失败时不自动降级" @change="changeFallbackProvider">
                <el-option v-for="provider in enabledProviders" :key="provider.providerKey" :label="provider.providerName" :value="provider.providerKey" />
              </el-select>
            </el-form-item>
            <el-form-item label="降级模型">
              <el-select v-model="form.fallbackModelName" clearable filterable :disabled="!form.fallbackModelProviderKey" placeholder="选择备用模型">
                <el-option v-for="model in availableFallbackModels" :key="model.modelName" :label="model.displayName" :value="model.modelName" />
              </el-select>
            </el-form-item>
            <el-form-item label="图片历史模式">
              <el-select v-model="form.imageHistoryMode"><el-option v-for="mode in options?.imageHistoryModes || []" :key="mode" :label="mode === 'FULL_IMAGE_HISTORY' ? '完整图片历史' : '摘要工具回查'" :value="mode" /></el-select>
            </el-form-item>
            <el-form-item label="系统提示词" prop="systemPrompt" class="wide-field"><el-input v-model="form.systemPrompt" type="textarea" :rows="6" resize="vertical" /></el-form-item>
          </div>
        </section>

        <section class="config-section">
          <div class="config-section-heading"><div><h3>能力装配</h3><p>Tool 和插件选项来自后端当前实际注册的 Registry。</p></div></div>
          <div class="config-grid">
            <el-form-item label="启用全部工具">
              <div class="inline-switch"><el-switch v-model="form.allTools" /><span>{{ form.allTools ? '包括未来新增工具' : '仅启用所选工具' }}</span></div>
            </el-form-item>
            <el-form-item label="系统插件">
              <div class="tag-list"><el-tag v-for="plugin in systemPlugins" :key="plugin.id" type="info" effect="plain">{{ plugin.id }}</el-tag></div>
            </el-form-item>
            <el-form-item label="启用工具" class="wide-field">
              <el-select v-model="form.enabledTools" multiple filterable collapse-tags :max-collapse-tags="4" :disabled="form.allTools" placeholder="选择 Agent 可调用的工具"><el-option v-for="tool in options?.tools || []" :key="tool.name" :label="toolLabel(tool)" :value="tool.name" /></el-select>
              <p class="field-note">显式工具清单更安全；“全部工具”会自动包含后续注册的新工具。</p>
            </el-form-item>
            <el-form-item label="启用插件" class="wide-field">
              <el-select v-model="form.enabledPlugins" multiple filterable placeholder="选择生命周期插件"><el-option v-for="plugin in configurablePlugins" :key="plugin.id" :label="plugin.id" :value="plugin.id" /></el-select>
            </el-form-item>
          </div>
        </section>

        <section v-if="form.runtime" class="config-section">
          <div class="config-section-heading"><div><h3>运行限制</h3><p>每个 Agent 可以调低限制，但不能突破后端 YAML 的全局安全上限。</p></div></div>
          <el-tabs>
            <el-tab-pane label="AgentLoop">
              <div class="config-grid runtime-grid">
                <el-form-item label="最大 Attempt"><el-input-number v-model="form.runtime.loop.maxAttempts" :min="1" :max="options.loopDefaults.maxAttempts" /></el-form-item>
                <el-form-item label="最大 Tool Round"><el-input-number v-model="form.runtime.loop.maxToolRounds" :min="1" :max="options.loopDefaults.maxToolRounds" /></el-form-item>
                <el-form-item label="单轮最大 Tool 数"><el-input-number v-model="form.runtime.loop.maxToolsPerRound" :min="0" :max="options.loopDefaults.maxToolsPerRound" /></el-form-item>
                <el-form-item label="最大执行时长（秒）"><el-input-number v-model="form.runtime.loop.maxRunDurationSeconds" :min="1" :max="options.loopDefaults.maxRunDurationSeconds" /></el-form-item>
                <el-form-item label="退化回复重试"><el-input-number v-model="form.runtime.loop.maxDegenerateRetries" :min="0" :max="options.loopDefaults.maxDegenerateRetries" /></el-form-item>
                <el-form-item label="同参数 Tool 上限"><el-input-number v-model="form.runtime.loop.maxSameToolSignature" :min="1" :max="options.loopDefaults.maxSameToolSignature" /></el-form-item>
              </div>
            </el-tab-pane>
            <el-tab-pane label="Token 预算">
              <div class="config-grid runtime-grid">
                <el-form-item label="Turn 总 Token 上限"><el-input-number v-model="form.runtime.budget.maxTokensPerTurn" :min="1" :max="options.budgetDefaults.maxTokensPerTurn" /></el-form-item>
                <el-form-item label="上下文 Token 上限"><el-input-number v-model="form.runtime.budget.maxContextTokens" :min="1024" :max="options.budgetDefaults.maxContextTokens" /></el-form-item>
                <el-form-item label="最大输出 Token"><el-input-number v-model="form.runtime.budget.maxOutputTokens" :min="128" :max="options.budgetDefaults.maxOutputTokens" /></el-form-item>
                <el-form-item label="安全余量 Token"><el-input-number v-model="form.runtime.budget.safetyMarginTokens" :min="0" :max="options.budgetDefaults.safetyMarginTokens" /></el-form-item>
                <el-form-item label="单次用户输入上限"><el-input-number v-model="form.runtime.budget.maxUserInputTokens" :min="1" :max="options.budgetDefaults.maxUserInputTokens" /></el-form-item>
              </div>
            </el-tab-pane>
            <el-tab-pane label="上下文压缩">
              <div class="config-grid runtime-grid">
                <el-form-item label="启用压缩"><div class="inline-switch"><el-switch v-model="form.runtime.memory.compactionEnabled" /><span>Turn 间摘要与 Tool Result 压缩</span></div></el-form-item>
                <el-form-item label="压缩触发 Token"><el-input-number v-model="form.runtime.memory.compactionTriggerTokens" :min="1024" :max="options.memoryDefaults.compactionTriggerTokens" /></el-form-item>
                <el-form-item label="保留最近 Token"><el-input-number v-model="form.runtime.memory.keepRecentTokens" :min="512" :max="options.memoryDefaults.keepRecentTokens" /></el-form-item>
                <el-form-item label="每个 Turn 回填工具对"><el-input-number v-model="form.runtime.memory.maxToolPairsPerTurn" :min="0" :max="options.memoryDefaults.maxToolPairsPerTurn" /></el-form-item>
                <el-form-item label="单 Tool Result 上限"><el-input-number v-model="form.runtime.memory.maxToolResultTokens" :min="256" :max="options.memoryDefaults.maxToolResultTokens" /></el-form-item>
                <el-form-item label="压缩预览字符"><el-input-number v-model="form.runtime.memory.compactedToolPreviewChars" :min="100" :max="options.memoryDefaults.compactedToolPreviewChars" /></el-form-item>
              </div>
            </el-tab-pane>
            <el-tab-pane label="Workflow">
              <div class="config-grid runtime-grid"><el-form-item label="最大步骤数"><el-input-number v-model="form.runtime.workflow.maxSteps" :min="1" :max="options.workflowDefaults.maxSteps" /></el-form-item></div>
            </el-tab-pane>
          </el-tabs>
        </section>

        <section class="config-section">
          <el-collapse>
            <el-collapse-item title="查看最终 JSON" name="json"><pre class="json-preview">{{ jsonPreview }}</pre></el-collapse-item>
          </el-collapse>
        </section>
      </el-form>
      <div class="drawer-actions"><el-button @click="drawerOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存配置</el-button></div>
    </el-drawer>
  </main>
</template>

<style scoped>
.primary-cell { display: grid; gap: 4px; }
.primary-cell strong { color: #273142; font-size: 13px; }
.primary-cell span, .table-secondary { color: #8992a2; font-size: 11px; }
.table-secondary { display: block; margin-top: 3px; }
.tag-list { display: flex; flex-wrap: wrap; gap: 5px; }
.config-form :deep(.el-select), .config-form :deep(.el-input-number) { width: 100%; }
.runtime-grid { padding-top: 6px; }
</style>
