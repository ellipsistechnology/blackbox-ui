<script setup lang="ts">
import { ref, watch } from 'vue'
import ServiceView from './ServiceView.vue'
import { RootNode, ServiceNode } from '@/BlackboxClient'

const emit = defineEmits([
    'selectService',
    'error'
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
    } catch (e: any) {
        serviceList.value = []
        emit('error', e?.message || e)
    }
}, { immediate: true })
</script>

<template>
    <div v-if="serviceList" class="container-fluid px-0">
        <div v-if="serviceList.length > 0" class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4">
            <div v-for="serviceNode in serviceList" :key="serviceNode.service.name" class="col">
                <div class="card h-100 shadow-sm">
                    <div class="card-header d-flex justify-content-between align-items-start">
                        <div>
                            <h5 class="card-title mb-0">{{ serviceNode.service.name }}</h5>
                            <small class="text-secondary">{{ serviceNode.service.summary }}</small>
                        </div>
                        <a href="#" @click.stop="emit('selectService', serviceNode)"><i class="bi bi-arrow-up-right-square"></i></a>
                    </div>
                    <div class="card-body">
                        {{ serviceNode.service.description }}
                    </div>
                </div>
            </div>
        </div>
        <div v-else class="alert alert-light border mb-0">
            No services available.
        </div>
    </div>
    <div v-else>
        Loading from {{ rootNode?.url }}...
    </div>
</template>