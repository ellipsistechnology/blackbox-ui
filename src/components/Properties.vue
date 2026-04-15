<script lang="ts" setup>
import type Oas3schema from '@/types/Oas3schema';
import CollapsableList from './CollapsableList.vue';
import type { ServiceNode } from '@/BlackboxClient';
import { onActivated, onMounted, ref, toRaw, watch } from 'vue';

type Type = 'unknown' | 'primative' | 'array' | 'object'

const modelValue = defineModel<any>();
const openCollapse = ref(false)
const schemaType = ref<Type>('unknown')
const checkedFilters = ref<{[key: string]: string[]}>({})
const filteredData = ref<any[]>([])

const emit = defineEmits([
    'save'
])

const props = defineProps<{
    schema?: Oas3schema,
    serviceNode: ServiceNode,
    editing: boolean,
    isNew: boolean,
    display?: 'list' | 'grid' | 'table',
    filter?: string[]
}>()

async function resolveRefs(schema: any) {
    if(schema.type === 'array' && schema.items) {
        props.serviceNode.resolveRefs(schema.items)
    } else {
        props.serviceNode.resolveRefs(schema)
    }
}

function isSchemaArray(): boolean {
    if(!props.schema) {
        return false
    }

    if(props.schema.type === 'array' && props.schema.items) {
        return true
    }

    if(Array.isArray(props.schema.anyOf)) {
        return props.schema.anyOf.some((s: any) => s.type === 'array' && s.items)
    }

    return false
}

function isSchemaPrimative(): boolean {
    if(!props.schema) {
        return false
    }

    if(props.schema.anyOf) {
        return props.schema.anyOf.some((s: any) => ['string', 'number', 'boolean'].includes(s.type))
    } else {
        const type = props.schema.type
        return ['string', 'number', 'boolean'].includes(type)
    }
}

function getArraySchema(): Oas3schema | undefined {
    if(props.schema?.type === 'array' && props.schema.items) {
        return props.schema.items as Oas3schema
    }

    if(Array.isArray(props.schema?.anyOf)) {
        const arraySchema = props.schema.anyOf.find((s: any) => s.type === 'array' && s.items)
        if(arraySchema) {
            return arraySchema.items as Oas3schema
        }
    }

    return undefined
}

function isSchemaObject(): boolean {
    if(!props.schema) {
        return false
    }

    if(props.schema.anyOf) {
        return props.schema.anyOf.some((s: any) => s.type === 'object' && s.properties)
    } else {
        return props.schema?.type === 'object' && props.schema.properties !== undefined
    }
}

function resolveSchemaType() {
    const rawValue = toRaw(modelValue.value)
    if(isSchemaPrimative() && ['number', 'string', 'boolean'].includes(typeof rawValue)) {
        schemaType.value = 'primative'
    } else if(isSchemaArray() && Array.isArray(rawValue)) {
        schemaType.value = 'array'
    } else if(isSchemaObject() && typeof rawValue === 'object') {
        schemaType.value = 'object'
    } else {
        schemaType.value = 'unknown'
    }
}

function getFilterLabels(key: string): string[] {
    if(!Array.isArray(toRaw(modelValue.value))) {
        return []
    }
    const uniqueValues = new Set(toRaw(modelValue.value).map((entry: any) => entry[key])).values()
    return Array.from(uniqueValues) as string[]
}

function loadFilters() {
    // Look for filter selection in local storage:
    const name = `${props.serviceNode.service.name}-filters`
    if(localStorage.getItem(name)) {
        const storedFilters = JSON.parse(localStorage.getItem(name)!)
        checkedFilters.value = storedFilters
    } else {
        // If no stored filters, initialize with all options selected:
        props.filter?.forEach(key => {
            checkedFilters.value[key] = getFilterLabels(key)
        })
    }

    filterData()
}

function filterData() {
    if(!Array.isArray(toRaw(modelValue.value))) {
        return
    }
    filteredData.value = toRaw(modelValue.value).filter((entry: any) => {
        return Object.keys(checkedFilters.value).every(item => {
            if(!checkedFilters.value[item] || checkedFilters.value[item].length === 0) {
                return true
            }
            return checkedFilters.value[item].includes(entry[item])
        })
    })
}

function selectFilter(item: string, label: string) {
    // Update selection:
    if(!checkedFilters.value[item]) {
        checkedFilters.value[item] = []
    }
    const index = checkedFilters.value[item].indexOf(label)
    if(index > -1) {
        checkedFilters.value[item].splice(index, 1)
    } else {
        checkedFilters.value[item].push(label)
    }

    // Save to local storage:
    localStorage.setItem(`${props.serviceNode.service.name}-filters`, JSON.stringify(checkedFilters.value))

    // Filter data:
    filterData()
}

function onViewShown() {
    resolveRefs(props.schema)
    resolveSchemaType()
    loadFilters()
    openCollapse.value = true
}

onMounted(onViewShown)
onActivated(onViewShown)

watch(async () => props.schema, () => {
    onViewShown()
})

watch(() => props.serviceNode.service.url.toString(), () => {
    onViewShown()
})
</script>

<template>
    <div 
        v-if="schemaType === 'primative'"
        class="d-inline-block ms-3 w-100"
    >
        <!-- Primative: -->
        <input 
            class="form-control-sm" 
            :readonly="!editing && !isNew" 
            :class="editing || isNew ? 'form-control' : 'form-control-plaintext'"
            type="text" 
            v-model="modelValue"
            @keyup.enter="emit('save')"
        ></input>
    </div>

    <div v-else-if="schemaType === 'array'">
        <!-- Array: -->
        <div v-if="display === 'grid'" class="d-flex flex-wrap gap-3 mb-3">
            <div v-for="(_, index) in modelValue" :key="index" class="border border-dark rounded p-2" style="min-width: 200px; max-width: 300px;">
                <Properties
                    :serviceNode="serviceNode"
                    :schema="getArraySchema()"
                    :editing="editing"
                    :isNew="isNew"
                    v-model="modelValue[index]"
                ></Properties>
            </div>
        </div>
        <div v-else-if="display === 'table' && getArraySchema()?.properties" class="table-responsive mb-3 border border-dark rounded">
            <table class="table table-sm mb-0">
                <tbody>
                    <tr>
                        <td v-for="(item, index) of Object.keys(getArraySchema()!.properties!)" :key="index" class="text-start align-top ms-0 ps-0 mt-2 mb-1 bg-dark">
                            <div v-if="filter?.includes(item)" class="dropdown">
                                <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <strong class="text-info ms-3 fw-bold">{{ item }}</strong>
                                </a>
                                <ul class="dropdown-menu dropdown-menu-light">
                                    <li v-for="label of getFilterLabels(item)" class="form-check ms-2">
                                        <input 
                                            class="form-check-input" 
                                            type="checkbox" 
                                            :value="label" 
                                            :id="`${item}-${label}`"
                                            :checked="checkedFilters[item]?.includes(label) ?? false"
                                            @change="selectFilter(item, label)">
                                        <label class="form-check-label" :for="`${item}-${label}`">
                                            {{ label }}
                                        </label>
                                    </li>
                                </ul>
                            </div>
                            <strong v-else class="text-info ms-3 fw-bold">{{ item }}</strong>
                        </td>
                    </tr>
                    <tr v-for="(data, index) in filteredData" :key="index">
                        <td v-for="(key, keyIndex) of Object.keys(getArraySchema()!.properties!)" :key="keyIndex" class="align-top m-0 p-0">
                            <Properties
                                :serviceNode="serviceNode"
                                :schema="getArraySchema()!.properties![key]"
                                :editing="editing"
                                :isNew="isNew"
                                v-model="filteredData[index][key]"
                            ></Properties>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <ul v-else class="list-unstyled">
            <li v-for="(_, index) in modelValue" :key="index" class="border-top border-dark">
                <Properties
                    :serviceNode="serviceNode"
                    :schema="getArraySchema()"
                    :editing="editing"
                    :isNew="isNew"
                    v-model="modelValue[index]"
                ></Properties>
            </li>
        </ul>
    </div>

    <div v-else-if="schemaType === 'object'" class="">
        <!-- Object -->
        <div v-for="key in Object.keys(schema!.properties as object)" :key="key" class="mb-2">

            <CollapsableList 
                :openByDefault="openCollapse"
                v-if="typeof modelValue[key] === 'object'"
                :title="key" 
                @show="resolveRefs(schema!.properties![key])"
            >
                <template #body>
                    <div class="mt-1 mb-1" v-if="schema!.properties![key]">
                        <Properties
                            :serviceNode="serviceNode"
                            :schema="schema!.properties![key]"
                            :editing="editing"
                            :isNew="isNew"
                            v-model="modelValue[key]"
                        ></Properties>
                    </div>
                    <div v-else>
                        Object has no properties...
                    </div>
                </template>
            </CollapsableList>

            <div v-else class="kvpair row mb-2 ms-0 me-0">
                <label class="col-sm-1 col-form-label col-form-label-sm ps-0" :for="key">
                    <strong>{{ key }}</strong>
                </label>

                <div class="col-sm-10" v-if="schema!.properties![key]">
                    <Properties
                        :serviceNode="serviceNode"
                        :schema="schema!.properties![key]"
                        :editing="editing"
                        :isNew="isNew"
                        v-model="modelValue[key]"
                    ></Properties>
                </div>
            </div>
        </div>
    </div>

    <!-- Unknown type -->
    <div class="d-inline-block ms-3" v-else>
        {{ modelValue }}
    </div>
</template>

<style scoped>
.kvpair {
    padding-left: 26px;
}
</style>
