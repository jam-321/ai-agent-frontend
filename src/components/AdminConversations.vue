<script setup>
import { computed, onMounted, ref } from 'vue'
import { getMonitoredConversation, listMonitoredConversations } from '../api/admin'

const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const error = ref('')
const detail = ref(null)
const detailLoading = ref(false)
const size = 20

onMounted(load)

const detailNodes = computed(() => detail.value?.nodes || [])

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
  detailLoading.value = true
  error.value = ''
  try {
    detail.value = await getMonitoredConversation(id)
  } catch (exception) {
    error.value = exception.message || '详情加载失败。'
  } finally {
    detailLoading.value = false
  }
}

function nodesForTurn(turnId, type = null) {
  return detailNodes.value.filter((node) => node.turnId === turnId && (!type || node.type === type))
}

function processNodesForTurn(turnId) {
  return nodesForTurn(turnId).filter((node) => node.type !== 'TOOL_CALL')
}

function turnStatus(turn) {
  if (turn.assistantTurn?.errorMessage) return 'ERROR'
  if (turn.assistantTurn) return 'COMPLETE'
  return 'REASONING'
}

function format(value) {
  return value
    ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
    : '-'
}

function display(value) {
  return value === null || value === undefined || value === '' ? '-' : value
}

function statusText(status) {
  return status === 'COMPLETE' ? '完成' : status === 'ERROR' ? '失败' : '执行中'
}

function attachmentUrl(assetId) {
  return `/api/admin/attachments/${encodeURIComponent(assetId)}/content`
}
</script>

<template>
  <main class="admin-page">
    <div class="page-toolbar">
      <div><h2>全部会话</h2><span>管理员可查看所有用户的会话和完整执行树</span></div>
      <button @click="load">{{ loading ? '刷新中...' : '刷新' }}</button>
    </div>
    <p v-if="error" class="page-error">{{ error }}</p>
    <div class="admin-table-wrap">
      <table>
        <thead><tr><th>ID</th><th>用户</th><th>标题</th><th>轮次</th><th>节点</th><th>状态</th><th>更新时间</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" @click="open(row.id)">
            <td>{{ row.id }}</td><td>{{ row.username }}</td><td>{{ row.title || '未命名会话' }}</td>
            <td>{{ row.turnCount }}</td><td>{{ row.nodeCount }}</td><td><span class="status" :class="row.latestStatus?.toLowerCase()">{{ statusText(row.latestStatus) }}</span></td><td>{{ format(row.updatedAt) }}</td>
          </tr>
          <tr v-if="!loading && !rows.length"><td colspan="7" class="empty-cell">暂无数据</td></tr>
        </tbody>
      </table>
    </div>
    <div class="pager"><button :disabled="page <= 1" @click="page--; load()">上一页</button><span>第 {{ page }} 页，共 {{ total }} 条</span><button :disabled="page * size >= total" @click="page++; load()">下一页</button></div>

    <div v-if="detail || detailLoading" class="drawer-backdrop" @click.self="detail = null">
      <aside class="drawer detail-drawer">
        <header>
          <div v-if="detail">
            <h2>{{ detail.conversation.title || '会话详情' }}</h2>
            <span>#{{ detail.conversation.id }} · {{ detail.conversation.username }}</span>
          </div>
          <span v-else>正在加载会话详情...</span>
          <button title="关闭" @click="detail = null">×</button>
        </header>

        <div v-if="detailLoading" class="detail-loading">加载中...</div>
        <div v-else-if="detail" class="tree-detail">
          <section class="conversation-meta">
            <div><span>会话 ID</span><strong>{{ detail.conversation.id }}</strong></div>
            <div><span>用户 ID</span><strong>{{ detail.conversation.userId }}</strong></div>
            <div><span>用户名</span><strong>{{ detail.conversation.username }}</strong></div>
            <div><span>问答轮次</span><strong>{{ detail.conversation.turnCount }}</strong></div>
            <div><span>过程节点</span><strong>{{ detail.conversation.nodeCount }}</strong></div>
            <div><span>更新时间</span><strong>{{ format(detail.conversation.updatedAt) }}</strong></div>
          </section>

          <section v-for="turn in detail.tree" :key="turn.turnId" class="turn-tree">
            <details open>
              <summary class="turn-summary">
                <span class="turn-index">TURN {{ String(turn.turnId).padStart(2, '0') }}</span>
                <span class="turn-summary-main">
                  <strong>{{ turn.userTurn?.agentKey || turn.assistantTurn?.agentKey || '未知 Agent' }}</strong>
                  <small>{{ turn.userTurn?.modelName || turn.assistantTurn?.modelName || '未知模型' }} · {{ turn.userTurn?.protocolType || turn.assistantTurn?.protocolType || '未知协议' }}</small>
                </span>
                <span class="turn-summary-time">{{ format(turn.userTurn?.createdAt || turn.assistantTurn?.createdAt) }}</span>
                <span class="status" :class="turnStatus(turn).toLowerCase()">{{ statusText(turnStatus(turn)) }}</span>
              </summary>

              <div class="turn-detail">
                <section class="detail-branch">
                  <h3><span class="branch-icon">◆</span>执行元数据</h3>
                  <dl class="metadata-list">
                    <div><dt>Agent</dt><dd>{{ display(turn.userTurn?.agentKey || turn.assistantTurn?.agentKey) }}</dd></div>
                    <div><dt>供应商</dt><dd>{{ display(turn.userTurn?.modelProviderKey || turn.assistantTurn?.modelProviderKey) }}</dd></div>
                    <div><dt>模型</dt><dd>{{ display(turn.userTurn?.modelName || turn.assistantTurn?.modelName) }}</dd></div>
                    <div><dt>协议</dt><dd>{{ display(turn.userTurn?.protocolType || turn.assistantTurn?.protocolType) }}</dd></div>
                    <div><dt>Trace ID</dt><dd class="breakable">{{ display(turn.userTurn?.traceId || turn.assistantTurn?.traceId) }}</dd></div>
                    <div><dt>用户时间</dt><dd>{{ format(turn.userTurn?.createdAt) }}</dd></div>
                    <div><dt>助手时间</dt><dd>{{ format(turn.assistantTurn?.createdAt) }}</dd></div>
                  </dl>
                </section>

                <section class="detail-branch message-branch">
                  <h3><span class="branch-icon message-icon">●</span>一级节点：问答终态</h3>
                  <article class="message-node user-message">
                    <div class="node-heading"><strong>用户输入</strong><span>{{ format(turn.userTurn?.createdAt) }}</span></div>
                    <div v-if="turn.userTurn?.attachmentIds?.length" class="message-images">
                      <a v-for="assetId in turn.userTurn.attachmentIds" :key="assetId" :href="attachmentUrl(assetId)" target="_blank" rel="noopener"><img :src="attachmentUrl(assetId)" alt="用户上传图片" /></a>
                    </div>
                    <pre>{{ turn.userTurn?.content || '-' }}</pre>
                    <p v-if="turn.userTurn?.errorMessage" class="node-error">{{ turn.userTurn.errorMessage }}</p>
                  </article>
                  <article class="message-node assistant-message">
                    <div class="node-heading"><strong>助手输出</strong><span>{{ format(turn.assistantTurn?.createdAt) }}</span></div>
                    <pre>{{ turn.assistantTurn?.content || '尚未完成' }}</pre>
                    <p v-if="turn.assistantTurn?.errorMessage" class="node-error">{{ turn.assistantTurn.errorMessage }}</p>
                  </article>
                </section>

                <section v-if="turn.toolCalls.length" class="detail-branch child-branch">
                  <details open>
                    <summary><span class="branch-label tool-label">二级节点：Tool 调用</span><span class="branch-count">{{ turn.toolCalls.length }} 个</span></summary>
                    <div class="tool-tree">
                      <details v-for="(tool, toolIndex) in turn.toolCalls" :key="tool.aggrKey" class="tool-node">
                        <summary><span class="tool-index">{{ String(toolIndex + 1).padStart(2, '0') }}</span><strong>{{ tool.toolName }}</strong><span class="tool-key">{{ tool.aggrKey }}</span><span class="status" :class="tool.status.toLowerCase()">{{ tool.status }}</span></summary>
                        <div class="tool-detail">
                          <div class="tool-summary"><span>聚合键：{{ tool.aggrKey }}</span><span>状态：{{ tool.status }}</span></div>
                          <div class="tool-payload"><b>请求入参摘要</b><pre>{{ tool.input || '-' }}</pre></div>
                          <div class="tool-payload"><b>返回结果摘要</b><pre>{{ tool.output || '暂无结果' }}</pre></div>
                          <details open class="event-list">
                            <summary>节点事件明细（{{ tool.events.length }} 条）</summary>
                            <article v-for="event in tool.events" :key="event.id" class="event-node">
                              <div class="event-heading"><strong>{{ event.status }}</strong><span>{{ event.nodeName }}</span><span>A{{ event.attemptNo }} / R{{ display(event.roundNo) }} / C{{ display(event.callIndex) }}</span><span>{{ format(event.createdAt) }}</span></div>
                              <pre>{{ event.content || '-' }}</pre>
                            </article>
                          </details>
                        </div>
                      </details>
                    </div>
                  </details>
                </section>

                <section v-if="processNodesForTurn(turn.turnId).length" class="detail-branch child-branch">
                  <details open>
                    <summary><span class="branch-label process-label">二级节点：其他过程事件</span><span class="branch-count">{{ processNodesForTurn(turn.turnId).length }} 个</span></summary>
                    <div class="process-tree">
                      <article v-for="node in processNodesForTurn(turn.turnId)" :key="node.id" class="process-node">
                        <div class="event-heading"><strong>{{ node.nodeName }}</strong><span>{{ node.type }}</span><span class="status" :class="node.status.toLowerCase()">{{ node.status }}</span><span>A{{ node.attemptNo }} / R{{ display(node.roundNo) }}</span><span>{{ format(node.createdAt) }}</span></div>
                        <pre>{{ node.content || '-' }}</pre>
                      </article>
                    </div>
                  </details>
                </section>
              </div>
            </details>
          </section>
        </div>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.status { display: inline-flex; align-items: center; justify-content: center; min-width: 58px; padding: 4px 8px; border: 1px solid #d8dee8; border-radius: 999px; color: #697386; background: #f7f8fa; font-size: 11px; font-weight: 650; letter-spacing: .02em; }
.status.complete, .status.success { border-color: #b9dfc9; color: #16794b; background: #effaf3; }
.status.error { border-color: #f0c1c1; color: #b42318; background: #fff3f2; }
.status.reasoning, .status.start, .status.processing { border-color: #bfd0f6; color: #315fbb; background: #f1f5ff; }
.detail-drawer { width: min(1080px, 96vw); background: #f4f6fa; }
.detail-drawer > header { position: sticky; top: 0; z-index: 2; background: rgba(255, 255, 255, .96); box-shadow: 0 1px 0 #e3e7ee, 0 5px 16px rgba(28, 39, 57, .05); }
.detail-drawer > header h2 { color: #202938; font-size: 18px; letter-spacing: 0; }
.detail-drawer > header span { color: #7a8494; }
.detail-loading { display: grid; place-items: center; height: 180px; color: #7b8493; }
.tree-detail { padding: 20px 28px 40px; }
.conversation-meta { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0; margin-bottom: 22px; border: 1px solid #dfe4eb; border-radius: 9px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(28, 39, 57, .04); }
.conversation-meta div { display: grid; gap: 6px; min-width: 0; min-height: 66px; padding: 12px 13px; border-right: 1px solid #e8ebf0; background: #fff; }
.conversation-meta div:last-child { border-right: 0; }
.conversation-meta span, .metadata-list dt { color: #7a8494; font-size: 11px; }
.conversation-meta strong { overflow: hidden; color: #202938; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.turn-tree { border-top: 1px solid #dfe4eb; padding: 13px 0; }
.turn-tree > details > summary, .child-branch > details > summary, .event-list > summary { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; cursor: pointer; color: #354052; font-size: 13px; list-style-position: outside; }
.turn-tree > details > summary { min-height: 62px; padding: 10px 14px; border: 1px solid #dce3ee; border-radius: 9px; background: #fff; box-shadow: 0 2px 8px rgba(28, 39, 57, .04); }
.turn-tree > details > summary:hover { border-color: #b9c9e6; background: #fbfcff; }
.turn-tree > details > summary strong { font-size: 15px; }
.turn-tree > details > summary span:not(.status), .branch-count, .tool-key { color: #7a8494; font-size: 11px; }
.turn-index { align-self: stretch; display: inline-flex; align-items: center; padding: 0 10px; margin: -10px 2px -10px -14px; border-radius: 8px 0 0 8px; color: #315fbb !important; background: #edf3ff; font-size: 10px !important; font-weight: 750; letter-spacing: .08em; }
.turn-summary-main { display: grid; gap: 3px; min-width: 180px; }
.turn-summary-main strong { color: #202938; }
.turn-summary-main small { color: #7a8494; font-size: 11px; font-weight: 400; }
.turn-summary-time { flex: 1; text-align: right; }
.tree-marker, .branch-label { color: #315fbb !important; font-weight: 700; }
.turn-detail { display: grid; gap: 15px; padding: 16px 0 4px 27px; border-left: 2px solid #d5e0f5; margin-left: 14px; }
.detail-branch { border: 1px solid #e0e5ed; border-radius: 8px; padding: 13px 14px; background: #fff; box-shadow: 0 2px 8px rgba(28, 39, 57, .035); }
.detail-branch h3 { display: flex; align-items: center; gap: 7px; margin-bottom: 11px; color: #394456; font-size: 12px; font-weight: 700; }
.branch-icon { color: #7287b4; font-size: 10px; }
.message-icon { color: #4d9b70; }
.metadata-list { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin: 0; border: 1px solid #e1e5eb; background: #e1e5eb; }
.metadata-list div { display: grid; grid-template-columns: 65px minmax(0, 1fr); gap: 7px; padding: 8px 10px; background: #f8f9fb; }
.metadata-list dt, .metadata-list dd { margin: 0; }
.metadata-list dd { min-width: 0; color: #354052; font-size: 12px; overflow-wrap: anywhere; }
.breakable { word-break: break-all; }
.message-branch { display: grid; gap: 9px; }
.message-node, .process-node, .event-node { border: 1px solid #e1e5eb; background: #f8f9fb; }
.message-node { padding: 12px 13px; }
.message-images { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 2px; }
.message-images a { display: block; }
.message-images img { display: block; width: 150px; height: 108px; border: 1px solid #d7deea; border-radius: 6px; object-fit: cover; background: #f5f7fa; transition: transform .15s ease, box-shadow .15s ease; }
.message-images img:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(28, 39, 57, .14); }
.user-message { border-left: 3px solid #86a7f5; }
.assistant-message { border-left: 3px solid #6bb58b; }
.node-heading, .event-heading, .tool-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; color: #7a8494; font-size: 11px; }
.node-heading strong, .event-heading strong { color: #354052; font-size: 12px; }
pre { max-height: 280px; overflow: auto; margin: 8px 0 0; padding: 10px 11px; border: 1px solid #e7eaf0; border-radius: 5px; background: #fbfcfe; color: #3f4b5d; font: 12px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.node-error { margin-top: 8px; color: #b42318; font-size: 12px; }
.child-branch > details > summary { margin-bottom: 10px; }
.tool-tree, .process-tree { display: grid; gap: 8px; }
.tool-node { border: 1px solid #dfe5f1; border-left: 3px solid #8198d1; border-radius: 7px; padding: 10px 12px; background: #fbfcff; }
.tool-node > summary { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; cursor: pointer; color: #354052; font-size: 12px; }
.tool-node > summary .tool-key { flex: 1; min-width: 120px; font-family: ui-monospace, Consolas, monospace; overflow-wrap: anywhere; }
.tool-index { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 5px; color: #315fbb; background: #eaf0ff; font: 700 10px ui-monospace, Consolas, monospace; }
.tool-detail { display: grid; gap: 9px; padding: 10px 0 2px; }
.tool-summary { justify-content: space-between; }
.tool-payload b { display: block; color: #687486; font-size: 11px; }
.tool-payload pre { max-height: 180px; }
.event-list { border-top: 1px solid #e1e5eb; padding-top: 8px; }
.event-list > summary { margin-bottom: 8px; color: #596577; }
.event-node, .process-node { padding: 9px 10px; }
.event-heading span, .tool-summary span { overflow-wrap: anywhere; }
.process-node { border-left: 3px solid #aeb8c9; }
.process-node pre, .event-node pre { max-height: 220px; }
@media (max-width: 720px) {
  .detail-drawer { width: 100%; }
  .tree-detail { padding: 14px 14px 28px; }
  .conversation-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .conversation-meta div:nth-child(2n) { border-right: 0; }
  .metadata-list { grid-template-columns: 1fr; }
  .turn-detail { padding-left: 8px; margin-left: 8px; }
  .turn-summary-time { flex-basis: 100%; order: 3; text-align: left; }
}
</style>
