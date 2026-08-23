/**
 * 将同一次模型调用的 START 与 SUCCESS/ERROR 聚合成一个时间线项目。
 * 原始事件继续保留在 events 中，既避免界面误判为多次调用，也不损失诊断信息。
 */
export function groupModelCallEvents(nodes = []) {
  const items = []
  const groups = new Map()

  for (const node of nodes) {
    if (node.type !== 'MODEL_CALL' || !node.aggrKey) {
      items.push({ kind: 'node', key: `node-${node.id}`, node })
      continue
    }

    let group = groups.get(node.aggrKey)
    if (!group) {
      group = {
        kind: 'modelCall',
        key: `model-call-${node.aggrKey}`,
        aggrKey: node.aggrKey,
        events: []
      }
      groups.set(node.aggrKey, group)
      items.push(group)
    }
    group.events.push(node)
  }

  return items.map((item) => item.kind === 'modelCall' ? completeModelCall(item) : item)
}

export function parseNodeContent(node) {
  if (!node?.content) return null
  try {
    return JSON.parse(node.content)
  } catch {
    return null
  }
}

function completeModelCall(group) {
  const events = [...group.events].sort((left, right) => left.id - right.id)
  const start = events.find((event) => event.status === 'START') || events[0]
  const terminal = [...events]
    .reverse()
    .find((event) => event.status === 'SUCCESS' || event.status === 'ERROR')
  const status = terminal?.status || 'START'

  return {
    ...group,
    events,
    start,
    terminal,
    status,
    request: parseNodeContent(start) || {},
    // Token usage 只有供应商成功响应后才有意义，START 阶段不伪造 0 值。
    usage: status === 'SUCCESS' ? parseNodeContent(terminal) : null
  }
}
