<script setup lang="ts">
import type { ObjectNode, ServiceReference } from '@/BlackboxClient';
import type Oas3schema from '@/types/Oas3schema';
import { onMounted, ref, watch } from 'vue';

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
    'objectSaved'
])

const servicelist = ref<ServiceReference[]>([])
const actions = ref<string[]>([])
const objectSchema = ref<Oas3schema | undefined>(props.objectNode?.service.type?.schema as Oas3schema | undefined)
const editing = ref<boolean>(false)
const originalObject = ref<any>(null)

onMounted(loadObject)
watch(() => props.objectNode, loadObject)

async function loadObject() {
    servicelist.value = await props.objectNode.getServiceList()
    actions.value = await props.objectNode.getActions()

    originalObject.value = JSON.parse(JSON.stringify(props.objectNode.object))

    // Resolve relative schema hrefs to absolute URLs:
    const schema = props.objectNode?.service.type?.schema as {href: string}
    if(schema?.href) {
        let url
        if(!(schema.href.startsWith('http://') || schema.href.startsWith('https://'))) {
            url = new URL(schema.href, props.objectNode.service.url)
        } else {
            url = new URL(schema.href)
        }
        const response = await fetch(url)
        const data = await response.json()

        // Get the path after # from the href 
        // and replace the reference with the schema:
        const hashIndex = url.hash.indexOf('#/')
        if(hashIndex >= 0) {
            const path = url.hash.substring(hashIndex + 2).split('/')
            let subdoc: any = data
            for(const p of path) {
                subdoc = subdoc[p]
            }
            props.objectNode.service.type!.schema = subdoc
            objectSchema.value = subdoc
        } else {
            console.error(`Could not find path '${url.hash}' at '${url.toString()}'`)
        }
    } else {
        objectSchema.value = props.objectNode?.service.type?.schema as Oas3schema | undefined
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
</script>

<template>
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
    <form v-if="typeof objectNode.object === 'object' && objectSchema?.type === 'object'" class="ps-2 mt-2 border-top border-dark pt-2">
        <div v-for="key in Object.keys(objectSchema.properties as object)" :key="key" class="row p-1">
            <label class="col-sm-2 col-form-label col-form-label-sm text-end pe-2" :for="key">
                <strong>{{ key }}</strong>
            </label>
            <div class="col-sm-8 ps-1">
                <input 
                    class="form-control-sm" 
                    :readonly="!editing && !isNew" 
                    :class="editing || isNew ? 'form-control' : 'form-control-plaintext'" 
                    :id="key" 
                    type="text" 
                    v-model="objectNode.object[key]"
                ></input>
            </div>
        </div>
    </form>
    <div v-else class="ps-2">{{ objectNode.object }}</div>

    <!-- Sub-service list: -->
    <div v-if="servicelist && servicelist.length > 0" class="ps-2 mt-2 border-top border-dark pt-2">
        <h5>Services provided by this object:</h5>
        <div v-for="serviceRef in servicelist" class="list-group list-group-flush">
            <a href="#" @click="selectService(serviceRef)" class="list-group-item list-group-item-action ps-2 pe-2 pt-1 pb-1"><strong>{{ serviceRef.name }}</strong></a>
        </div>
    </div>
</template>