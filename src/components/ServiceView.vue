<script setup lang="ts">
import { ObjectNode, ObjectReference, ServiceNode } from '@/BlackboxClient';
import { onMounted, onUnmounted, ref, toRaw, watch } from 'vue';
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
const objectError = ref<boolean>(false)
const name = ref<string>('')
const summary = ref<string>('')
const description = ref<string>('')
const refresh = ref<'never' | 'always' | 'optional' | 'manual'>('never')
const refreshInterval = ref<number>(60000)
const manualRefreshSet = ref<boolean>(false)
let refreshTimeout: number | undefined = undefined

function sendSetService() {
    const iframe = document.getElementById('service-view-iframe') as HTMLIFrameElement
    if(iframe && iframe.contentWindow) {
        const msg = {
            type: 'set-service',
            service: JSON.parse(JSON.stringify(props.serviceNode.service)),
            refs: JSON.parse(JSON.stringify(objectRefs.value)) as ObjectReference[]
        }
console.log('Sending set-service message to iframe:', msg)
        iframe.contentWindow?.postMessage(msg, '*')
    }
}

async function customUIEventListener(event: any) {
    try {
        switch(event.data?.type) {
            case 'select-object':
                selectObject(new ObjectReference(new URL(event.data.ref.url), props.serviceNode.service))
                break
            case 'create-object':
                emit('newObject')
                break
            case 'get-service':
                await loadValues()
                sendSetService()
                break
            case 'delete-objects':
                const refs = event.data.refs as ObjectReference[]
                deleteByRefs(refs)
                break
            case 'create-objects':
                for(let i = 0; i < event.data.objects.length; i++) {
                    const obj = event.data.objects[i]
                    new ObjectNode(undefined as any as URL, props.serviceNode.service, obj, undefined).create()
                }

                // Reload the objects list:
                await loadValues() // read the updated values from the service to ensure consistency, then update the iframe with the new data
                sendSetService()
                break
            case 'update-objects':
                if(!Array.isArray(event.data.objects) || !Array.isArray(event.data.refs) || event.data.objects.length !== event.data.refs.length) {
                    emit('error', 'Invalid update-objects message format.')
                    return
                }
                for(let i = 0; i < event.data.objects.length; i++) {
                    const obj = event.data.objects[i]
                    const ref = event.data.refs[i]
                    if(!ref.url) {
                        emit('error', 'Invalid object reference in update-objects message.')
                        continue
                    }
                    const updatedRef = new ObjectReference(new URL(ref.url), props.serviceNode.service, obj)
                    await updateObject(updatedRef, obj)
                }

                emit('info', `Updated successfully.`)

                // Reload the objects list:
                await loadValues() // read the updated values from the service to ensure consistency, then update the iframe with the new data
                sendSetService()
                break
            case 'replace-objects':
                if(!Array.isArray(event.data.objects) || !Array.isArray(event.data.refs) || event.data.objects.length !== event.data.refs.length) {
                    emit('error', 'Invalid replace-objects message format.')
                    return
                }
                for(let i = 0; i < event.data.objects.length; i++) {
                    const obj = event.data.objects[i]
                    const ref = event.data.refs[i]
                    if(!ref.url) {
                        emit('error', 'Invalid object reference in replace-objects message.')
                        continue
                    }
                    const updatedRef = new ObjectReference(new URL(ref.url), props.serviceNode.service, obj)
                    await replaceObject(updatedRef, obj)
                }

                emit('info', `Replaced successfully.`)

                // Reload the objects list:
                await loadValues() // read the updated values from the service to ensure consistency, then update the iframe with the new data
                sendSetService()
                break
            case 'info':
            case 'error':
                emit(event.data.type, event.data.message)
                break
        }
    } catch(err: any) {
        emit('error', `Error handling message from custom UI: ${err.message || err}`)
        console.error(`Error handling message from custom UI: `, err)
    }
}

async function loadValues(clear = true) {
    // Clear current objects and unique object node (if applicable) to show loading state:
    if(clear) {
        if(props.serviceNode.service.access === 'unique') {
            uniqueObjectNode.value = null
        }
        objectRefs.value = []
    }
    objectError.value = false

    // If not showing objects, clear the list:
    if(!props.showObjects) {
        objectRefs.value = []
        values.value = []
        return
    }

    // Load the objects for this service:
    try {
        objectRefs.value = await props.serviceNode.getObjects()
    } catch(error) {
        console.error(error)
        emit('error', 'Failed to load object(s).')
        objectError.value = true
        return
    }
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

            // Listen for messages from the iframe:
            window.removeEventListener('message', customUIEventListener)
            window.addEventListener('message', customUIEventListener)
        }
    }
}

async function deleteByRefs(refs: ObjectReference[]) {

    // If access is by index we need sort and delete last to first (index is default access):
    if(!props.serviceNode.service.access || props.serviceNode.service.access === 'index') {
        refs.sort((a, b) => {
            const indexA = objectRefs.value.findIndex(ref => ref.url?.toString() === a.url?.toString())
            const indexB = objectRefs.value.findIndex(ref => ref.url?.toString() === b.url?.toString())
            return indexB - indexA
        })
    }

    // Delete each object:
    for(let delRef of refs) {
        const ref = <ObjectReference>objectRefs.value.find(ref => ref.url?.toString() === delRef.url?.toString())
        if(ref) {
            // Delete the object:
            try {
                const objNode = await ref.getObjectNode()
                await objNode.deleteObject()
                emit('info', `Object deleted successfully.`)
                emit('objectDeleted', objNode)
            } catch(err: any) {
                    emit('error', `Error deleting object: ${err.message || err}`)
                    console.error(`Error deleting object: `, err)
            }

            // Remove from the list of object refs:
            objectRefs.value = objectRefs.value.filter(r => r.url?.toString() !== ref.url?.toString())
        } else {
            emit('error', `Object reference not found for deletion: ${delRef.url}`)
            console.error(`Object reference not found for deletion: `, delRef)
        }
    }

    // Reload the objects list:
    sendSetService()
}

async function updateObject(ref: ObjectReference, obj: any) {
    // Get current object ready for update:
    const objNode = await ref.getObjectNode()

    // Update only the provided fields:
    if(typeof obj !== 'object') {
        objNode.object = obj
    } else {
        for(const [key, value] of Object.entries(obj)) {
            objNode.object[key] = value
        }
    }
    await objNode.update()

    // Update objectRefs:
    const index = objectRefs.value.findIndex(r => r.url?.toString() === ref.url?.toString())
    if(index !== -1) {
        objectRefs.value[index] = ref
    }
}

async function replaceObject(ref: ObjectReference, obj: any) {
    // Get current object ready for replacement:
    const objNode = await ref.getObjectNode()

    // Replace the object with the provided payload:
    objNode.object = obj
    await objNode.replace()

    // Update objectRefs:
    const index = objectRefs.value.findIndex(r => r.url?.toString() === ref.url?.toString())
    if(index !== -1) {
        objectRefs.value[index] = ref
    }
}

async function refreshNode() {
    await loadValues(false)
    sendSetService()
    actions.value = await props.serviceNode.getActions()
    checkedObjects.value = new Array(objectRefs.value.length).fill(false)

    // Load auto-refresh setting from local storage:
    if(props.serviceNode.service.ui?.['service-view']?.refresh === 'optional') {
        const storedSetting = localStorage.getItem(`refresh-${props.serviceNode.service.name}`)
        if(storedSetting) {
            manualRefreshSet.value = storedSetting === 'true'
        }
    }

    // If unique access, load the single object node:
    if(props.serviceNode.service.access === 'unique' && objectRefs.value.length > 0) {
        uniqueObjectNode.value = await objectRefs.value[0]?.getObjectNode() as ObjectNode
    }

    // If auto-open is set, emit select for the first object:
    if(props.serviceNode.service.ui?.['auto-open-single'] && objectRefs.value.length === 1 && objectRefs.value[0]) {
        selectObject(objectRefs.value[0])
    }

    // Set UI hints if available:
    name.value = props.serviceNode.service.ui?.['service-view']?.name ?? props.serviceNode.service.name ?? ''
    summary.value = props.serviceNode.service.ui?.['service-view']?.summary ?? props.serviceNode.service.summary ?? ''
    description.value = props.serviceNode.service.ui?.['service-view']?.description ?? props.serviceNode.service.description ?? ''
    refresh.value = props.serviceNode.service.ui?.['service-view']?.refresh ?? 'never'
    refreshInterval.value = props.serviceNode.service.ui?.['service-view']?.['refresh-interval'] ?? 60000

    // Setup refresh interval:
    clearTimeout(refreshTimeout)
    refreshTimeout = undefined
    if(refresh.value === 'always' || (refresh.value === 'optional' && manualRefreshSet.value)) {
        refreshTimeout = setTimeout(() => refreshNode(), refreshInterval.value)
    }
}

function toggleManualRefresh() {
    manualRefreshSet.value = !manualRefreshSet.value
    if(manualRefreshSet.value) {
        refreshNode()
    } else {
        clearTimeout(refreshTimeout)
        refreshTimeout = undefined
    }

    // Save setting to local storage:
    localStorage.setItem(`refresh-${props.serviceNode.service.name}`, manualRefreshSet.value.toString())
}

onMounted(refreshNode)
onUnmounted(() => {
    clearTimeout(refreshTimeout)
    refreshTimeout = undefined
})

watch(() => props.showObjects, async (_) => await loadValues())
watch(() => props.serviceNode, async (_) => {
    clearTimeout(refreshTimeout)
    refreshTimeout = undefined
    await refreshNode()
})

async function selectObject(obj: ObjectReference) {
    try {
        const objectNode = await obj.getObjectNode()
        emit('selectObject', objectNode)
    } catch(err: any) {
        emit('error', `Error selecting object: ${err.message || err}`)
        console.error(`Error selecting object: `, err)
    }
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

/**
 * Render only primative values for the given object.
 * @param value 
 */
function renderObject(value: any): string {
    if(typeof value === 'object') {
        return Object.entries(value)
            .filter(entry => ['string', 'number', 'boolean'].includes(typeof entry[1]))
            .map(entry => 
                `${(<any>entry)[0]}: ${renderObject((<any>entry)[1])}`
            ).join(' | ')
    } else {
        return String(value)
    }
}
</script>

<template>
    <!-- Custom UI: -->
    <div v-if="serviceNode.service.ui?.['service-view']?.href && showObjects" class="d-flex flex-column h-100">
        <iframe 
            id="service-view-iframe"
            :src="serviceNode.service.ui?.['service-view'].href" 
            class="w-100 h-100 border-0 flex-grow-1"
        ></iframe>
    </div>

    <!-- Standard UI: -->
    <div v-else class="pe-2 mb-3">
        <!-- Service details: -->
        <div class="d-flex flex-row mb-1">
            <div v-if="name.length > 0" class="border-end border-dark pe-3 me-3">
                <h1 class="mb-0">{{ name}}</h1>
            </div>
            <div v-if="summary.length > 0" class="d-flex align-items-center">
                <div class="lead">{{ summary }}</div>
            </div>
            <div class="ms-auto">
                <button 
                    v-if="refresh === 'manual'" 
                    @click="refreshNode()" 
                    class="btn border-0"
                >
                    <i class="bi bi-arrow-clockwise"></i>
                </button>
                <div v-else-if="refresh === 'optional'" class="form-check form-switch mt-2">
                    <input class="form-check-input refresh-switch" type="checkbox" role="switch" id="refreshSwitch" :checked="manualRefreshSet" @change="toggleManualRefresh()">
                    <label class="form-check-label" for="refreshSwitch">Auto-refresh</label>
                </div>
            </div>
        </div>
        <div v-if="description.length > 0" class="mb-3 mt-2">{{ description }}</div>

        <!-- Objects list: -->
        <div v-if="showObjects">
            <!-- Toolbar: -->
            <div v-if="serviceNode.service.access !== 'unique'" class="d-flex flex-row justify-content-between mb-1 bg-dark">
                <div>
                    <button 
                        v-if="serviceNode.service.access !== 'unique'" 
                        @click="createObject()" 
                        class="btn border-0"
                    >
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
                            &nbsp;- {{ renderObject((<any>v)[1]) }}
                        </div>
                    </div>
                    <div v-else-if="obj.error" class="text-danger">{{ obj.error?.error || obj.error?.message || obj.error }}</div>
                    <div v-else>{{ obj.props }}</div>
                    <button class="ms-auto btn border-0 disabled">
                        <i class="bi bi-grip-horizontal"></i>
                    </button>
                    <div class="d-flex align-items-center">
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
            
            <!-- Unique object: -->
            <div v-else>
                <ObjectView
                    v-if="uniqueObjectNode"
                    :objectNode="uniqueObjectNode" 
                    :showActions="true"
                    @info="(msg: any) => emit('info', msg)"
                    @error="(msg: any) => emit('error', msg)"
                ></ObjectView>
                <div v-else-if="!objectError" class="text-muted">
                    <div>Loading...</div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.refresh-switch {
    --bs-form-switch-bg: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='rgba%28255,255,255,0.95%29'/%3e%3c/svg%3e");
}
</style>
