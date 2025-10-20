<script setup lang="ts">
import {BApp} from 'bootstrap-vue-next'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import Menu from './components/Menu.vue'
import Sidebar from './components/Sidebar.vue'
import { onMounted, ref, watch } from 'vue'
import SplitColumns from './components/SplitColumns.vue'
import ServerSummary from './components/ServerSummary.vue'
import ServiceView from './components/ServiceView.vue'
import { RootNode, ServiceNode, type ObjectNode } from './BlackboxClient'
import ObjectView from './components/ObjectView.vue'
import * as bootstrap from 'bootstrap'

type Node = RootNode | ServiceNode | ObjectNode
type NodeType = 'server' | 'service' | 'object'

interface Breadcrumb {
    label: string
    node: Node
    type: NodeType
    url: URL
}

const showSidebar = ref(false)
const selectedType = ref<NodeType | null>(null)
const selectedNode = ref<Node | null>(null)
const breadcrumbs = ref<Breadcrumb[]>([])
const popover = ref<bootstrap.Popover|null>(null)

function setPopover() {
  console.log(`setting popover`);
  
  const content = document.getElementById('popover-content')
  const pos = document.querySelectorAll('[data-bs-toggle="popover"]')
  pos.forEach(popoverEl => { // should only be 1
    console.log(`Got popover:`, popoverEl);
    
    popover.value = new bootstrap.Popover(popoverEl, {
      placement: 'left',
      trigger: 'click',
      html: true,
      sanitize: false,
      content: content!
    })
  })
}

// watch(() => selectedNode.value, () => {
//   setPopover()
// }, {deep: true})

onMounted(setPopover)

function jumpToBreadcrumb(index: number) {
  const crumb = breadcrumbs.value[index]
  if(!crumb) return

  // Trim breadcrumbs to this index:
  breadcrumbs.value = breadcrumbs.value.slice(0, index + 1)

  selectedNode.value = crumb.node
  selectedType.value = crumb.type
}

function setNode(type: NodeType, node: Node, reset: boolean) {
  selectedNode.value = node
  selectedType.value = type

  if(selectedType.value === 'server') {
    // Starting a new breadcrumb trail from the selected server:
    breadcrumbs.value = [{
      type: 'server',
      node: selectedNode.value,
      label: (selectedNode.value as RootNode).url.origin,
      url: (selectedNode.value as RootNode).url
    }]
    selectedType.value = 'server'
  }
  else if(selectedType.value === 'service') {
    // Create a new breadcrumb trail starting from the root associated with the service:
    if(reset) {
        breadcrumbs.value = [{
          type: 'server',
          node: new RootNode((selectedNode.value as ServiceNode).service.url.origin),
          label: (selectedNode.value as ServiceNode).service.url.origin,
          url: (selectedNode.value as ServiceNode).service.url
        }]
    }
    // Add the selected service:
    breadcrumbs.value.push({
      type: 'service',
      node: selectedNode.value,
      label: (selectedNode.value as ServiceNode).service.name,
      url: (selectedNode.value as ServiceNode).service.url
    })
    selectedType.value = 'service'
  }
  else if(selectedType.value === 'object') {
    // Add the selected object:
    breadcrumbs.value.push({
      type: 'object',
      node: selectedNode.value,
      label: decodeURIComponent((selectedNode.value as ObjectNode).url.pathname.split('/').pop() || '?'),
      url: (selectedNode.value as ObjectNode).url
    })
    selectedType.value = 'object'
  } else {
    console.error(`Nothing selected - breadcrumb not added.`)
    return
  }
}

function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    .then(() => {
        const toastEl = document.getElementById('copyConfirmation')
        const bsToast = new bootstrap.Toast(toastEl!)
        bsToast.show()

        setTimeout(() => {
            if(popover.value) {
                popover.value.hide()
            }
        }, 1000);
    });
}
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
              @select-server="server => setNode('server', server, true)"
              @select-service="serviceNode => setNode('service', serviceNode, true)"
            ></Sidebar>
          </template>
          <template #right>
            <nav class="d-flex flex-row m-2 p-1 ps-2">
              <ol class="breadcrumb m-0 bg-transparent">
                <li v-for="(crumb, index) in breadcrumbs" class="breadcrumb-item" :class="index === breadcrumbs.length-1 ? 'active' : ''">
                  <a v-if="index !== breadcrumbs.length-1" href="#" @click="jumpToBreadcrumb(index)" class="text-decoration-none">{{crumb.label}}</a>
                  <span v-else>{{crumb.label}}</span>
                </li>
              </ol>

              <!-- Copy URL to clipboard. -->
              <!-- Uses a popover based on the #popove-content div below. -->
              <!-- Once copied to clipboard will show the toast below that. -->
              <div :class="breadcrumbs.length > 0 ? '' : 'd-none'" class="ms-auto">
                  <button type="button" class="btn border-0 p-0 pe-1" data-bs-toggle="popover">
                      <i class="bi bi-link-45deg"></i>
                  </button>
              </div>
              <div class="d-none">
                  <div id="popover-content">
                      <div class="d-flex flex-row">
                          <div class="flex-shrink-1 overflow-hidden text-truncate">{{breadcrumbs[breadcrumbs.length-1]?.url.toString()}}</div>
                          <button class="ms-2 btn border-0 p-0 m-0" @click="copyToClipboard(breadcrumbs[breadcrumbs.length-1]?.url?.toString() || '')">
                              <i class="bi bi-copy"></i>
                          </button>
                      </div>
                  </div>
              </div>
              <div class="toast-container position-fixed top-0 end-0 p-3">
                  <div id="copyConfirmation" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                      <div class="toast-header">
                          <i class="bi bi-copy me-2"></i>
                          <strong class="me-auto">Copied to clipboard</strong>
                          <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                      </div>
                  </div>
              </div>
            </nav>
            <div>

              <ServerSummary 
                v-if="selectedType === 'server'" 
                :rootNode="selectedNode as RootNode"
              ></ServerSummary>

              <ServiceView 
                v-else-if="selectedType === 'service'"
                :show-objects="true" 
                :serviceNode="selectedNode as ServiceNode"
                @select-object="objectNode => setNode('object', objectNode, false)"
              ></ServiceView>

              <ObjectView 
                v-else-if="selectedType === 'object'" 
                :objectNode="selectedNode as ObjectNode"
                @select-service="serviceNode => setNode('service', serviceNode, false)"
              ></ObjectView>

            </div>
          </template>
        </SplitColumns>
      </main>
    </div>
  </BApp>
</template>

