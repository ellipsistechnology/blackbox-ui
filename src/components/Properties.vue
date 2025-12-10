<script lang="ts" setup>
import type Oas3schema from '@/types/Oas3schema';
import CollapsableList from './CollapsableList.vue';
import type { ServiceNode } from '@/BlackboxClient';

const props = defineProps<{
    modelValue: any,
    properties: { [key: string]: Oas3schema },
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
</script>

<template>
    <div v-for="key in Object.keys(properties as object)" :key="key" class="row">

        <CollapsableList :title="key" v-if="typeof modelValue[key] === 'object'" @show="resolveRefs(properties[key])">
            <template #body>
                <!-- Object values: -->
                <div class="mt-1 mb-1" v-if="properties[key]?.properties">
                    <Properties
                        :serviceNode="serviceNode"
                        :properties="properties[key].properties"
                        :editing="editing"
                        :isNew="isNew"
                        v-model="modelValue[key]"
                    ></Properties>
                </div>

                <!-- Array values: -->
                <ul v-else-if="properties[key]?.type === 'array'">
                    <li v-for="(item, index) in modelValue[key]" :key="index" class="mb-2">
                        <Properties
                            v-if="(<any>properties[key].items).properties"
                            :serviceNode="serviceNode"
                            :properties="(<any>properties[key].items).properties"
                            :editing="editing"
                            :isNew="isNew"
                            v-model="modelValue[key][index]"
                        ></Properties>
                        <div class="d-inline-block ms-3" v-else-if="['number', 'string'].includes(typeof modelValue[key][index])">{{ modelValue[key][index] }}</div>
                        <div class="d-inline-block ms-3" v-else>Loading array item...{{ properties[key].items }}</div>
                    </li>
                </ul>

                <div v-else>
                    Loading...
                </div>
            </template>
        </CollapsableList>

        <div v-else class="kvpair">
            <label class="col-form-label col-form-label-sm text-end pe-2" :for="key">
                <strong>{{ key }}</strong>
            </label>

            <!-- Native values: -->
            <div v-if="['number', 'string'].includes(typeof modelValue[key])" class="ms-1 d-inline-block">
                <input 
                    class="form-control-sm" 
                    :readonly="!editing && !isNew" 
                    :class="editing || isNew ? 'form-control' : 'form-control-plaintext'" 
                    :id="key" 
                    type="text" 
                    v-model="modelValue[key]"
                ></input>
            </div>

            <div v-else class="ms-1 d-inline-block">
                {{modelValue[key]?.toString() || "undefined"}}
            </div>
        </div>
    </div>
</template>

<style scoped>
.kvpair {
    margin-left: 26px;
}
</style>
