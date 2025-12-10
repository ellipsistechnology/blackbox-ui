<script setup lang="ts">
import { ObjectNode, ObjectReference, ServiceNode } from '@/BlackboxClient';
import { onMounted, ref, watch, defineEmits } from 'vue';
import ObjectView from './ObjectView.vue';

const props = defineProps<{
    serviceNode: ServiceNode,
    showObjects?: boolean
}>()

const emit = defineEmits([
    'selectObject', 
    'newObject',
    'info',
    'error',
    'objectDeleted'
])

const objectRefs = ref<ObjectReference[]>([])
const uniqueObjectNode = ref<ObjectNode|null>(null)
const checkedObjects = ref<boolean[]>([])
const values = ref<any[]>([])
const actions = ref<string[]>([])

async function loadValues() {
    // If not showing objects, clear the list:
    if(!props.showObjects) {
        objectRefs.value = []
        values.value = []
        return
    }

    // Load the objects for this service:
    objectRefs.value = await props.serviceNode.getObjects()
    values.value = objectRefs.value.reduce((acc: any[], curr: ObjectReference) => {
        if(typeof curr.props !== 'object') {
            acc.push(curr.props)
        } else {
            Object.entries(curr.props).forEach(entry => acc.push(entry))
        }
        
        return acc
    }, [])

    // If uing a custom UI, manage messages:
    if(props.serviceNode.service.ui?.['service-view']?.href) {
        const iframe = document.getElementById('service-view-iframe') as HTMLIFrameElement
        if(iframe && iframe.contentWindow) {
            setTimeout(() => {
                // Send the service and objects to the iframe:
                const msg = {
                    type: 'set-service',
                    service: JSON.parse(JSON.stringify(props.serviceNode.service)),
                    objectRefs: objectRefs.value.map(obj => JSON.parse(JSON.stringify(obj)))
                }
                iframe.contentWindow?.postMessage(msg, '*')

                // Listen for messages from the iframe:
                window.addEventListener('message', async (event) => {
                    if(event.data.type === 'select-object') {
                        // const objIndex = event.data.objectIndex
                        // selectObject(objects.value[objIndex])
                    } else if(event.data.type === 'new-object') {
                        // createObject()
                    } else if(event.data.type === 'delete-objects') {
                        // deleteObjects()
                    } else if(event.data.type === 'update-object') {
                        updateObject(new ObjectReference(event.data.ref, props.serviceNode.service), event.data.object)
                    } else if(event.data.type === 'info' || event.data.type === 'error') {
                        emit(event.data.type, event.data.message)
                    } else if(event.data.type === 'get-objects') {
                        const msg = {
                            type: 'set-objects',
                            objects: await Promise.all(
                                objectRefs.value.map(async obj => JSON.parse(JSON.stringify(await obj.getObjectNode())))
                            )
                        }
                        iframe.contentWindow?.postMessage(msg, '*')
                    }
                })
            }, 100)
        }
    }
}

async function updateObject(ref: ObjectReference, obj: any) {
    // Get current object ready for update:
    const objNode = await ref.getObjectNode()

    // Update only the provided fields:
    for(const [key, value] of Object.entries(obj)) {
        objNode.object[key] = value
    }
    await objNode.update()

    // Reload the objects list:
    loadValues()

    emit('info', `Updated successfully.`)
}

onMounted(async () => {
    await loadValues()
    actions.value = await props.serviceNode.getActions()
    checkedObjects.value = new Array(objectRefs.value.length).fill(false)

    // If unique access, load the single object node:
    if(props.serviceNode.service.access === 'unique' && objectRefs.value.length > 0) {
        uniqueObjectNode.value = await objectRefs.value[0]?.getObjectNode() as ObjectNode
    }
})

watch(() => props.showObjects, async (show) => await loadValues())
watch(() => props.serviceNode, async (_) => await loadValues())

async function selectObject(obj: ObjectReference) {
    const objectNode = await obj.getObjectNode()
    emit('selectObject', objectNode)
}

function createObject() {
    emit('newObject')
}

// TODO: prompt for confirmation
async function deleteObjects() {
    for(let index = objectRefs.value.length - 1; index >= 0; index--) {
        if(checkedObjects.value[index]) {
            try {
                const objNode = await objectRefs.value[index]!.getObjectNode()
                await objNode.deleteObject()
                emit('info', `Object deleted successfully.`)
                emit('objectDeleted', objNode)
            } catch(err: any) {
                emit('error', `Error deleting object: ${err.message || err}`)
                console.error(`Error deleting object: `, err)
            }
        }
    }

    // Reload the objects list:
    await loadValues()
    checkedObjects.value = new Array(objectRefs.value.length).fill(false)
}
</script>

<template>
    {{ serviceNode.service.ui }}
    <!-- Custom UI: -->
    <div v-if="serviceNode.service.ui?.['service-view']?.href" class="d-flex flex-column h-100">
        <iframe 
            id="service-view-iframe"
            :src="serviceNode.service.ui?.['service-view'].href" 
            class="w-100 h-100 border-0 flex-grow-1"
        ></iframe>
    </div>

    <!-- Standard UI: -->
    <div v-else class="pe-2">
        <!-- Service details: -->
        <div class="d-flex flex-row mb-1">
            <div class="border-end border-dark pe-3 me-3">
                <h1 class="mb-0">{{ serviceNode.service.name}}</h1>
            </div>
            <div class="d-flex align-items-center">
                <div class="lead">{{ serviceNode.service.summary }}</div>
            </div>
        </div>
        <div class="mb-3 mt-2">{{ serviceNode.service.description }}</div>

        <!-- Objects list: -->
        <div v-if="showObjects">
            <!-- Toolbar: -->
            <div class="d-flex flex-row justify-content-between mb-1 bg-dark">
                <div>
                    <button v-if="serviceNode.service.access !== 'unique'" @click="createObject()" class="btn border-0">
                        <i class="bi bi-plus-lg"></i>
                    </button>
                    <button
                        v-if="serviceNode.service.access !== 'unique'"
                        class="btn border-0" 
                        :class="{ 
                            disabled: !checkedObjects.includes(true),
                            'text-danger': checkedObjects.includes(true)
                        }"
                        @click="deleteObjects()"
                    >
                        <i class="bi bi-trash3"></i>
                    </button>
                </div>
                <div>
                    <button class="btn border-0 disabled"><i class="bi bi-table"></i></button>
                    <button class="btn border-0 disabled"><i class="bi bi-list-ul"></i></button>
                </div>
            </div>

            <!-- Objects: -->
            <div v-if="serviceNode.service.access !== 'unique'" class="list-group list-group-flush">
                <a v-for="(obj, index) in objectRefs" 
                    href="#" 
                    class="list-group-item list-group-item-action d-flex flex-row"
                    @click="selectObject(obj)"
                >
                    <div v-if="typeof obj.props == 'object'">
                        <div v-for="v in Object.entries(obj.props)">
                            <strong>{{ (<any>v)[0] }}</strong>
                            &nbsp;- {{ (<any>v)[1] }}
                        </div>
                    </div>
                    <div v-else-if="obj.error" class="text-danger">{{ obj.error?.error || obj.error?.message || obj.error }}</div>
                    <div v-else>{{ obj.props }}</div>
                    <button v-if="serviceNode.service.access !== 'unique'" class="ms-auto btn border-0 disabled"><i class="bi bi-grip-horizontal"></i></button>
                    <div v-if="serviceNode.service.access !== 'unique'" class="d-flex align-items-center">
                        <input 
                            class="form-check-input mt-0" 
                            type="checkbox" 
                            v-model="checkedObjects[index]" 
                            aria-label="Checkbox for following text input" 
                            onclick="event.stopPropagation();"
                        >
                    </div>
                </a>
            </div>
            <div v-else>
                <ObjectView
                    v-if="uniqueObjectNode"
                    :objectNode="uniqueObjectNode" 
                    :showActions="true"
                    @info="msg => emit('info', msg)"
                    @error="msg => emit('error', msg)"
                ></ObjectView>
                <div v-else class="text-center text-muted mt-5">
                    <i class="bi bi-info-circle-fill fs-1"></i>
                    <div>No object available.</div>
                </div>
            </div>
        </div>
    </div>
</template>
