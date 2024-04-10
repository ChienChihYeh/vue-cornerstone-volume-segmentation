<script setup lang="ts">
import { ref } from 'vue'
import { initCornerstone } from './utils/initCornerstone'
import DicomViewer from './components/DicomViewer.vue'
import { initToolGroup } from './utils/toolGroup'
import * as cornerstone from '@cornerstonejs/core'
import { dicomImageIds } from './utils/dicomImagePath'

const isInit = ref(false)

initCornerstone().then(() => {
  initToolGroup()
  // Load DICOM images: replace with your own image IDs
  Promise.all(cornerstone.imageLoader.loadAndCacheImages(dicomImageIds))
    .then(() => {
      isInit.value = true
    })
    .catch((error) => {
      console.error('Error loading and caching images:', error)
    })
})
</script>

<template>
  <main>
    <div class="container">
      <DicomViewer v-if="isInit" />
      <h3 v-else>Loading...</h3>
    </div>
  </main>
</template>
<style scoped>
main {
  height: 100dvh;
  display: flex;
  place-items: center;
}
.container {
  width: max-content;
  margin: auto;
}
</style>
