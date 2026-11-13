<script setup lang="ts">
import type { ObjectNode, ObjectReference, ServiceReference } from '@/BlackboxClient';
import { ServiceNode } from '@/BlackboxClient';
import type Oas3schema from '@/types/Oas3schema';
import { onMounted, ref, watch } from 'vue';
import ServiceView from './ServiceView.vue'
import Properties from './Properties.vue';
import type Service from '@/types/Service';

const props = defineProps<{
    objectNode: ObjectNode,
    isNew?: boolean
}>()

const emit = defineEmits([
    'serviceSelected',
    'info',
    'error',
    'urlChanged',
    'objectDeleted',
    'objectSaved',
    'newObject',
    'selectObject',
    'closeObject'
])

const servicelist = ref<ServiceReference[]>([])
const services = ref<{ [serviceName: string]: Service}>({})
const actions = ref<string[]>([])
const objectSchema = ref<Oas3schema | undefined>(props.objectNode?.service.type?.schema as Oas3schema | undefined)
const editing = ref<boolean>(false)
const originalObject = ref<any>(null)
const selectedTab = ref<string>('summary')
const selectedService = ref<ServiceNode|null>(null)
const parentServiceNode = ref<ServiceNode|null>(null)
const object = ref<any>(props.objectNode ? props.objectNode.object : null)

const refresh = ref<'never' | 'always' | 'optional' | 'manual'>('never')
const refreshInterval = ref<number>(60000)
const autoRefreshActive = ref<boolean>(false)
let refreshTimeout: number | undefined = undefined

onMounted(loadObject)
watch(() => props.objectNode, () => loadObject())
watch(() => props.isNew, () => {
    if(props.isNew) {
        selectedTab.value = 'summary'
    }
})

async function loadObject(refetch: boolean = false) {
    if(refetch) {
        await props.objectNode.reload() // retrieve the latest data
    }

    servicelist.value = await props.objectNode.getServiceList()
    actions.value = await props.objectNode.getActions()

    originalObject.value = JSON.parse(JSON.stringify(props.objectNode.object))

    // Resolve relative schema hrefs to absolute URLs:
    parentServiceNode.value = new ServiceNode(props.objectNode.service)
    objectSchema.value = await parentServiceNode.value.resolveSchema()

    // Set schema root:
    const rootPath = props.objectNode.service.ui?.root
    object.value = props.objectNode.object
    if(rootPath) {
        const segments = rootPath.split('/')
        for(const segment of segments) {
            const nextSchema = objectSchema.value?.properties?.[segment]
            const nextObject = object.value?.[segment]
            if(nextSchema && nextObject) {
                objectSchema.value = nextSchema
                object.value = nextObject
            } else {
                console.warn(`Invalid schema root path: ${rootPath}. Segment '${segment}' not found.`)
                break
            }
        }
    }

    // Sort object properties if sort path is provided:
    const sortArray = props.objectNode.service.ui?.sort
    if(sortArray && Array.isArray(sortArray)) {
        // let schema = objectSchema.value
        for(const sortEntry of sortArray) {
            const { path, by, order } = sortEntry
            const segments = path.split('/').filter((s: any) => s.length > 0)
            let obj = object.value
            for(const segment of segments) {
                if(obj?.[segment]) {
                    obj = obj[segment]
                } else {
                    console.warn(`Invalid sort path: ${path}. Segment '${segment}' not found.`)
                    break
                }
            }
            if(obj && Array.isArray(obj)) {
                obj.sort((a: any, b: any) => {
                    const aValue = a[by]
                    const bValue = b[by]
                    if(aValue < bValue) return order === 'asc' ? -1 : 1
                    if(aValue > bValue) return order === 'asc' ? 1 : -1
                    return 0
                })
            }
        }
    }

    // Get services:
    services.value = {}
    for(const serviceRef of servicelist.value) {
        try {
            const serviceNode = await serviceRef.getServiceNode()
            services.value[serviceRef.name] = serviceNode.service
        } catch (err) {
            console.error(`Error loading service ${serviceRef.name}: `, err)
        }
    }

    // Set UI hints if available:
    refresh.value = props.objectNode.service.ui?.['object-view']?.refresh ?? 'never'
    refreshInterval.value = props.objectNode.service.ui?.['object-view']?.['refresh-interval'] ?? 60000

    // Load auto-refresh setting from local storage:
    if(props.objectNode.service.ui?.['object-view']?.refresh === 'optional') {
        const storedSetting = localStorage.getItem(`refresh-${props.objectNode.service.name}-object`)
        if(storedSetting) {
            autoRefreshActive.value = storedSetting === 'true'
        }
    }

    // Setup refresh interval:
    clearTimeout(refreshTimeout)
    refreshTimeout = undefined
    if(refresh.value === 'always' || (refresh.value === 'optional' && autoRefreshActive.value)) {
        refreshTimeout = setTimeout(() => loadObject(true), refreshInterval.value)
    }
}

async function selectService(serviceRef: ServiceReference) {
    const serviceNode = await serviceRef.getServiceNode()
    emit('serviceSelected', serviceNode)
}

async function save() {
    // Check for available update/replace action:
    const method = 
        props.isNew ? 'create' :
        actions.value.includes('update') ? 'update' : 
        actions.value.includes('replace') ? 'replace' :
        actions.value.includes('add') && props.objectNode.service.access === 'unique' ? 'create'
        : null
    if(!method) {
        const msg  =`Cannot save object: The required create, update or replace action is not available.`
        console.error(msg)
        emit('error', msg)
        return
    }

    // Parse any fields that should be numbers:
    if(objectSchema.value && objectSchema.value.type === 'object' && objectSchema.value.properties) {
        for(const [key, propSchema] of Object.entries(objectSchema.value.properties)) {
            if(propSchema.type === 'number' && typeof props.objectNode.object[key] === 'string') {
                const parsed = parseFloat(props.objectNode.object[key])
                if(!isNaN(parsed)) {
                    props.objectNode.object[key] = parsed
                }
            }
        }
    }

    // Save the object via the API:
    try {
        await props.objectNode[method]()
    } catch (err) {
        console.error(`Error saving object: `, err)
        emit('error', `Failed to save ${props.objectNode.service.name}.`)
        return
    }

    // If changing the object's identifier then update URLs:
    if(props.objectNode.service.access === 'id') {
        const identifier = props.objectNode.service.identifier || 'id'

        // Emit URL change to app:
        const id = props.objectNode.object[identifier]
        const oldUrl = props.objectNode.url!.toString()
        const newURL = props.objectNode.url.toString().replace(/[^\/]+$/, encodeURIComponent(id))
        emit('urlChanged', oldUrl, newURL)

        // Update any sub-service URLs:
        for(const serviceRef of servicelist.value) {
            serviceRef.url = new URL(serviceRef.url.toString().replace(oldUrl, newURL))
        }

        // Update the object's URL:
        props.objectNode.url = new URL(newURL)
    }

    editing.value = false

    // Exit new mode:
    emit('objectSaved', props.objectNode)    

    // Notify the user:
    emit('info', `Object saved successfully.`)
}

function cancelEdit() {
    editing.value = false

    if(props.isNew) {
        emit('closeObject')
    } else {
        // Revert the object to the original state:
        props.objectNode.object = JSON.parse(JSON.stringify(originalObject.value))
    }
}

// TODO: prompt for confirmation
async function deleteObject() {
    try {
        await props.objectNode.deleteObject()
        emit('objectDeleted', props.objectNode)
    } catch (err) {
        console.error(`Error deleting object: `, err)
        emit('error', `Failed to delete ${props.objectNode.service.name}.`)
    }
}

// TODO: Refresh when summary tab is selected.
async function selectTab(serviceRef: ServiceReference|null) {
    console.log(`selecting tab ${serviceRef?.name}`);
    
    if(!serviceRef) {
        selectedTab.value = 'summary'
        selectedService.value = null
    } else {
        const serviceNode = await serviceRef.getServiceNode()
        selectedService.value = serviceNode
        selectedTab.value = serviceRef.name
    }
}

async function selectObject(objectNode: ObjectNode) {
    selectedTab.value = 'summary'
    const breadcrumbName = (selectedService.value ? selectedService.value.service.name+' / ' : undefined) + decodeURIComponent(objectNode.url.pathname.split('/').pop() || '?')
    selectedService.value = null
    emit('selectObject', objectNode, breadcrumbName)
}

async function newObject() {
    emit('newObject', selectedService.value)
}

function toggleAutoRefresh() {
    autoRefreshActive.value = !autoRefreshActive.value
    if(autoRefreshActive.value) {
        loadObject(true)
    } else {
        clearTimeout(refreshTimeout)
        refreshTimeout = undefined
    }

    // Save setting to local storage:
    localStorage.setItem(`refresh-${props.objectNode.service.name}-object`, autoRefreshActive.value.toString())
}

</script>

<template>
    <div class="d-flex flex-column h-100 mb-3">
        <!-- Tabs: -->
        <ul v-if="objectNode.service.ui?.['subservice-display'] === 'tabs'" class="nav nav-tabs">
            <li class="nav-item">
                <a 
                    class="nav-link" 
                    :class="selectedTab === 'summary' ? 'active' : ''" 
                    href="#"
                    @click="selectTab(null)"
                >Summary</a>
            </li>
            <li v-for="service of servicelist" class="nav-item">
                <a 
                    class="nav-link" 
                    href="#"
                    :class="selectedTab === service.name ? 'active' : ''"
                    @click="selectTab(service)"
                >{{services[service.name]?.ui?.['service-view']?.title ?? service.name.charAt(0).toUpperCase() + service.name.substring(1)}}</a>
            </li>
        </ul>

        <!-- Summary Tab OR not displayed as tabs -->
        <div v-if="selectedTab === 'summary'">

            <!-- Refresh controls. -->
             <div class="d-flex flex-row">
                <div class="ms-auto">
                    <button 
                        v-if="refresh === 'manual'" 
                        @click="loadObject(true)" 
                        class="btn border-0"
                    >
                        <i class="bi bi-arrow-clockwise"></i>
                    </button>
                    <div v-else-if="refresh === 'optional'" class="form-check form-switch mt-2">
                        <input class="form-check-input refresh-switch" type="checkbox" role="switch" id="refreshSwitch" :checked="autoRefreshActive" @change="toggleAutoRefresh()">
                        <label class="form-check-label" for="refreshSwitch">Auto-refresh</label>
                    </div>
                </div>
            </div>
            
            <!-- Toolbar: -->
            <div class="d-flex flex-row justify-content-between mb-1 bg-dark">
                <div>
                    <button 
                        v-if="!isNew && !editing && (actions.includes('update') || actions.includes('replace') || (actions.includes('add') && objectNode.service.access === 'unique'))" 
                        class="btn border-0"
                        @click="editing = true"
                    >
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button 
                        v-if="!isNew && !editing && actions.includes('delete')" 
                        class="btn border-0"
                        @click="deleteObject()"
                    >
                        <i class="bi bi-trash3 text-danger"></i>
                    </button>
                    
                    <button 
                        v-if="isNew || editing && (actions.includes('update') || actions.includes('replace') || (actions.includes('add') && objectNode.service.access === 'unique'))" 
                        class="btn border-0"
                        @click="save()"
                    >
                        <i class="bi bi-floppy"></i>
                    </button>
                    <button 
                        v-if="editing || isNew" 
                        class="btn border-0"
                        @click="cancelEdit()"
                    >
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
            </div>

            <!-- Object properties: -->
            <form class="ps-2 mt-2 pt-2">
                <Properties
                    v-if="parentServiceNode"
                    :serviceNode="parentServiceNode"
                    :schema="objectSchema"
                    :editing="editing"
                    :isNew="isNew || false"
                    :display="objectNode.service.ui?.['object-view']?.display"
                    :filter="objectNode.service.ui?.filter"
                    v-model="object"
                    @save="save()"
                ></Properties>
                <div v-else class="p-2">Loading summary...</div>
            </form>
        </div>

        <!-- Sub-service Tabs: -->
        <div v-else-if="objectNode.service.ui?.['subservice-display'] === 'tabs'" class="flex-grow-1">
            <ServiceView
                :showObjects="true" 
                :serviceNode="selectedService as ServiceNode"
                @select-object="objectNode => selectObject(objectNode)"
                @new-object="newObject()"
                @info="message => emit('info', message)"
                @error="message => emit('error', message)"
            ></ServiceView>
        </div>

        <!-- Sub-service list: -->
        <div 
            v-if="!isNew && servicelist && servicelist.length > 0 && objectNode.service.ui?.['subservice-display'] !== 'tabs'" 
            class="ps-2 mt-2 border-top border-dark pt-2 flex-grow-1"
        >
            <div v-if="objectNode.service.ui?.['subservice-display'] === 'grid'">
                <!-- Grid display using a Bootstrap cards: -->
                <div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4">
                    <div v-for="serviceRef in servicelist" :key="serviceRef.name" class="col">
                        <div class="card h-100 shadow-sm">
                            <div class="card-header d-flex justify-content-between align-items-start">
                                <div>
                                    <h5 class="card-title mb-0">{{services[serviceRef.name]?.ui?.['service-view']?.title ?? serviceRef.name.charAt(0).toUpperCase() + serviceRef.name.substring(1)}}</h5>
                                    <small class="text-secondary">{{services[serviceRef.name]?.summary}}</small>
                                </div>
                                <a href="#" @click.stop="selectService(serviceRef)"><i class="bi bi-arrow-up-right-square"></i></a>
                            </div>
                            <div class="card-body">
                                {{services[serviceRef.name]?.description}}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div v-else>
                <!-- Default display as service list: -->
                <h5>Services provided by this object:</h5>
                <div v-for="serviceRef in servicelist" class="list-group list-group-flush">
                    <a href="#" @click="selectService(serviceRef)" class="list-group-item list-group-item-action ps-2 pe-2 pt-1 pb-1">
                        <strong>{{services[serviceRef.name]?.ui?.['service-view']?.title ?? serviceRef.name.charAt(0).toUpperCase() + serviceRef.name.substring(1)}}</strong>
                        <small class="text-secondary ms-3">{{services[serviceRef.name]?.summary}}</small>
                    </a>
                </div>
            </div>
        </div>
    </div>
</template>