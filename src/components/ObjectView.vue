<script setup lang="ts">
import type { ObjectNode, ObjectReference, ServiceReference } from '@/BlackboxClient';
import { ServiceNode } from '@/BlackboxClient';
import type Oas3schema from '@/types/Oas3schema';
import { onMounted, ref, watch } from 'vue';
import ServiceView from './ServiceView.vue'
import Properties from './Properties.vue';

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
    'selectObject'
])

const servicelist = ref<ServiceReference[]>([])
const actions = ref<string[]>([])
const objectSchema = ref<Oas3schema | undefined>(props.objectNode?.service.type?.schema as Oas3schema | undefined)
const editing = ref<boolean>(false)
const originalObject = ref<any>(null)
const selectedTab = ref<string>('summary')
const selectedService = ref<ServiceNode|null>(null)
const parentServiceNode = ref<ServiceNode|null>(null)

onMounted(loadObject)
watch(() => props.objectNode, loadObject)

async function loadObject() {
    servicelist.value = await props.objectNode.getServiceList()
    actions.value = await props.objectNode.getActions()

    originalObject.value = JSON.parse(JSON.stringify(props.objectNode.object))

    // Resolve relative schema hrefs to absolute URLs:
    parentServiceNode.value = new ServiceNode(props.objectNode.service)
    objectSchema.value = await parentServiceNode.value.resolveSchema()
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
        actions.value.includes('replace') ? 'replace' 
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

function revert() {
    // Revert the object to the original state:
    props.objectNode.object = JSON.parse(JSON.stringify(originalObject.value))
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

async function selectTab(serviceRef: ServiceReference|null) {
    console.log(`selecting tab ${serviceRef?.name}`);
    
    if(!serviceRef) {
        selectedTab.value = 'summary'
        selectedService.value = null
    } else {
        selectedService.value = await serviceRef.getServiceNode()
        selectedTab.value = serviceRef.name
    }
}

async function selectObject(objectNode: ObjectNode) {
    selectedTab.value = 'summary'
    selectedService.value = null
    emit('selectObject', objectNode)
}
</script>

<template>
    <div class="d-flex flex-column h-100">
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
                >{{service.name.charAt(0).toUpperCase() + service.name.substring(1)}}</a>
            </li>
        </ul>

        <!-- Summary Tab -->
        <div v-if="selectedTab === 'summary'">
            <!-- Toolbar: -->
            <div class="d-flex flex-row justify-content-between mb-1 bg-dark">
                <div>
                    <button 
                        v-if="!isNew && !editing && (actions.includes('update') || actions.includes('replace'))" 
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
                        <i class="bi bi-trash3"></i>
                    </button>
                    
                    <button 
                        v-if="isNew || editing && (actions.includes('update') || actions.includes('replace'))" 
                        class="btn border-0"
                        @click="save()"
                    >
                        <i class="bi bi-floppy"></i>
                    </button>
                    <button 
                        v-if="editing && !isNew" 
                        class="btn border-0"
                        @click="editing = false; revert()"
                    >
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
            </div>

            <!-- Object properties: -->
            <form v-if="objectSchema?.properties && typeof objectNode.object === 'object' && objectSchema?.type === 'object'" class="ps-2 mt-2 border-top border-dark pt-2">
                <Properties
                    v-if="parentServiceNode"
                    :serviceNode="parentServiceNode"
                    :properties="objectSchema.properties"
                    :editing="editing"
                    :isNew="isNew || false"
                    v-model="objectNode.object"
                ></Properties>
                <div v-else class="p-2">Loading summary...</div>
            </form>
            <div v-else class="ps-2">{{ objectNode.object }}</div>
        </div>

        <!-- Sub-service Tabs: -->
        <div v-else-if="objectNode.service.ui?.['subservice-display'] === 'tabs'" class="flex-grow-1">
            <ServiceView
                :showObjects="true" 
                :serviceNode="selectedService as ServiceNode"
                @select-object="objectNode => selectObject(objectNode)"
                @new-object="emit('newObject')"
                @info="message => emit('info', message)"
                @error="message => emit('error', message)"
            ></ServiceView>
        </div>

        <!-- Sub-service list: -->
        <div v-else-if="servicelist && servicelist.length > 0" class="ps-2 mt-2 border-top border-dark pt-2 flex-grow-1">
            <h5>Services provided by this object:</h5>
            <div v-for="serviceRef in servicelist" class="list-group list-group-flush">
                <a href="#" @click="selectService(serviceRef)" class="list-group-item list-group-item-action ps-2 pe-2 pt-1 pb-1"><strong>{{ serviceRef.name }}</strong></a>
            </div>
        </div>
    </div>
</template>