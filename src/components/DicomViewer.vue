<!-- https://deploy-preview-1177--cornerstone-3d-docs.netlify.app/live-examples/segmentationvolume -->
<!-- TODO: import/export DICOM -->
<!-- TODO: add/set/remove activeSegmentationRepresentation -->

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
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
import type { PublicViewportInput } from '@cornerstonejs/core/dist/types/types'
// import type { IVolumeViewport } from '@cornerstonejs/core/dist/types/types'
import { initVolume } from '@/utils/initVolume'
import labelmapTools from '@/utils/labelmapTools'
import { getSegmentationInfo } from '@/utils/segmentationHelpers'

const props = defineProps<{ imageIds: string[] }>()

const dicomImageIds = props.imageIds
const toolNames = [...labelmapTools.toolMap.keys()]

const el1 = ref<HTMLDivElement | null>()
const el2 = ref<HTMLDivElement | null>()
const el3 = ref<HTMLDivElement | null>()
const volume = ref()
const currentTool = ref(toolNames[0])
const brushSize = ref(25)

const volumeId = `${volumeLoaderScheme}:${volumeName}`

const { getRenderingEngine, setVolumesForViewports, Enums } = cornerstone
const { ViewportType, OrientationAxis } = Enums
const { segmentation, ToolGroupManager, Enums: ToolEnums, utilities } = cornerstoneTools
const renderingEngine = getRenderingEngine(renderingEngineId)

console.log('Brush Tool Map:', toolNames)

function selectTool(toolName: string) {
  const toolGroup = ToolGroupManager.getToolGroup(toolGroupId)
  if (!toolGroup) return
  const primaryMouseToolName = toolGroup.getActivePrimaryMouseButtonTool()
  if (primaryMouseToolName) {
    toolGroup.setToolDisabled(primaryMouseToolName)
  }
  toolGroup.setToolActive(toolName, {
    bindings: [{ mouseButton: 1 }]
  })
}

selectTool(toolNames[0])

watch(currentTool, (value) => {
  selectTool(value)
})

watch(brushSize, (value) => {
  utilities.segmentation.setBrushSizeForToolGroup(toolGroupId, value)
})

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

    segmentation.addSegmentations([
      {
        segmentationId,
        representation: {
          type: ToolEnums.SegmentationRepresentations.Labelmap,
          data: {
            volumeId: segmentationId
          }
        }
      }
    ])

    await segmentation.addSegmentationRepresentations(toolGroupId, [
      { segmentationId, type: ToolEnums.SegmentationRepresentations.Labelmap }
    ])

    const segmentationRepresentations =
      segmentation.state.getSegmentationIdRepresentations(segmentationId)

    segmentation.activeSegmentation.setActiveSegmentationRepresentation(
      toolGroupId,
      segmentationRepresentations[0].segmentationRepresentationUID
    )

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
  <h3 class="title">Volume Render and Segmentation Tools in Vue</h3>
  <div class="viewer-container">
    <div class="viewer" ref="el1" id="viewer1" @contextmenu="$event.preventDefault()"></div>
    <div class="viewer" ref="el2" id="viewer2" @contextmenu="$event.preventDefault()"></div>
    <div class="viewer" ref="el3" id="viewer3" @contextmenu="$event.preventDefault()"></div>
  </div>
  <div class="foot">
    <select v-model="currentTool">
      <option v-for="item in labelmapTools.toolMap.keys()" :key="item">{{ item }}</option>
    </select>

    <button @click="getSegmentationInfo()">Segmentation Log</button>
    <span>Brush Size: {{ brushSize }} :</span
    ><input type="range" min="10" max="50" v-model="brushSize" />
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

button,
select,
input {
  margin: 0 4px;
}

input {
  vertical-align: text-bottom;
}

span {
  font-size: 0.875rem;
}
</style>
