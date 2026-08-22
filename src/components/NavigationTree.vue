<script setup>
import { ref } from 'vue'

defineProps({
  admin: Boolean,
  active: String
})

const emit = defineEmits(['navigate'])
const expanded = ref({ system: true, sessions: true })

const systemItems = [
  { key: 'admin-dashboard', label: '监控大盘', path: '/admin/dashboard' },
  { key: 'admin-conversations', label: '全部会话', path: '/admin/conversations' },
  { key: 'admin-agents', label: 'Agent 配置', path: '/admin/agents' },
  { key: 'admin-users', label: '用户管理', path: '/admin/users' },
  { key: 'admin-providers', label: '供应商配置', path: '/admin/providers' },
  { key: 'admin-audits', label: '操作审计', path: '/admin/audits' }
]

function toggle(key) {
  expanded.value[key] = !expanded.value[key]
}
</script>

<template>
  <nav class="tree-nav" aria-label="主导航">
    <section v-if="admin" class="nav-group">
      <button class="nav-group-title" @click="toggle('system')">
        <span class="tree-arrow">{{ expanded.system ? '▾' : '▸' }}</span>
        <span>系统管理</span>
      </button>
      <div v-show="expanded.system" class="nav-children">
        <button v-for="item in systemItems" :key="item.key" class="nav-item" :class="{ active: active === item.key }" @click="emit('navigate', item.path)">
          {{ item.label }}
        </button>
      </div>
    </section>
    <section class="nav-group">
      <button class="nav-group-title" @click="toggle('sessions')">
        <span class="tree-arrow">{{ expanded.sessions ? '▾' : '▸' }}</span>
        <span>会话管理</span>
      </button>
      <div v-show="expanded.sessions" class="nav-children">
        <button class="nav-item" :class="{ active: active === 'chat' }" @click="emit('navigate', '/chat')">会话列表</button>
      </div>
    </section>
  </nav>
</template>
