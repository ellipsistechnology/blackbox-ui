<script setup lang="ts">
import {BApp} from 'bootstrap-vue-next'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import Menu from './components/Menu.vue'
import Sidebar from './components/Sidebar.vue'
import { ref } from 'vue'
import SplitColumns from './components/SplitColumns.vue'
import ServerSummary from './components/ServerSummary.vue'
import type Service from './types/Service'
import ServiceView from './components/ServiceView.vue'
import type { ServiceNode } from './BlackboxClient'

const showSidebar = ref(false)
const selectedServer = ref<{url:string}|null>(null)
const selectedServiceNode = ref<ServiceNode|null>(null)
</script>

<template>
  <BApp>
    <div class="d-flex flex-column h-100">

      <header class="flex-shrink-0">
        <Menu @toggleSidebar="showSidebar = !showSidebar"></Menu>
      </header>

      <main class="flex-grow-1 overflow-auto">
        <SplitColumns :show-left="showSidebar" :min-width-left=100 :min-width-right=200 initial-split="250px" class="h-100">
          <template #left>
            <Sidebar 
              @select-server="server => {selectedServer = server; selectedServiceNode = null}"
              @select-service="service => {selectedServiceNode = service; selectedServer = null}"
            ></Sidebar>
          </template>
          <template #right>
            <div>
              <ServerSummary v-if="selectedServer" :url="selectedServer?.url"></ServerSummary>
              <ServiceView v-else-if="selectedServiceNode" :show-objects="true" :serviceNode="selectedServiceNode"></ServiceView>
            </div>
          </template>
        </SplitColumns>
      </main>
    </div>
  </BApp>
</template>

