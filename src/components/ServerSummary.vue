<script setup lang="ts">
// import BlackboxClient from '@/BlackboxClient'
import type ServiceList from '@/types/ServiceList'
import { ref, watch } from 'vue'
import ServiceView from './ServiceView.vue'
import { RootNode, ServiceNode } from '@/BlackboxClient'

const emit = defineEmits([
    'selectService'
])

const serviceList = ref<ServiceNode[]|null>(null)

const props = defineProps({
    rootNode: {
        type: RootNode
    }
})

watch(() => props.rootNode, async (newRootNode) => {
    if(newRootNode == null) {
        serviceList.value = null
        return
    }
    try {
        const references = await newRootNode.getServiceList()
        serviceList.value = await Promise.all(references.map(async ref => await ref.getServiceNode()))
    } catch (e) {
        serviceList.value = null
        // TODO: emit error event
    }
}, { immediate: true })
</script>

<template>
    <div v-if="serviceList" v-for="serviceNode in serviceList" :key="serviceNode.service.name" class="p-0">
        <ServiceView :serviceNode="serviceNode"></ServiceView>
        <button class="btn btn-outline-primary" @click="emit('selectService', serviceNode)">Open Service</button>
    </div>
    <div v-else>
        Loading from {{ rootNode?.url }}...
    </div>
</template>