<script setup>
import { onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { listAuditLogs } from '../../api/admin'
import AdminPageHeader from './AdminPageHeader.vue'

const rows = ref([])
const total = ref(0)
const page = ref(1)
const size = 20
const loading = ref(false)

onMounted(load)

async function load() {
  loading.value = true
  try {
    const result = await listAuditLogs({ page: page.value, size })
    rows.value = result.items || []
    total.value = result.total || 0
  } catch (error) {
    ElMessage.error(error.message || '操作审计加载失败。')
  } finally {
    loading.value = false
  }
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-'
}
</script>

<template>
  <main class="admin-workspace">
    <AdminPageHeader title="操作审计" description="记录管理员对用户、Agent 和供应商配置的变更。">
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
    </AdminPageHeader>
    <section class="admin-data-panel">
      <el-table :data="rows" v-loading="loading" row-key="id">
        <el-table-column label="时间" width="180"><template #default="{ row }">{{ formatDate(row.createdAt) }}</template></el-table-column>
        <el-table-column prop="username" label="管理员" width="140" />
        <el-table-column label="操作" min-width="180"><template #default="{ row }"><el-tag effect="plain">{{ row.action }}</el-tag></template></el-table-column>
        <el-table-column label="对象" min-width="190"><template #default="{ row }"><span>{{ row.targetType }}</span><small class="table-secondary">{{ row.targetId || '-' }}</small></template></el-table-column>
        <el-table-column label="结果" width="100"><template #default="{ row }"><el-tag :type="row.result === 'SUCCESS' ? 'success' : 'danger'" effect="plain">{{ row.result }}</el-tag></template></el-table-column>
        <el-table-column label="请求" min-width="260"><template #default="{ row }"><span>{{ row.requestMethod }}</span><small class="table-secondary breakable">{{ row.requestUri }}</small></template></el-table-column>
        <el-table-column prop="detail" label="详情" min-width="260" show-overflow-tooltip />
        <template #empty><el-empty class="empty-state" description="暂无审计记录" /></template>
      </el-table>
    </section>
    <div class="table-pagination"><el-pagination v-model:current-page="page" :page-size="size" :total="total" layout="prev, pager, next, total" @current-change="load" /></div>
  </main>
</template>

<style scoped>
.table-secondary { display: block; margin-top: 4px; color: #8992a2; font-size: 11px; }
.breakable { overflow-wrap: anywhere; }
.table-pagination { display: flex; justify-content: flex-end; padding-top: 14px; }
</style>
