import { createRouter, createWebHistory } from 'vue-router'

export const routes = [
  { path: '/', redirect: '/chat' },
  { path: '/chat', name: 'chat', meta: { title: '会话列表' } },
  { path: '/admin/dashboard', name: 'admin-dashboard', meta: { title: '监控大盘', admin: true } },
  { path: '/admin/conversations', name: 'admin-conversations', meta: { title: '全部会话', admin: true } },
  { path: '/admin/agents', name: 'admin-agents', meta: { title: 'Agent 配置', admin: true } },
  { path: '/admin/users', name: 'admin-users', meta: { title: '用户管理', admin: true } },
  { path: '/admin/providers', name: 'admin-providers', meta: { title: '供应商配置', admin: true } },
  { path: '/admin/audits', name: 'admin-audits', meta: { title: '操作审计', admin: true } }
]

export default createRouter({ history: createWebHistory(), routes })
