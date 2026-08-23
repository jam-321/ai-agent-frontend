function objectOrEmpty(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function withDefaults(source, defaults) {
  return Object.fromEntries(
    Object.entries(defaults || {}).map(([key, fallback]) => [
      key,
      source?.[key] === undefined || source?.[key] === null ? fallback : source[key]
    ])
  )
}

/** 旧版 loop 参数允许直接放在根节点，这里兼容读取后统一输出固定四段骨架。 */
export function runtimeConfigFromJson(magicParams, options) {
  const parsed = objectOrEmpty(magicParams)
  const loopSource = parsed.loop && typeof parsed.loop === 'object' ? parsed.loop : parsed
  return {
    loop: withDefaults(loopSource, options.loopDefaults),
    budget: withDefaults(parsed.budget, options.budgetDefaults),
    memory: withDefaults(parsed.memory, options.memoryDefaults),
    workflow: withDefaults(parsed.workflow, options.workflowDefaults)
  }
}

export function runtimeConfigJson(runtime) {
  return JSON.stringify({
    loop: { ...runtime.loop },
    budget: { ...runtime.budget },
    memory: { ...runtime.memory },
    workflow: { ...runtime.workflow }
  })
}

export function prettyJson(value) {
  return JSON.stringify(value, null, 2)
}
