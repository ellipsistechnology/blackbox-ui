<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

const props = defineProps({
    minWidthLeft: {
        type: Number,
        default: 100
    },
    minWidthRight: {
        type: Number,
        default: 100
    },
    initialSplit: {
        type: String,
        default: "50%"
    },
    showLeft: {
        type: Boolean,
        default: true
    },
    showRight: {
        type: Boolean,
        default: true
    }
});

onMounted(() => {
  const splitter = document.getElementById('splitter');
  const leftColumn = document.getElementById('left-column');
  const rightColumn = document.getElementById('right-column');
  if(!splitter || !leftColumn || !rightColumn || !splitter.parentElement) return;
  
  let isDragging = false;

  const handleMouseDown = (e: any) => {
    isDragging = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: any) => {
    if (!isDragging) return

    const containerWidth = splitter.parentElement!.getBoundingClientRect().width
    const leftWidthPx = e.clientX - splitter.parentElement!.getBoundingClientRect().left
    if( leftWidthPx < props.minWidthLeft || (containerWidth - leftWidthPx) < props.minWidthRight ) {
      return
    }
    const newLeftWidth = (leftWidthPx) / containerWidth * 100
    const newRightWidth = 100 - newLeftWidth

    leftColumn.style.width = `${newLeftWidth}%`
    rightColumn.style.width = `${newRightWidth}%`
  };

  const handleMouseUp = () => {
    isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  if (splitter) {
    splitter.addEventListener('mousedown', handleMouseDown);
  }
  
  onUnmounted(() => {
    if (splitter) {
      splitter.removeEventListener('mousedown', handleMouseDown);
    }
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  });
});
</script>

<template>
    <div class="d-flex flex-nowrap flex-row">
        <div :class="showLeft ? '' : 'd-none'" class="p-0 m-0 overflow-hidden" id="left-column" :style="{ width: initialSplit }">
            <slot name="left"></slot>
        </div>
        <div :class="showLeft && showRight ? '' : 'd-none'" class="gutter" id="splitter">
            <div class="bg-dark"></div>
        </div>
        <div :class="showRight ? '' : 'd-none'" class="flex-fill p-0 m-0" id="right-column">
            <slot name="right"></slot>
        </div>
    </div>
</template>

<style>
.gutter {
  width: 5px;
  cursor: ew-resize;
  flex-shrink: 0;
}
.gutter div {
  width: 1px;
  height: 100%;
  margin: 0 auto;
}
</style>
