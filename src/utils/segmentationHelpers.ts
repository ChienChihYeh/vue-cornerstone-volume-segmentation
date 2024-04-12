import * as cornerstone from '@cornerstonejs/core'
import * as cornerstoneTools from '@cornerstonejs/tools'
import { toolGroupId } from '@/constants/cornerstoneIds'

const { segmentation } = cornerstoneTools

export function getSegmentationInfo() {
  const segmentations = segmentation.state.getSegmentations()
  console.log(segmentations)

  const activeSegmentationRepresentation =
    segmentation.activeSegmentation.getActiveSegmentationRepresentation(toolGroupId)
  const volumeSegmentation = cornerstone.cache.getVolume(
    activeSegmentationRepresentation.segmentationId
  )
  // const csImages = volume.getCornerstoneImages()
  // console.log(csImages)
  console.log(volumeSegmentation)

  // convert to arrayBuffer (Uinit8Array)
  const arrayBuffer = volumeSegmentation.getScalarData()
  console.log(arrayBuffer)
}

// concept: import and export segmentations
// https://github.com/cornerstonejs/cornerstoneTools/blob/master/docs/latest/modules/segmentation.md

// Array to volume?
// https://www.cornerstonejs.org/docs/concepts/cornerstone-core/volumes/

// Add segmentations

// Alternative implementation: https://github.com/cornerstonejs/cornerstone3D/pull/1177
