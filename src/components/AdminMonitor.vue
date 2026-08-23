<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  getMonitoredConversation,
  getMonitorOverview,
  getToolStatistics,
  listMonitoredConversations
} from '../api/admin'
import { groupModelCallEvents } from '../utils/modelCallEvents'

const overview = ref(null)
const conversations = ref([])
const tools = ref([])
const page = ref(1)
const size = 20
const total = ref(0)
const searchInput = ref('')
const activeSearch = ref('')
const loading = ref(false)
const error = ref('')
const selectedConversation = ref(null)
const detailLoading = ref(false)
const detailTimeline = computed(() => groupModelCallEvents(selectedConversation.value?.nodes || []))

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size)))
const overviewCards = computed(() => {
  if (!overview.value) return []
  return [
    { label: '用户', value: overview.value.userCount, secondary: `${overview.value.enabledUserCount} 启用` },
    { label: '会话', value: overview.value.conversationCount },
    { label: '问答记录', value: overview.value.turnCount },
    { label: '过程节点', value: overview.value.nodeCount },
    { label: '完成运行', value: overview.value.completedRunCount, tone: 'success' },
    { label: '失败运行', value: overview.value.failedRunCount, tone: 'error' },
    { label: '执行中', value: overview.value.reasoningRunCount, tone: 'active' },
    {
      label: '工具调用',
      value: overview.value.toolCallCount,
      secondary: `${overview.value.toolSuccessCount} 成功 / ${overview.value.toolErrorCount} 失败`
    },
    { label: '模型调用', value: formatNumber(overview.value.modelCallCount) },
    {
      label: 'Token 消耗',
      value: formatTokens(overview.value.totalTokens),
      secondary: `输入 ${formatTokens(overview.value.inputTokens)} / 输出 ${formatTokens(overview.value.outputTokens)}`
    },
    {
      label: '缓存命中率',
      value: cacheHitRate(
        overview.value.cachedInputTokens,
        overview.value.cacheMissInputTokens,
        overview.value.cacheUsageReportedCalls
      ),
      secondary: cacheUsageSummary(overview.value)
    }
  ]
})

onMounted(refresh)

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    const [overviewData, conversationData, toolData] = await Promise.all([
      getMonitorOverview(),
      listMonitoredConversations({ page: page.value, size, search: activeSearch.value }),
      getToolStatistics()
    ])
    overview.value = overviewData
    conversations.value = conversationData.items
    total.value = conversationData.total
    tools.value = toolData
  } catch (requestError) {
    error.value = requestError.message || '监控数据加载失败。'
  } finally {
    loading.value = false
  }
}

async function search() {
  activeSearch.value = searchInput.value.trim()
  page.value = 1
  await refresh()
}

async function changePage(nextPage) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return
  page.value = nextPage
  await refresh()
}

async function showDetail(conversationId) {
  detailLoading.value = true
  error.value = ''
  try {
    selectedConversation.value = await getMonitoredConversation(conversationId)
  } catch (requestError) {
    error.value = requestError.message || '会话详情加载失败。'
  } finally {
    detailLoading.value = false
  }
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(value))
}

function statusText(status) {
  return status === 'COMPLETE' ? '完成' : status === 'ERROR' ? '失败' : '执行中'
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}

function formatTokens(value) {
  const number = Number(value || 0)
  if (number >= 1000000) return `${(number / 1000000).toFixed(2)}M`
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`
  return formatNumber(number)
}

// 缓存命中率只统计供应商明确上报缓存明细的调用，避免把历史缺失数据误算成 0。
function cacheHitRate(hit, miss, reportedCalls) {
  if (!Number(reportedCalls || 0)) return '未上报'
  const cacheHit = Number(hit || 0)
  const cacheMiss = Number(miss || 0)
  const total = cacheHit + cacheMiss
  return total > 0 ? `${((cacheHit / total) * 100).toFixed(1)}%` : '0.0%'
}

function cacheUsageSummary(usage) {
  if (!Number(usage?.cacheUsageReportedCalls || 0)) return '暂无可计算的缓存数据'
  return `命中 ${formatTokens(usage.cachedInputTokens)} / 未命中 ${formatTokens(usage.cacheMissInputTokens)}`
}

function modelCacheReported(usage) {
  return usage && Object.prototype.hasOwnProperty.call(usage, 'cachedInputTokens')
}

function modelCacheHitRate(usage) {
  return cacheHitRate(usage?.cachedInputTokens, usage?.cacheMissInputTokens,
    modelCacheReported(usage) ? 1 : 0)
}
</script>

<template>
  <main class="monitor">
    <div class="monitor-toolbar">
      <form class="monitor-search" @submit.prevent="search">
        <input v-model="searchInput" placeholder="搜索用户名或会话标题" />
        <button type="submit">搜索</button>
      </form>
      <button class="refresh-button" :disabled="loading" @click="refresh">
        {{ loading ? '刷新中...' : '刷新' }}
      </button>
    </div>

    <p v-if="error" class="monitor-error">{{ error }}</p>

    <section class="stats-grid" aria-label="运行总览">
      <article v-for="card in overviewCards" :key="card.label" class="stat" :class="card.tone">
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
        <small v-if="card.secondary">{{ card.secondary }}</small>
      </article>
    </section>

    <section class="monitor-section">
      <div class="section-title">
        <h2>会话</h2>
        <span>共 {{ total }} 条</span>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>用户</th>
              <th>标题</th>
              <th>轮次</th>
              <th>节点</th>
              <th>模型调用</th>
              <th>Token</th>
              <th>缓存命中率</th>
              <th>状态</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="conversation in conversations" :key="conversation.id" @click="showDetail(conversation.id)">
              <td>{{ conversation.id }}</td>
              <td>{{ conversation.username }}</td>
              <td class="title-cell">{{ conversation.title || '未命名会话' }}</td>
              <td>{{ conversation.turnCount }}</td>
              <td>{{ conversation.nodeCount }}</td>
              <td>{{ conversation.modelCallCount }}</td>
              <td>{{ formatTokens(conversation.totalTokens) }}</td>
              <td>{{ cacheHitRate(conversation.cachedInputTokens, conversation.cacheMissInputTokens, conversation.cacheUsageReportedCalls) }}</td>
              <td><span class="status" :class="conversation.latestStatus.toLowerCase()">{{ statusText(conversation.latestStatus) }}</span></td>
              <td>{{ formatDate(conversation.updatedAt) }}</td>
            </tr>
            <tr v-if="!loading && conversations.length === 0">
              <td class="empty-table" colspan="10">暂无会话数据</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <button :disabled="page <= 1 || loading" @click="changePage(page - 1)">上一页</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button :disabled="page >= totalPages || loading" @click="changePage(page + 1)">下一页</button>
      </div>
    </section>

    <section class="monitor-section">
      <div class="section-title"><h2>工具统计</h2></div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>工具</th><th>调用</th><th>成功</th><th>失败</th><th>执行中</th><th>平均耗时</th></tr></thead>
          <tbody>
            <tr v-for="tool in tools" :key="tool.toolName">
              <td class="tool-name">{{ tool.toolName }}</td>
              <td>{{ tool.callCount }}</td>
              <td>{{ tool.successCount }}</td>
              <td>{{ tool.errorCount }}</td>
              <td>{{ tool.runningCount }}</td>
              <td>{{ tool.averageDurationMs == null ? '-' : `${tool.averageDurationMs} ms` }}</td>
            </tr>
            <tr v-if="!loading && tools.length === 0"><td class="empty-table" colspan="6">暂无工具调用</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="selectedConversation || detailLoading" class="detail-backdrop" @click.self="selectedConversation = null">
      <section class="detail-panel">
        <header>
          <div>
            <h2>{{ selectedConversation?.conversation.title || '会话详情' }}</h2>
            <span v-if="selectedConversation">#{{ selectedConversation.conversation.id }} · {{ selectedConversation.conversation.username }}</span>
          </div>
          <button title="关闭" @click="selectedConversation = null">×</button>
        </header>
        <div v-if="detailLoading" class="detail-loading">加载中...</div>
        <div v-else-if="selectedConversation" class="detail-content">
          <section class="detail-cache-summary">
            <div><span>缓存命中率</span><strong>{{ cacheHitRate(selectedConversation.conversation.cachedInputTokens, selectedConversation.conversation.cacheMissInputTokens, selectedConversation.conversation.cacheUsageReportedCalls) }}</strong></div>
            <div><span>命中 Token</span><strong>{{ selectedConversation.conversation.cacheUsageReportedCalls ? formatTokens(selectedConversation.conversation.cachedInputTokens) : '未上报' }}</strong></div>
            <div><span>未命中 Token</span><strong>{{ selectedConversation.conversation.cacheUsageReportedCalls ? formatTokens(selectedConversation.conversation.cacheMissInputTokens) : '未上报' }}</strong></div>
          </section>
          <section>
            <h3>问答终态</h3>
            <article v-for="turn in selectedConversation.turns" :key="turn.id" class="turn-row">
              <div><strong>Turn {{ turn.turnId }} · {{ turn.type }}</strong><span>{{ formatDate(turn.createdAt) }}</span></div>
              <pre>{{ turn.content }}</pre>
              <p v-if="turn.errorMessage" class="monitor-error">{{ turn.errorMessage }}</p>
            </article>
          </section>
          <section>
            <h3>节点时间线</h3>
            <template v-for="item in detailTimeline" :key="item.key">
              <article v-if="item.kind === 'modelCall'" class="node-row model-call-card">
                <div class="node-meta">
                  <strong>Turn {{ item.start.turnId }} · 模型调用</strong>
                  <span class="status" :class="item.status.toLowerCase()">{{ item.status }}</span>
                  <span>A{{ item.start.attemptNo }} / R{{ item.start.roundNo ?? '-' }}</span>
                  <span>{{ formatDate(item.start.createdAt) }}</span>
                </div>
                <div class="model-request-row">
                  <span>供应商 <b>{{ item.request.providerKey || '-' }}</b></span>
                  <span>请求模型 <b>{{ item.request.requestedModel || '-' }}</b></span>
                  <span>预计输入 <b>{{ item.request.estimatedInputTokens == null ? '-' : formatTokens(item.request.estimatedInputTokens) }}</b></span>
                  <span>调用用途 <b>{{ item.request.purpose || '-' }}</b></span>
                </div>
                <div v-if="item.usage" class="usage-row">
                  <span>输入 <b>{{ formatTokens(item.usage.inputTokens) }}</b></span>
                  <span>输出 <b>{{ formatTokens(item.usage.outputTokens) }}</b></span>
                  <span>缓存命中 <b>{{ modelCacheReported(item.usage) ? formatTokens(item.usage.cachedInputTokens) : '未上报' }}</b></span>
                  <span>缓存未命中 <b>{{ modelCacheReported(item.usage) ? formatTokens(item.usage.cacheMissInputTokens) : '未上报' }}</b></span>
                  <span>缓存命中率 <b>{{ modelCacheHitRate(item.usage) }}</b></span>
                  <span v-if="item.usage.cacheWriteInputTokens != null">缓存写入 <b>{{ formatTokens(item.usage.cacheWriteInputTokens) }}</b></span>
                  <span>总计 <b>{{ formatTokens(item.usage.totalTokens || ((item.usage.inputTokens || 0) + (item.usage.outputTokens || 0))) }}</b></span>
                  <span>耗时 <b>{{ item.usage.durationMs == null ? '-' : `${item.usage.durationMs} ms` }}</b></span>
                </div>
                <details class="model-event-details">
                  <summary>原始事件（{{ item.events.length }} 条）</summary>
                  <div v-for="event in item.events" :key="event.id" class="model-event-row">
                    <span>{{ event.status }} · {{ formatDate(event.createdAt) }}</span>
                    <pre>{{ event.content || '-' }}</pre>
                  </div>
                </details>
              </article>
              <article v-else class="node-row">
                <div class="node-meta">
                  <strong>Turn {{ item.node.turnId }} · {{ item.node.nodeName }}</strong>
                  <span class="status" :class="item.node.status.toLowerCase()">{{ item.node.status }}</span>
                  <span>A{{ item.node.attemptNo }} / R{{ item.node.roundNo ?? '-' }}</span>
                  <span>{{ formatDate(item.node.createdAt) }}</span>
                </div>
                <pre v-if="item.node.content">{{ item.node.content }}</pre>
              </article>
            </template>
          </section>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.monitor { flex: 1; overflow: auto; padding: 20px 24px 36px; background: #f5f6f8; }
.monitor-toolbar { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.monitor-search { display: flex; width: min(100%, 460px); gap: 8px; }
.monitor-search input { flex: 1; min-width: 0; padding: 9px 11px; border: 1px solid #ccd2dc; border-radius: 6px; background: #fff; outline: none; }
.monitor-search input:focus { border-color: #4f7cff; }
.monitor button { padding: 8px 12px; border: 1px solid #ccd2dc; border-radius: 6px; background: #fff; color: #384252; }
.monitor button:disabled { opacity: .5; cursor: not-allowed; }
.monitor-search button { border-color: #4f7cff; background: #4f7cff; color: #fff; }
.monitor-error { margin-bottom: 14px; color: #b42318; font-size: 13px; }
.detail-cache-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; border: 1px solid #dde3ec; background: #dde3ec; }
.detail-cache-summary div { display: grid; gap: 5px; padding: 12px; background: #f8faff; }
.detail-cache-summary span { color: #778294; font-size: 11px; }
.detail-cache-summary strong { color: #273852; font-size: 16px; }
.model-call-card { border-left: 3px solid #4f7cff; }
.model-request-row { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 8px; padding: 9px 10px; border-left: 3px solid #8b98ab; background: #f6f7f9; color: #687486; font-size: 11px; }
.model-request-row b, .usage-row b { color: #273852; font-size: 12px; }
.model-event-details { margin-top: 9px; color: #687486; font-size: 11px; }
.model-event-details > summary { cursor: pointer; }
.model-event-row { margin-top: 8px; }
.model-event-row > span { font-weight: 650; }
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(130px, 1fr)); border: 1px solid #dde1e8; border-radius: 7px; background: #fff; }
.stat { min-height: 104px; padding: 16px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.stat:nth-child(4n) { border-right: 0; }
.stat:nth-last-child(-n + 4) { border-bottom: 0; }
.stat span { display: block; color: #697386; font-size: 12px; }
.stat strong { display: block; margin-top: 7px; color: #202938; font-size: 25px; letter-spacing: 0; }
.stat small { display: block; margin-top: 3px; color: #8992a2; font-size: 11px; }
.stat.success strong { color: #16794b; }
.stat.error strong { color: #b42318; }
.stat.active strong { color: #315fbb; }
.monitor-section { margin-top: 20px; border-top: 1px solid #d9dee7; background: #fff; }
.section-title { display: flex; align-items: center; justify-content: space-between; padding: 14px 2px 11px; background: #f5f6f8; }
.section-title h2 { font-size: 15px; }
.section-title span { color: #7a8494; font-size: 12px; }
.table-scroll { overflow-x: auto; border: 1px solid #dde1e8; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 10px 12px; border-bottom: 1px solid #e9ebef; text-align: left; white-space: nowrap; }
th { background: #f8f9fb; color: #626d7e; font-size: 12px; font-weight: 600; }
tbody tr:last-child td { border-bottom: 0; }
tbody tr { transition: background .12s ease; }
tbody tr:hover { background: #f6f8fc; }
.monitor-section:first-of-type tbody tr { cursor: pointer; }
.title-cell { max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
.tool-name { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.status { display: inline-block; min-width: 48px; color: #697386; font-size: 12px; }
.status.complete, .status.success { color: #16794b; }
.status.error { color: #b42318; }
.status.reasoning, .status.start, .status.processing { color: #315fbb; }
.empty-table { height: 76px; color: #8b94a3; text-align: center; }
.pagination { display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding-top: 10px; color: #697386; font-size: 12px; }
.detail-backdrop { position: fixed; inset: 0; z-index: 20; display: flex; justify-content: flex-end; background: rgba(24, 31, 43, .28); }
.detail-panel { display: flex; width: min(760px, 92vw); height: 100%; flex-direction: column; background: #fff; box-shadow: -8px 0 24px rgba(15, 23, 42, .12); }
.detail-panel > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 17px 20px; border-bottom: 1px solid #e2e5ea; }
.detail-panel h2 { font-size: 17px; }
.detail-panel header span { color: #7b8493; font-size: 12px; }
.detail-panel header button { width: 32px; height: 32px; padding: 0; border: 0; font-size: 24px; }
.detail-loading { margin: auto; color: #7b8493; }
.detail-content { overflow-y: auto; padding: 18px 20px 30px; }
.detail-content section + section { margin-top: 24px; }
.detail-content h3 { margin-bottom: 10px; color: #404a59; font-size: 14px; }
.turn-row, .node-row { padding: 11px 0; border-top: 1px solid #e5e8ed; }
.turn-row > div, .node-meta { display: flex; align-items: center; gap: 10px; color: #7a8493; font-size: 11px; }
.turn-row strong, .node-meta strong { color: #3d4654; font-size: 12px; }
.turn-row pre, .node-row pre { max-height: 280px; overflow: auto; margin-top: 8px; padding: 10px; background: #f7f8fa; color: #485465; font: 12px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.usage-row { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 9px; padding: 9px 10px; border-left: 3px solid #4f7cff; background: #f2f6ff; color: #697386; font-size: 11px; }
.usage-row b { color: #263750; font-size: 12px; }
@media (max-width: 900px) {
  .stats-grid { grid-template-columns: repeat(2, minmax(130px, 1fr)); }
  .stat:nth-child(4n) { border-right: 1px solid #e5e7eb; }
  .stat:nth-last-child(-n + 4) { border-bottom: 1px solid #e5e7eb; }
  .stat:nth-child(2n) { border-right: 0; }
  .stat:nth-last-child(-n + 2) { border-bottom: 0; }
}
@media (max-width: 560px) {
  .monitor { padding: 14px 12px 24px; }
  .monitor-toolbar { align-items: stretch; flex-direction: column; }
  .monitor-search { width: 100%; }
  .refresh-button { align-self: flex-end; }
}
</style>
