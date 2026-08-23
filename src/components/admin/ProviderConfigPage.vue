<script setup>
import { computed, onMounted, ref } from 'vue'
import { Delete, EditPen, Plus, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  createAdminProvider,
  getAdminConfigOptions,
  listAdminProviders,
  updateAdminProvider
} from '../../api/admin'
import { prettyJson } from '../../utils/adminConfig'
import AdminPageHeader from './AdminPageHeader.vue'

const rows = ref([])
const options = ref(null)
const loading = ref(false)
const saving = ref(false)
const drawerOpen = ref(false)
const editingExisting = ref(false)
const formRef = ref()
const form = ref(emptyForm())

const modelsPreview = computed(() => prettyJson(form.value.models || []))
const rules = {
  providerKey: [
    { required: true, message: '请输入 Provider Key', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_-]{1,63}$/, message: '使用小写字母、数字、下划线或短横线', trigger: 'blur' }
  ],
  providerName: [{ required: true, message: '请输入供应商名称', trigger: 'blur' }],
  protocolType: [{ required: true, message: '请选择协议', trigger: 'change' }],
  baseUrl: [{ required: true, message: '请输入 Base URL', trigger: 'blur' }]
}

onMounted(load)

function emptyForm() {
  return {
    providerKey: '',
    providerName: '',
    protocolType: 'OPENAI_CHAT_COMPLETIONS',
    baseUrl: '',
    endpointPath: '/v1/chat/completions',
    apiKey: '',
    apiKeyConfigured: false,
    enabled: true,
    models: []
  }
}

async function load() {
  loading.value = true
  try {
    const [providerRows, metadata] = await Promise.all([
      listAdminProviders(),
      getAdminConfigOptions()
    ])
    rows.value = providerRows
    options.value = metadata
  } catch (error) {
    ElMessage.error(error.message || '供应商配置加载失败。')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = emptyForm()
  addModel()
  editingExisting.value = false
  drawerOpen.value = true
}

function openEdit(row) {
  form.value = {
    ...emptyForm(),
    ...JSON.parse(JSON.stringify(row)),
    apiKey: '',
    models: JSON.parse(JSON.stringify(row.models || []))
  }
  editingExisting.value = true
  drawerOpen.value = true
}

function changeProtocol(protocol) {
  const defaults = {
    OPENAI_CHAT_COMPLETIONS: '/v1/chat/completions',
    OPENAI_RESPONSES: '/v1/responses',
    ANTHROPIC_MESSAGES: '/v1/messages'
  }
  form.value.endpointPath = defaults[protocol] || ''
}

function addModel() {
  form.value.models.push({
    modelName: '',
    displayName: '',
    supportsImageInput: false,
    supportsTools: true
  })
}

function removeModel(index) {
  form.value.models.splice(index, 1)
}

async function save() {
  await formRef.value.validate()
  if (!editingExisting.value && !form.value.apiKey.trim()) {
    ElMessage.warning('新建供应商必须填写 API Key。')
    return
  }
  if (!form.value.models.length) {
    ElMessage.warning('至少配置一个模型。')
    return
  }
  const invalid = form.value.models.some((model) => !model.modelName?.trim() || !model.displayName?.trim())
  if (invalid) {
    ElMessage.warning('模型名称和展示名称不能为空。')
    return
  }
  const names = form.value.models.map((model) => model.modelName.trim())
  if (new Set(names).size !== names.length) {
    ElMessage.warning('同一供应商下的模型名称不能重复。')
    return
  }

  const payload = {
    providerKey: form.value.providerKey,
    providerName: form.value.providerName,
    protocolType: form.value.protocolType,
    baseUrl: form.value.baseUrl,
    endpointPath: form.value.endpointPath,
    apiKey: form.value.apiKey,
    enabled: form.value.enabled,
    models: form.value.models.map((model) => ({
      modelName: model.modelName.trim(),
      displayName: model.displayName.trim(),
      supportsImageInput: !!model.supportsImageInput,
      supportsTools: !!model.supportsTools
    }))
  }

  saving.value = true
  try {
    if (editingExisting.value) await updateAdminProvider(form.value.providerKey, payload)
    else await createAdminProvider(payload)
    ElMessage.success(editingExisting.value ? '供应商配置已更新。' : '供应商已创建。')
    drawerOpen.value = false
    await load()
  } catch (error) {
    ElMessage.error(error.message || '供应商配置保存失败。')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="admin-workspace">
    <AdminPageHeader title="供应商配置" description="维护协议连接、凭据状态和可选模型目录。">
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
      <el-button type="primary" :icon="Plus" @click="openCreate">新建供应商</el-button>
    </AdminPageHeader>

    <section class="admin-data-panel">
      <el-table :data="rows" v-loading="loading" row-key="providerKey">
        <el-table-column label="供应商" min-width="170">
          <template #default="{ row }"><div class="primary-cell"><strong>{{ row.providerName }}</strong><span>{{ row.providerKey }}</span></div></template>
        </el-table-column>
        <el-table-column label="状态" width="95"><template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'" effect="plain">{{ row.enabled ? '启用' : '停用' }}</el-tag></template></el-table-column>
        <el-table-column prop="protocolType" label="协议" min-width="210" />
        <el-table-column label="连接地址" min-width="280"><template #default="{ row }"><span class="breakable">{{ row.baseUrl }}{{ row.endpointPath }}</span></template></el-table-column>
        <el-table-column label="模型目录" width="110"><template #default="{ row }">{{ row.models?.length || 0 }} 个</template></el-table-column>
        <el-table-column label="API Key" width="110"><template #default="{ row }"><el-tag :type="row.apiKeyConfigured ? 'success' : 'danger'" effect="plain">{{ row.apiKeyConfigured ? '已配置' : '未配置' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="100" fixed="right"><template #default="{ row }"><el-button link type="primary" :icon="EditPen" @click="openEdit(row)">编辑</el-button></template></el-table-column>
        <template #empty><el-empty class="empty-state" description="暂无供应商配置" /></template>
      </el-table>
    </section>

    <el-drawer v-model="drawerOpen" class="config-drawer" size="min(920px, 96vw)" destroy-on-close :title="editingExisting ? `编辑供应商 · ${form.providerName}` : '新建供应商'">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="config-form">
        <section class="config-section">
          <div class="config-section-heading"><div><h3>连接配置</h3><p>协议选项只包含后端当前已经注册的适配器。</p></div><el-switch v-model="form.enabled" inline-prompt active-text="启用" inactive-text="停用" /></div>
          <div class="config-grid">
            <el-form-item label="Provider Key" prop="providerKey"><el-input v-model="form.providerKey" :disabled="editingExisting" /></el-form-item>
            <el-form-item label="显示名称" prop="providerName"><el-input v-model="form.providerName" /></el-form-item>
            <el-form-item label="协议" prop="protocolType"><el-select v-model="form.protocolType" @change="changeProtocol"><el-option v-for="protocol in options?.protocolTypes || []" :key="protocol" :label="protocol" :value="protocol" /></el-select></el-form-item>
            <el-form-item label="Endpoint Path"><el-input v-model="form.endpointPath" placeholder="/v1/chat/completions" /></el-form-item>
            <el-form-item label="Base URL" prop="baseUrl" class="wide-field"><el-input v-model="form.baseUrl" placeholder="https://api.example.com" /></el-form-item>
            <el-form-item label="API Key" class="wide-field">
              <el-input v-model="form.apiKey" type="password" show-password :placeholder="editingExisting && form.apiKeyConfigured ? '已配置，留空保持不变' : '输入 API Key'" autocomplete="new-password" />
              <p class="field-note">后端不会把已有密钥明文返回前端；编辑时留空表示继续使用原密钥。</p>
            </el-form-item>
          </div>
        </section>

        <section class="config-section">
          <div class="config-section-heading"><div><h3>模型目录</h3><p>模型能力绑定在具体模型上，决定前端是否允许图片和后端是否提供 Tool。</p></div><el-button :icon="Plus" @click="addModel">添加模型</el-button></div>
          <el-table :data="form.models" border row-key="modelName" class="model-editor-table desktop-model-editor">
            <el-table-column label="模型名称" min-width="210"><template #default="{ row }"><el-input v-model="row.modelName" placeholder="deepseek-chat" /></template></el-table-column>
            <el-table-column label="展示名称" min-width="190"><template #default="{ row }"><el-input v-model="row.displayName" placeholder="DeepSeek Chat" /></template></el-table-column>
            <el-table-column label="模型能力" min-width="230"><template #default="{ row }"><div class="model-capabilities"><el-checkbox v-model="row.supportsImageInput">图片输入</el-checkbox><el-checkbox v-model="row.supportsTools">Tool Calling</el-checkbox></div></template></el-table-column>
            <el-table-column width="60"><template #default="{ $index }"><el-button circle text type="danger" :icon="Delete" title="删除模型" @click="removeModel($index)" /></template></el-table-column>
            <template #empty><el-empty description="尚未添加模型" :image-size="64" /></template>
          </el-table>
          <div class="mobile-model-editor">
            <section v-for="(model, index) in form.models" :key="`${index}-${model.modelName}`" class="mobile-model-row">
              <header><strong>模型 {{ String(index + 1).padStart(2, '0') }}</strong><el-button text type="danger" :icon="Delete" @click="removeModel(index)">删除</el-button></header>
              <el-form-item label="模型名称"><el-input v-model="model.modelName" placeholder="deepseek-chat" /></el-form-item>
              <el-form-item label="展示名称"><el-input v-model="model.displayName" placeholder="DeepSeek Chat" /></el-form-item>
              <div class="model-capabilities"><el-checkbox v-model="model.supportsImageInput">图片输入</el-checkbox><el-checkbox v-model="model.supportsTools">Tool Calling</el-checkbox></div>
            </section>
            <el-empty v-if="!form.models.length" description="尚未添加模型" :image-size="64" />
          </div>
        </section>

        <section class="config-section">
          <el-collapse><el-collapse-item title="查看模型目录 JSON" name="json"><pre class="json-preview">{{ modelsPreview }}</pre></el-collapse-item></el-collapse>
        </section>
      </el-form>
      <div class="drawer-actions"><el-button @click="drawerOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存配置</el-button></div>
    </el-drawer>
  </main>
</template>

<style scoped>
.primary-cell { display: grid; gap: 4px; }
.primary-cell strong { color: #273142; font-size: 13px; }
.primary-cell span { color: #8992a2; font-size: 11px; }
.breakable { overflow-wrap: anywhere; }
.config-form :deep(.el-select) { width: 100%; }
.model-editor-table :deep(.el-table__cell) { padding: 8px 6px; }
.mobile-model-editor { display: none; }
@media (max-width: 760px) {
  .desktop-model-editor { display: none; }
  .mobile-model-editor { display: grid; }
  .mobile-model-row { padding: 14px 0; border-bottom: 1px solid #e4e7ec; }
  .mobile-model-row header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .mobile-model-row header strong { color: #354052; font-size: 12px; }
  .mobile-model-row :deep(.el-form-item) { margin-bottom: 12px; }
}
</style>
