<script setup lang="ts">
import { ref } from 'vue'
import { initCornerstone } from './utils/initCornerstone'
import DicomViewer from './components/DicomViewer.vue'
import { initToolGroup } from './utils/toolGroup'
import { createImageIdsAndCacheMetaData } from './utils/helpers'
// import * as cornerstone from '@cornerstonejs/core'
// import { dicomImageIds } from './utils/dicomImagePath'

const isInit = ref(false)
const imageIds = ref()

async function initDemo() {
  imageIds.value = await createImageIdsAndCacheMetaData({
    StudyInstanceUID: '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463',
    SeriesInstanceUID: '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
    wadoRsRoot: 'https://d3t6nz73ql33tx.cloudfront.net/dicomweb'
  })
  isInit.value = true
}

initCornerstone().then(() => {
  initToolGroup()

  initDemo()
  // Workaround: load DICOM images for metadata
  // Promise.all(cornerstone.imageLoader.loadAndCacheImages(dicomImageIds))
  //   .then(() => {
  //     isInit.value = true
  //   })
  //   .catch((error) => {
  //     console.error('Error loading and caching images:', error)
  //   })
})
</script>

<template>
  <main>
    <div class="container">
      <DicomViewer v-if="isInit" :imageIds="imageIds" />
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
