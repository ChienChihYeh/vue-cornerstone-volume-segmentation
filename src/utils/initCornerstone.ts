import * as cornerstone from '@cornerstonejs/core'
import * as cornerstoneTools from '@cornerstonejs/tools'
import { renderingEngineId } from '../constants/cornerstoneIds'
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader'
import dicomParser from 'dicom-parser'
const { RenderingEngine, volumeLoader } = cornerstone
const { registerVolumeLoader } = volumeLoader
import { cornerstoneStreamingImageVolumeLoader } from '@cornerstonejs/streaming-image-volume-loader'
import type { StreamImageLoader } from '@/types/streamImageLoader'

export async function initCornerstone() {
  await cornerstone.init()
  cornerstoneTools.init()
  cornerstoneDICOMImageLoader.external.cornerstone = cornerstone
  cornerstoneDICOMImageLoader.external.dicomParser = dicomParser

  registerVolumeLoader(
    'cornerstoneStreamingImageVolume',
    cornerstoneStreamingImageVolumeLoader as StreamImageLoader
  )

  new RenderingEngine(renderingEngineId)
}
