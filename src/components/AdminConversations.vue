<script setup>
import { onMounted, ref } from 'vue'
import { getMonitoredConversation, listMonitoredConversations } from '../api/admin'

const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const error = ref('')
const detail = ref(null)
const size = 20

onMounted(load)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await listMonitoredConversations({ page: page.value, size })
    rows.value = result.items
    total.value = result.total
  } catch (exception) {
    error.value = exception.message || '会话加载失败。'
  } finally {
    loading.value = false
  }
}

async function open(id) {
  detail.value = null
  try { detail.value = await getMonitoredConversation(id) } catch (exception) { error.value = exception.message || '详情加载失败。' }
}

function format(value) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) : '-'
}
</script>

<template>
  <main class="admin-page">
    <div class="page-toolbar"><div><h2>全部会话</h2><span>管理员可查看所有用户的会话和执行过程</span></div><button @click="load">{{ loading ? '刷新中...' : '刷新' }}</button></div>
    <p v-if="error" class="page-error">{{ error }}</p>
    <div class="admin-table-wrap"><table><thead><tr><th>ID</th><th>用户</th><th>标题</th><th>轮次</th><th>节点</th><th>状态</th><th>更新时间</th></tr></thead><tbody>
      <tr v-for="row in rows" :key="row.id" @click="open(row.id)"><td>{{ row.id }}</td><td>{{ row.username }}</td><td>{{ row.title || '未命名会话' }}</td><td>{{ row.turnCount }}</td><td>{{ row.nodeCount }}</td><td>{{ row.latestStatus }}</td><td>{{ format(row.updatedAt) }}</td></tr>
      <tr v-if="!loading && !rows.length"><td colspan="7" class="empty-cell">暂无数据</td></tr>
    </tbody></table></div>
    <div class="pager"><button :disabled="page <= 1" @click="page--; load()">上一页</button><span>第 {{ page }} 页，共 {{ total }} 条</span><button :disabled="page * size >= total" @click="page++; load()">下一页</button></div>

    <div v-if="detail" class="drawer-backdrop" @click.self="detail = null"><aside class="drawer"><header><div><h2>{{ detail.conversation.title || '会话详情' }}</h2><span>#{{ detail.conversation.id }} · {{ detail.conversation.username }}</span></div><button @click="detail = null">×</button></header><div class="tree-detail">
      <section v-for="turn in detail.tree" :key="turn.turnId" class="turn-tree"><details open><summary>Turn {{ turn.turnId }} · {{ turn.userTurn?.agentKey || turn.assistantTurn?.agentKey || '-' }} · {{ turn.userTurn?.modelName || turn.assistantTurn?.modelName || '-' }}</summary><div class="turn-meta"><div><b>用户输入</b><pre>{{ turn.userTurn?.content || '-' }}</pre></div><div><b>助手输出</b><pre>{{ turn.assistantTurn?.content || '尚未完成' }}</pre></div><div v-if="turn.toolCalls.length" class="tool-tree"><details v-for="tool in turn.toolCalls" :key="tool.aggrKey" open><summary>Tool · {{ tool.toolName }} · {{ tool.status }}</summary><pre>入参：{{ tool.input || '-' }}\n\n结果：{{ tool.output || '暂无结果' }}</pre></details></div></div></details></section>
    </div></aside></div>
  </main>
</template>
