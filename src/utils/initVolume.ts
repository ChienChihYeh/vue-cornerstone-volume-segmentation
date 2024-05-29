import type { Ref } from 'vue'
import { volumeLoader } from '@cornerstonejs/core'
import { volumeId, segmentationId } from '@/constants/cornerstoneIds'

export async function initVolume(volume: Ref<any>, imageIds: string[]) {
  volume.value = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: imageIds })
  await volumeLoader.createAndCacheDerivedSegmentationVolume(volumeId, {
    volumeId: segmentationId
  })
}
