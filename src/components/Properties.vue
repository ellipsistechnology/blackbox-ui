<script lang="ts" setup>
import { onMounted, watch } from 'vue';

const props = defineProps<{
    modelValue: any,
    properties: { [key: string]: any },
    editing: boolean,
    isNew: boolean
}>()

async function resolveRefs(properties: any) {
    Object.entries(properties).forEach(p => {

    })
}
</script>

<template>
    <div v-for="key in Object.keys(properties as object)" :key="key" class="row p-1">
        <label class="col-sm-2 col-form-label col-form-label-sm text-end pe-2" :for="key">
            <strong>{{ key }}</strong>
        </label>
        <div v-if="['number', 'string'].includes(typeof modelValue[key])" class="col-sm-8 ps-1">
            <input 
                class="form-control-sm" 
                :readonly="!editing && !isNew" 
                :class="editing || isNew ? 'form-control' : 'form-control-plaintext'" 
                :id="key" 
                type="text" 
                v-model="modelValue[key]"
            ></input>
        </div>
        <div v-else-if="typeof modelValue[key] === 'object'" class="ps-5 border rounded border-secondary mt-1 mb-1">
            <Properties 
                :properties="properties[key]"
                :editing="editing"
                :isNew="isNew"
                v-model="modelValue[key]"
            ></Properties>
        </div>
    </div>
</template>