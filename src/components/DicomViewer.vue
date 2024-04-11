<!-- https://deploy-preview-1177--cornerstone-3d-docs.netlify.app/live-examples/segmentationvolume -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  volumeName,
  volumeLoaderScheme,
  segmentationId,
  viewportIds,
  renderingEngineId,
  toolGroupId
} from '@/constants/cornerstoneIds'
import * as cornerstone from '@cornerstonejs/core'
// import { dicomImageIds } from '@/utils/dicomImagePath'
import * as cornerstoneTools from '@cornerstonejs/tools'
import type { IVolumeViewport, PublicViewportInput } from '@cornerstonejs/core/dist/types/types'
import { initVolume } from '@/utils/initVolume'

const props = defineProps<{ imageIds: string[] }>()

const dicomImageIds = props.imageIds

const el1 = ref<HTMLDivElement | null>()
const el2 = ref<HTMLDivElement | null>()
const el3 = ref<HTMLDivElement | null>()
const volume = ref()

const volumeId = `${volumeLoaderScheme}:${volumeName}`

const { getRenderingEngine, setVolumesForViewports, Enums } = cornerstone
const { ViewportType, OrientationAxis } = Enums
const { segmentation, ToolGroupManager, Enums: ToolEnums } = cornerstoneTools
const renderingEngine = getRenderingEngine(renderingEngineId)

onMounted(() => {
  const viewportInputArray = [
    {
      viewportId: viewportIds[0],
      type: ViewportType.ORTHOGRAPHIC,
      element: el1.value,
      defaultOptions: {
        orientation: OrientationAxis.AXIAL
      }
    },
    {
      viewportId: viewportIds[1],
      type: ViewportType.ORTHOGRAPHIC,
      element: el2.value,
      defaultOptions: {
        orientation: OrientationAxis.CORONAL
      }
    },
    {
      viewportId: viewportIds[2],
      type: ViewportType.ORTHOGRAPHIC,
      element: el3.value,
      defaultOptions: {
        orientation: OrientationAxis.SAGITTAL
      }
    }
  ] as PublicViewportInput[]

  async function initRender() {
    await initVolume(volume, dicomImageIds)

    if (!renderingEngine) return console.log('no rendering engine')

    renderingEngine?.setViewports(viewportInputArray)
    const toolGroup = ToolGroupManager.getToolGroup(toolGroupId)
    for (let i = 0; i < viewportIds.length; i++) {
      toolGroup?.addViewport(viewportIds[i], renderingEngineId)
    }
    volume.value.load()

    await setVolumesForViewports(renderingEngine, [{ volumeId }], viewportIds)

    await segmentation.addSegmentationRepresentations(toolGroupId, [
      { segmentationId, type: ToolEnums.SegmentationRepresentations.Labelmap }
    ])

    renderingEngine.renderViewports(viewportIds)
    // custom VOI settings
    // for (let i = 0; i < viewportIds.length; i++) {
    //   const viewport = renderingEngine.getViewport(viewportIds[i]) as IVolumeViewport
    //   viewport.setProperties({ voiRange: { lower: -500, upper: 1600 } })
    // }
  }
  initRender()
})
</script>

<template>
  <h3 class="title">Render Volume and Segmentation in Vue</h3>
  <div class="viewer-container">
    <div class="viewer" ref="el1" id="viewer1" @contextmenu="$event.preventDefault()"></div>
    <div class="viewer" ref="el2" id="viewer2" @contextmenu="$event.preventDefault()"></div>
    <div class="viewer" ref="el3" id="viewer3" @contextmenu="$event.preventDefault()"></div>
  </div>
  <div class="foot">
    <button
      @click="
        () => {
          const segmentations = cornerstoneTools.segmentation.state.getSegmentations()
          const volumeSegmentation = cornerstone.cache.getVolume(segmentations[0].segmentationId)
          console.log(volumeSegmentation)
          // convert to arrayBuffer
          // const arrayBuffer = volumeSegmentation.getScalarData()
          // console.log(arrayBuffer)
        }
      "
    >
      Show Segmentation Object
    </button>
  </div>
</template>

<style scoped>
.viewer {
  width: 500px;
  height: 500px;
  margin: 8px;
}

.viewer-container {
  display: flex;
  flex-direction: row;
  margin: auto;
}

.title,
.foot {
  text-align: center;
}
</style>
