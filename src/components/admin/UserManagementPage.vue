<script setup>
import { onMounted, ref } from 'vue'
import { EditPen, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { listAdminUsers, updateAdminUser } from '../../api/admin'
import AdminPageHeader from './AdminPageHeader.vue'

const rows = ref([])
const total = ref(0)
const page = ref(1)
const size = 20
const loading = ref(false)
const saving = ref(false)
const dialogOpen = ref(false)
const form = ref({ id: null, username: '', admin: false, enabled: true })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const result = await listAdminUsers({ page: page.value, size })
    rows.value = result.items || []
    total.value = result.total || 0
  } catch (error) {
    ElMessage.error(error.message || '用户列表加载失败。')
  } finally {
    loading.value = false
  }
}

function edit(row) {
  form.value = { id: row.id, username: row.username, admin: row.admin, enabled: row.enabled }
  dialogOpen.value = true
}

async function save() {
  saving.value = true
  try {
    await updateAdminUser(form.value.id, { admin: form.value.admin, enabled: form.value.enabled })
    ElMessage.success('用户状态已更新。')
    dialogOpen.value = false
    await load()
  } catch (error) {
    ElMessage.error(error.message || '用户状态更新失败。')
  } finally {
    saving.value = false
  }
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-'
}
</script>

<template>
  <main class="admin-workspace">
    <AdminPageHeader title="用户管理" description="维护用户启用状态和管理员身份。">
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
    </AdminPageHeader>
    <section class="admin-data-panel">
      <el-table :data="rows" v-loading="loading" row-key="id">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="username" label="用户名" min-width="220" />
        <el-table-column label="管理员" width="120"><template #default="{ row }"><el-tag :type="row.admin ? 'warning' : 'info'" effect="plain">{{ row.admin ? '管理员' : '普通用户' }}</el-tag></template></el-table-column>
        <el-table-column label="账号状态" width="120"><template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'danger'" effect="plain">{{ row.enabled ? '已启用' : '已停用' }}</el-tag></template></el-table-column>
        <el-table-column label="创建时间" min-width="190"><template #default="{ row }">{{ formatDate(row.createdAt) }}</template></el-table-column>
        <el-table-column label="操作" width="100" fixed="right"><template #default="{ row }"><el-button link type="primary" :icon="EditPen" @click="edit(row)">编辑</el-button></template></el-table-column>
        <template #empty><el-empty class="empty-state" description="暂无用户" /></template>
      </el-table>
    </section>
    <div class="table-pagination"><el-pagination v-model:current-page="page" :page-size="size" :total="total" layout="prev, pager, next, total" @current-change="load" /></div>

    <el-dialog v-model="dialogOpen" width="430px" title="编辑用户" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="用户名"><el-input :model-value="form.username" disabled /></el-form-item>
        <el-form-item label="管理员权限"><div class="inline-switch"><el-switch v-model="form.admin" /><span>{{ form.admin ? '可以访问系统管理功能' : '仅访问自己的会话' }}</span></div></el-form-item>
        <el-form-item label="账号状态"><div class="inline-switch"><el-switch v-model="form.enabled" /><span>{{ form.enabled ? '允许登录' : '禁止登录' }}</span></div></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
  </main>
</template>

<style scoped>
.table-pagination { display: flex; justify-content: flex-end; padding-top: 14px; }
</style>
