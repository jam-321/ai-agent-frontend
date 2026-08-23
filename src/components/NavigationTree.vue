<script setup>
import { markRaw, ref } from 'vue'
import {
  ArrowDown,
  ArrowRight,
  ChatDotRound,
  Connection,
  Cpu,
  DataAnalysis,
  Document,
  Setting,
  User
} from '@element-plus/icons-vue'

defineProps({
  admin: Boolean,
  active: String
})

const emit = defineEmits(['navigate'])
const expanded = ref({ system: true, sessions: true })

const systemItems = [
  { key: 'admin-dashboard', label: '监控大盘', path: '/admin/dashboard', icon: markRaw(DataAnalysis) },
  { key: 'admin-conversations', label: '全部会话', path: '/admin/conversations', icon: markRaw(ChatDotRound) },
  { key: 'admin-agents', label: 'Agent 配置', path: '/admin/agents', icon: markRaw(Cpu) },
  { key: 'admin-users', label: '用户管理', path: '/admin/users', icon: markRaw(User) },
  { key: 'admin-providers', label: '供应商配置', path: '/admin/providers', icon: markRaw(Connection) },
  { key: 'admin-audits', label: '操作审计', path: '/admin/audits', icon: markRaw(Document) }
]

function toggle(key) {
  expanded.value[key] = !expanded.value[key]
}
</script>

<template>
  <nav class="tree-nav" aria-label="主导航">
    <section v-if="admin" class="nav-group">
      <button class="nav-group-title" @click="toggle('system')">
        <el-icon class="group-icon"><Setting /></el-icon>
        <span>系统管理</span>
        <el-icon class="tree-arrow"><ArrowDown v-if="expanded.system" /><ArrowRight v-else /></el-icon>
      </button>
      <div v-show="expanded.system" class="nav-children">
        <button v-for="item in systemItems" :key="item.key" class="nav-item" :class="{ active: active === item.key }" @click="emit('navigate', item.path)">
          <el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span>
        </button>
      </div>
    </section>
    <section class="nav-group">
      <button class="nav-group-title" @click="toggle('sessions')">
        <el-icon class="group-icon"><ChatDotRound /></el-icon>
        <span>会话管理</span>
        <el-icon class="tree-arrow"><ArrowDown v-if="expanded.sessions" /><ArrowRight v-else /></el-icon>
      </button>
      <div v-show="expanded.sessions" class="nav-children">
        <button class="nav-item" :class="{ active: active === 'chat' }" @click="emit('navigate', '/chat')"><el-icon><ChatDotRound /></el-icon><span>会话列表</span></button>
      </div>
    </section>
  </nav>
</template>

<style scoped>
.tree-nav { display: grid; gap: 18px; }
.nav-group { display: grid; gap: 5px; padding: 0; border: 0; }
.nav-group-title, .nav-item { display: flex; align-items: center; width: 100%; border: 0; background: transparent; text-align: left; }
.nav-group-title { gap: 9px; padding: 7px 9px; color: #697386; font-size: 12px; font-weight: 700; }
.nav-group-title span { flex: 1; }
.group-icon { color: #738198; font-size: 15px; }
.tree-arrow { flex: 0 0 auto !important; color: #9aa4b2; font-size: 12px; }
.nav-children { display: grid; gap: 3px; padding: 0; }
.nav-item { gap: 10px; min-height: 38px; padding: 8px 11px 8px 34px; border-radius: 6px; color: #5d6878; font-size: 13px; transition: background .12s ease, color .12s ease; }
.nav-item:hover { background: #f0f3f8; color: #27364f; }
.nav-item.active { background: #e9f0ff; color: #1f5fd0; font-weight: 650; }
.nav-group-title:focus, .nav-item:focus { outline: none; }
.nav-group-title:focus-visible, .nav-item:focus-visible { box-shadow: 0 0 0 2px rgba(37, 99, 235, .28); }
.nav-item .el-icon { font-size: 15px; }
</style>
