<script setup lang="ts">
import { defineEmits, onMounted, ref } from 'vue'
import CollapsableList from './CollapsableList.vue'
import { RootNode, ServiceReference } from '@/BlackboxClient'

const emit = defineEmits(['selectServer', 'selectService', 'error'])

const localServers  = ref<{name?: string, url: string}[]>([])
const remoteServers = ref<{name?: string, url: string}[]>([])

const services = ref<ServiceReference[]>([])
const addingServer = ref(false)
const newServerURL = ref('')

onMounted(async () => {
    // Load servers from ellipsis.technology register:
    const response = await fetch('http://ellipsis.technology/emus/bb-clients.json', { cache: 'no-store' })
    if (!response.ok) {
        console.error(`Error loading clients from ellipsis.technology: ${response.status}`)
    }
    const data = await response.json()
    remoteServers.value.push(...data.filter((client: any) => client.url && client.name))

    // Load servers from local storage:
    const storedServers = localStorage.getItem('bb-servers')
    if(storedServers) {
        try {
            const parsed = JSON.parse(storedServers)
            if(Array.isArray(parsed)) {
                localServers.value.push(...parsed.filter((s: any) => s.url && !localServers.value.find(existing => existing.url === s.url)))
            }
        } catch(e) {
            console.error('Error parsing stored servers from local storage:', e)
        }
    }
})

function selectServer(server: {url:string}) {
    emit('selectServer', new RootNode(server.url))
}

async function selectService(service: ServiceReference) {
    emit('selectService', await service.getServiceNode())
}

function loadServices() {
    services.value = []
    localServers.value.forEach(async s => {
        try {
            const serviceList = await new RootNode(s.url).getServiceList() // TODO: Error handling
            serviceList.forEach(async serviceRef => {
                // const serviceRef = await serviceRef.getServiceRefserviceRef()
                // services.value.push(serviceRef)
                services.value.push(serviceRef)
            })
        } catch (e) {
            console.error(e)
            emit('error', `Error loading services from ${s.url}: ${e}`)
        }
    })
}

function addServer() {
    if(newServerURL.value?.trim().length > 0) {
        // Add the new server to the list:
        localServers.value.push({ url: newServerURL.value.trim() })
        newServerURL.value = ''
        addingServer.value = false

        // Update the local storage:
        localStorage.setItem('bb-servers', JSON.stringify(localServers.value))
    } else {
        emit('error', 'Server URL cannot be empty')
    }
}

function focusServerName() {
    setTimeout(() => {
        const inputs = document.getElementsByTagName('input')
        if(inputs.length > 0) {
            inputs[inputs.length - 1]?.focus()
        }
    }, 100)
}

</script>

<template>
    <div class="h-100 p-0">
        <CollapsableList title="Servers">
            <template #toolbar>
                <button class="btn btn-sm btn-outline-secondary no-hover-effect border-0 p-0 pe-2" @click="addingServer = true; focusServerName()" v-if="!addingServer">
                    <i class="bi bi-cloud-plus d-flex align-items-center h-100"></i>
                </button>
            </template>
            <template #body>
                <div class="list-group rounded-0">
                    <a v-for="server in localServers"
                        @click="selectServer(server)" 
                        href="#"
                        class="list-group-item list-group-item-action p-0 pe-2 border-0"
                    >
                        {{ server.name || server.url }}
                    </a>
                    <a v-for="server in remoteServers"
                        @click="selectServer(server)" 
                        href="#"
                        class="list-group-item list-group-item-action p-0 pe-2 border-0"
                    >
                        {{ server.name || server.url }}
                    </a>
                    <div class="list-group-item list-group-item-action p-0 pe-2 border-0">
                        <input 
                            type="text" 
                            class="form-control border-0 p-0 bg-transparent" 
                            placeholder="Add server..." 
                            @keyup.enter="addServer()"
                            @keyup.escape="addingServer = false"
                            v-if="addingServer"
                            v-model="newServerURL"
                        />
                    </div>
                </div>
            </template>
        </CollapsableList>
        <CollapsableList title="Services">
            <template #toolbar>
                <button @click="loadServices()" class="btn btn-sm btn-outline-secondary no-hover-effect border-0 p-0 pe-2">
                    <i class="bi bi-arrow-clockwise d-flex align-items-center h-100"></i>
                </button>
            </template>
            <template #body>
                <div class="list-group rounded-0">
                    <a v-for="serviceRef in services"
                        href="#" 
                        @click="selectService(serviceRef)"
                        class="list-group-item list-group-item-action p-0 pe-2 border-0"
                    >
                        {{ serviceRef.name }}
                    </a>
                </div>
            </template>
        </CollapsableList>
    </div>
</template>
