import type { Ref } from 'vue'
import { volumeLoader } from '@cornerstonejs/core'
import { volumeLoaderScheme, volumeName, segmentationId } from '@/constants/cornerstoneIds'
import * as cornerstoneTools from '@cornerstonejs/tools'

const volumeId = `${volumeLoaderScheme}:${volumeName}`
// const { segmentation, Enums: ToolEnums } = cornerstoneTools

export async function initVolume(volume: Ref<any>, imageIds: string[]) {
  volume.value = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: imageIds })
  await volumeLoader.createAndCacheDerivedSegmentationVolume(volumeId, {
    volumeId: segmentationId
  })
}
