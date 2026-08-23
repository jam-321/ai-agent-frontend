import { createRouter, createWebHistory } from 'vue-router'

// 当前应用由 App.vue 根据 route.name 切换工作区，路由仍需一个组件锚点才能被 Vue Router 正常确认。
const RouteAnchor = { render: () => null }

export const routes = [
  { path: '/', redirect: '/chat' },
  { path: '/chat', name: 'chat', component: RouteAnchor, meta: { title: '会话列表' } },
  { path: '/admin/dashboard', name: 'admin-dashboard', component: RouteAnchor, meta: { title: '监控大盘', admin: true } },
  { path: '/admin/conversations', name: 'admin-conversations', component: RouteAnchor, meta: { title: '全部会话', admin: true } },
  { path: '/admin/agents', name: 'admin-agents', component: RouteAnchor, meta: { title: 'Agent 配置', admin: true } },
  { path: '/admin/users', name: 'admin-users', component: RouteAnchor, meta: { title: '用户管理', admin: true } },
  { path: '/admin/providers', name: 'admin-providers', component: RouteAnchor, meta: { title: '供应商配置', admin: true } },
  { path: '/admin/audits', name: 'admin-audits', component: RouteAnchor, meta: { title: '操作审计', admin: true } }
]

export default createRouter({ history: createWebHistory(), routes })
