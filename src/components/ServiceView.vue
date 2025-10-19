<script setup lang="ts">
// import BlackboxClient from '@/BlackboxClient';
import type { ServiceNode } from '@/BlackboxClient';
import type Service from '@/types/Service';
import { onMounted, ref } from 'vue';

const props = defineProps<{
    serviceNode: ServiceNode,
    showObjects?: boolean
}>()

const objects = ref<any[]>([])

function fullUrl(href: string): string {
    const base = new URL(props.serviceNode.service.root)
    return new URL(href, base).toString()
}

onMounted(async () => {
    // objects.value = await new BlackboxClient(props.service.root).listObjects(props.service.href) || []
});
</script>

<template>
    <div class="ps-2">
        <h1 class="display-3 mb-0">{{ serviceNode.service.name}}</h1>
        <small class="fs-6 fw-lighter text-muted">{{ fullUrl(serviceNode.service.href) }}</small>
        <p class="lead mt-2">{{ serviceNode.service.summary }}</p>
        <p>{{ serviceNode.service.description }}</p>
        
        <!-- <div v-if="showObjects" class="border-dark border-top">
            <ul>
                <ol v-for=""></ol>
            </ul>
        </div> -->
    </div>
</template>