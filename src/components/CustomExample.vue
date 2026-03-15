<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRaw } from 'vue'

type ServiceMessage = {
	type: string
	service?: { name?: string; summary?: string; description?: string }
	refs?: ObjectRef[]
	objects?: unknown[]
}

type ObjectRef = {
	url: string
	props?: { [key: string]: any }
}

const service = ref<ServiceMessage['service'] | null>(null)
const objectRefs = ref<ObjectRef[]>([])
const fullObjects = ref<unknown[]>([])
const selectedIndexes = ref<number[]>([])

const selectedCount = computed(() => selectedIndexes.value.length)

function post(type: string, payload: Record<string, unknown> = {}) {
	window.parent.postMessage({ type, ...payload }, '*')
}

function onMessage(event: MessageEvent<ServiceMessage>) {
	if(!event.data || typeof event.data.type !== 'string') {
		return
	}

	if(event.data.type === 'set-service') {
		service.value = event.data.service ?? null
		objectRefs.value = event.data.refs ?? []
		selectedIndexes.value = []
	}
}

function createObject() {
	post('create-object')
	post('info', { message: 'Create object requested.' })
}

function deleteSelected() {
	if(selectedIndexes.value.length === 0) {
		post('error', { message: 'No objects selected for deletion.' })
		return
	}

	post('delete-objects', { refs: selectedIndexes.value.map(i => toRaw(objectRefs.value[i])) })
	post('info', { message: `Delete requested for ${selectedIndexes.value.length} object(s).` })
}

function selectObject(index: number) {
	post('select-object', { ref: toRaw(objectRefs.value[index]) })
	post('info', { message: `Selected object #${index + 1}.` })
}

function toggleSelection(index: number) {
	if(selectedIndexes.value.includes(index)) {
		selectedIndexes.value = selectedIndexes.value.filter(i => i !== index)
	} else {
		selectedIndexes.value = [...selectedIndexes.value, index]
	}
}

onMounted(() => {
	window.addEventListener('message', onMessage)
	post('info', { message: 'CustomExample ready.' })
	post('get-service')
})

onBeforeUnmount(() => {
	window.removeEventListener('message', onMessage)
})
</script>

<template>
	<section class="custom-example p-3">
		<h1 class="mb-1">Custom Service UI</h1>
		<p class="text-muted mb-3">Handles create, delete, get, select, info and error messages.</p>

		<div class="d-flex gap-2 mb-3">
			<button class="btn btn-sm btn-primary" @click="createObject">Create</button>
			<button class="btn btn-sm btn-danger" @click="deleteSelected">Delete Selected</button>
			<button class="btn btn-sm btn-outline-info" @click="post('info', { message: 'Info from CustomExample.' })">Send Info</button>
			<button class="btn btn-sm btn-outline-warning" @click="post('error', { message: 'Error from CustomExample.' })">Send Error</button>
		</div>

		<div v-if="service" class="mb-3">
			<div><strong>{{ service.name || 'Unnamed Service' }}</strong></div>
			<div class="text-muted">{{ service.summary || service.description }}</div>
		</div>

		<div class="mb-2">
			<strong>Objects</strong>
			<span class="text-muted ms-2">Selected: {{ selectedCount }}</span>
		</div>
		<ul class="list-group">
			<li
				v-for="(obj, index) in objectRefs"
				:key="index"
				class="list-group-item d-flex align-items-center justify-content-between"
			>
				<div class="d-flex align-items-center gap-2">
					<input
						class="form-check-input"
						type="checkbox"
						:checked="selectedIndexes.includes(index)"
						@change="toggleSelection(index)"
					>
					<button class="btn btn-link p-0 text-start" @click="selectObject(index)">
						{{ typeof obj.props === 'object' ? JSON.stringify(obj.props) : obj.props }}
					</button>
				</div>
			</li>
			<li v-if="objectRefs.length === 0" class="list-group-item text-muted">No objects received.</li>
		</ul>

		<div v-if="fullObjects.length" class="mt-3">
			<strong>Fetched object payloads: {{ fullObjects.length }}</strong>
		</div>
	</section>
</template>
