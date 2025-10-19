<script setup lang="ts">
import { defineEmits, ref } from 'vue'
import CollapsableList from './CollapsableList.vue'
// import BlackboxClient from '@/BlackboxClient'
import type Service from '@/types/Service'
import { RootNode, ServiceReference } from '@/BlackboxClient'

const emit = defineEmits(['selectServer', 'selectService'])

const selectedServer = ref<{url:string}|null>(null)
const selectedService = ref<ServiceReference|null>(null)
const servers = ref([{ url: 'http://localhost:3000' }])
const services = ref<ServiceReference[]>([])

function selectServer(server: {url:string}) {
    selectedService.value = null
    selectedServer.value = server
    emit('selectServer', server)
}

async function selectService(service: ServiceReference) {
    selectedServer.value = null
    selectedService.value = service
    emit('selectService', await service.getServiceNode())
}

function loadServices() {
    services.value = []
    servers.value.forEach(async s => {
        // const serviceList = await new BlackboxClient(s.url).listServices()
        const serviceList = await new RootNode(s.url).getServiceList() // TODO: Error handling
        
        serviceList.forEach(async serviceRef => {
            // const serviceRef = await serviceRef.getServiceRefserviceRef()
            // services.value.push(serviceRef)
            services.value.push(serviceRef)
        })
    })
}

</script>

<template>
    <div class="h-100 p-0">
        <CollapsableList title="Servers">
            <template #toolbar>
                <button class="btn btn-sm btn-outline-secondary no-hover-effect border-0 p-0 pe-2">
                    <i class="bi bi-cloud-plus d-flex align-items-center h-100"></i>
                </button>
            </template>
            <template #body>
                <div class="list-group rounded-0">
                    <a v-for="server in servers" 
                        @click="selectServer(server)" 
                        href="#" 
                        :class="server.url === selectedServer?.url ? 'active' : ''" 
                        class="list-group-item list-group-item-action p-0 ps-2 pe-2 border-0"
                    >
                        {{ server.url }}
                    </a>
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
                        :class="serviceRef === selectedService ? 'active' : ''" 
                        class="list-group-item list-group-item-action p-0 ps-2 pe-2 border-0"
                    >
                        {{ serviceRef.name }}
                    </a>
                </div>
            </template>
        </CollapsableList>
    </div>
</template>
