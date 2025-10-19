<script setup lang="ts">
// import BlackboxClient from '@/BlackboxClient'
import type ServiceList from '@/types/ServiceList'
import { ref, watch } from 'vue'
import ServiceView from './ServiceView.vue'
import { RootNode, ServiceNode } from '@/BlackboxClient'

const serviceList = ref<ServiceNode[]|null>(null)

const props = defineProps({
    url: {
        type: String
    }
})

watch(() => props.url, async (newUrl) => {
    try {
        // serviceList.value = await new BlackboxClient(newUrl!).listServices()
        const references = await new RootNode(newUrl!).getServiceList()
        serviceList.value = await Promise.all(references.map(async ref => await ref.getServiceNode()))
    } catch (e) {
        serviceList.value = null
        // TODO: emit error event
    }
}, { immediate: true })
</script>

<template>
    <div v-if="serviceList" v-for="serviceNode in serviceList" :key="serviceNode.service.href" class="border-bottom border-dark">
        <ServiceView :serviceNode="serviceNode"></ServiceView>
    </div>
    <div v-else>
        Loading from {{ url }}...
    </div>
</template>