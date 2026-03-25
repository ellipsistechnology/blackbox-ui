<script lang="ts" setup>
import type Oas3schema from '@/types/Oas3schema';
import CollapsableList from './CollapsableList.vue';
import type { ServiceNode } from '@/BlackboxClient';
import { onMounted, ref, watch } from 'vue';

const modelValue = defineModel<any>();
const openCollapse = ref(false)

const emit = defineEmits([
    'save'
])

const props = defineProps<{
    schema?: Oas3schema,
    serviceNode: ServiceNode,
    editing: boolean,
    isNew: boolean
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

onMounted(async () => {
    resolveRefs(props.schema)
    openCollapse.value = true
})

watch(async () => props.schema, () => {
    resolveRefs(props.schema)
    openCollapse.value = true
})
</script>

<template>
    <div 
        v-if="['number', 'string', 'boolean'].includes(typeof modelValue) || schema && ['number', 'string', 'boolean'].includes(schema.type)"
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

    <ul v-else-if="isSchemaArray() && Array.isArray(modelValue)" class="list-unstyled">
        <!-- Array: -->
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

    <div v-else-if="schema?.type === 'object' && schema.properties && typeof modelValue === 'object'" class="">
        <!-- Object -->
        <div v-for="key in Object.keys(schema.properties as object)" :key="key" class="mb-2">

            <CollapsableList 
                :openByDefault="openCollapse"
                v-if="typeof modelValue[key] === 'object'"
                :title="key" 
                @show="resolveRefs(schema.properties[key])"
            >
                <template #body>
                    <div class="mt-1 mb-1" v-if="schema.properties[key]">
                        <Properties
                            :serviceNode="serviceNode"
                            :schema="schema.properties[key]"
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

                <div class="col-sm-10" v-if="schema.properties[key]">
                    <Properties
                        :serviceNode="serviceNode"
                        :schema="schema.properties[key]"
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
