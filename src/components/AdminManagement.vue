<script setup>
import { computed, defineAsyncComponent } from 'vue'

const props = defineProps({ mode: { type: String, required: true } })

const AgentConfigPage = defineAsyncComponent(() => import('./admin/AgentConfigPage.vue'))
const ProviderConfigPage = defineAsyncComponent(() => import('./admin/ProviderConfigPage.vue'))
const UserManagementPage = defineAsyncComponent(() => import('./admin/UserManagementPage.vue'))
const AuditLogPage = defineAsyncComponent(() => import('./admin/AuditLogPage.vue'))

const page = computed(() => ({
  agents: AgentConfigPage,
  providers: ProviderConfigPage,
  users: UserManagementPage,
  audits: AuditLogPage
})[props.mode])
</script>

<template>
  <component :is="page" />
</template>
