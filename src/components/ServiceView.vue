<script setup lang="ts">
import { ObjectReference, ServiceNode } from '@/BlackboxClient';
import { onMounted, ref, watch, defineEmits } from 'vue';

const props = defineProps<{
    serviceNode: ServiceNode,
    showObjects?: boolean
}>()

const emit = defineEmits(['selectObject'])

const objects = ref<ObjectReference[]>([])
const values = ref<any[]>([])
const actions = ref<string[]>([])

async function loadValues(show: boolean) {
    if(!show) {
        objects.value = []
        values.value = []
        return
    }

    objects.value = await props.serviceNode.getObjects()
    values.value = objects.value.reduce((acc: any[], curr: ObjectReference) => {
        if(typeof curr.props !== 'object') {
            acc.push(curr.props)
        } else {
            Object.entries(curr.props).forEach(entry => acc.push(entry))
        }
        
        return acc
    }, [])
}

onMounted(async () => {
    await loadValues(props.showObjects)
    actions.value = await props.serviceNode.getActions()
})

watch(() => props.showObjects, async (show) => await loadValues(show))
watch(() => props.serviceNode, async (_) => await loadValues(props.showObjects))

async function selectObject(obj: ObjectReference) {
    const objectNode = await obj.getObjectNode()
    emit('selectObject', objectNode)
}

</script>

<template>
    <div class="ps-2 pe-2">
        <div class="d-flex flex-row mb-1">
            <div class="border-end border-dark pe-3 me-3">
                <h1 class="mb-0">{{ serviceNode.service.name}}</h1>
            </div>
            <div class="d-flex align-items-center">
                <div class="lead">{{ serviceNode.service.summary }}</div>
            </div>
        </div>
        <div class="mb-3 mt-2">{{ serviceNode.service.description }}</div>
        <div v-if="showObjects">
            <div class="d-flex flex-row justify-content-between mb-1 bg-dark">
                <div>
                    <button class="btn border-0"><i class="bi bi-plus-lg"></i></button>
                    <button class="btn border-0 disabled"><i class="bi bi-trash3"></i></button>
                </div>
                <div>
                    <button class="btn border-0 disabled"><i class="bi bi-table"></i></button>
                    <button class="btn border-0 disabled"><i class="bi bi-list-ul"></i></button>
                </div>
            </div>
            <div class="list-group list-group-flush">
                <a v-for="obj in objects" 
                    href="#" 
                    class="list-group-item list-group-item-action"
                    @click="selectObject(obj)"
                >
                    <div v-if="typeof obj.props == 'object'">
                        <div v-for="v in Object.entries(obj.props)">
                            <strong>{{ (<any>v)[0] }}</strong>
                            &nbsp;- {{ (<any>v)[1] }}
                        </div>
                    </div>
                    <span v-else-if="obj.error" class="text-danger">{{ obj.error?.error || obj.error?.message || obj.error }}</span>
                    <span v-else>{{ obj.props }}</span>
                </a>
            </div>
        </div>
    </div>
</template>
