<script setup lang="ts">
import type { ObjectNode, ServiceReference } from '@/BlackboxClient';
import { onMounted, ref } from 'vue';

const props = defineProps<{
    objectNode: ObjectNode
}>()

const emit = defineEmits(['selectService'])

const servicelist = ref<ServiceReference[]>([])
const actions = ref<string[]>([])

onMounted(async () => {
    servicelist.value = await props.objectNode.getServiceList()
    actions.value = await props.objectNode.getActions()
});

async function selectService(serviceRef: ServiceReference) {
    const serviceNode = await serviceRef.getServiceNode()
    emit('selectService', serviceNode)
}
</script>

<template>
    <!-- Object properties: -->
    <div v-if="typeof objectNode.object == 'object'" class="ps-2">
        <div v-for="v in Object.entries(objectNode.object)">
            <strong>{{ (<any>v)[0] }}</strong>
            &nbsp;- {{ (<any>v)[1] }}
        </div>
    </div>
    <div v-else class="ps-2">{{ objectNode.object }}</div>

    <!-- Sub-service list: -->
    <div v-if="servicelist && servicelist.length > 0" class="border-top border-dark mt-2 mb-2 ps-2">
        <h5 class="mt-2">Services provided by this object:</h5>
        <div v-for="serviceRef in servicelist" class="list-group list-group-flush">
            <a href="#" @click="selectService(serviceRef)" class="list-group-item list-group-item-action ps-2 pe-2 pt-1 pb-1"><strong>{{ serviceRef.name }}</strong></a>
        </div>
    </div>

    <!-- Actions: -->
    <div>
        <div v-for="action in actions">{{ action }}</div>
    </div>
</template>