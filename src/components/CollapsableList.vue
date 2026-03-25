<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({
    title: {
        type: String,
        required: true
    },
    openByDefault: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits([
    'show',
    'hide'
])

const collapseRef = ref<HTMLElement | null>(null);
const dynamicAngle = ref(props.openByDefault ? 90 : 0);
const id = 'collapse-' + Math.random().toString(36).substring(2, 9);

watch(() => props.openByDefault, (newVal) => {
    dynamicAngle.value = newVal ? 90 : 0;
});

const handleShown = (event: Event) => {
    // Bootstrap collapse events bubble from nested collapses; only handle our own node.
    if (event.target !== collapseRef.value) {
        return;
    }

    emit('show')
    dynamicAngle.value = 90
};

const handleHidden = (event: Event) => {
    // Bootstrap collapse events bubble from nested collapses; only handle our own node.
    if (event.target !== collapseRef.value) {
        return;
    }

    emit('hide')
    dynamicAngle.value = 0
};

onMounted(() => {
  // Add event listeners when the component is mounted
  if (collapseRef.value) {
    collapseRef.value.addEventListener('show.bs.collapse', handleShown);
    collapseRef.value.addEventListener('hide.bs.collapse', handleHidden);
  }
});

onUnmounted(() => {
  // Clean up event listeners when the component is unmounted
  if (collapseRef.value) {
    collapseRef.value.removeEventListener('show.bs.collapse', handleShown);
    collapseRef.value.removeEventListener('hide.bs.collapse', handleHidden);
  }
});

</script>

<template>
    <div class="">
        <div class="titlebar d-flex justify-content-between align-items-center">
            <a class="btn rounded-0 border-0 align-start p-0 pe-2 text-start" data-bs-toggle="collapse" :href="'#'+id" role="button" :aria-expanded="props.openByDefault" :aria-controls="id">
                <i class="bi bi-chevron-right d-inline-block ms-1 me-1" :style="{ transform: `rotate(${dynamicAngle}deg)`, transition: 'transform 0.3s ease' }"></i>
                <div class="d-inline-block">{{ title }}</div>
            </a>
            <slot v-if="dynamicAngle > 45" name="toolbar"></slot>
        </div>
        <div ref="collapseRef" class="collapse" :class="{ show: props.openByDefault }" :id="id">
            <slot name="body"></slot>
        </div>
    </div>
</template>

<style scoped>
.titlebar i {
    width: 18px;
}

.collapse, .collapsing {
    margin-left: 26px;
}
</style>
