// https://www.cornerstonejs.org/live-examples/segmentationvolume

import * as cornerstone from '@cornerstonejs/core'
import * as cornerstoneTools from '@cornerstonejs/tools'
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader'
import { toolGroupId, volumeId } from '@/constants/cornerstoneIds'
import { adaptersSEG, helpers } from '@cornerstonejs/adapters'
import dcmjs from 'dcmjs'

const { segmentation } = cornerstoneTools
const { wadouri } = cornerstoneDICOMImageLoader
const { Cornerstone3D } = adaptersSEG

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

interface IImageVolumeExtension extends cornerstone.Types.IImageVolume {
  getCornerstoneImages(): cornerstone.Types.IImage[]
}

export function exportSegmentation() {
  const cacheVolume = cornerstone.cache.getVolume(volumeId) as IImageVolumeExtension
  const csImages = cacheVolume.getCornerstoneImages()

  const activeSegmentationRepresentation =
    segmentation.activeSegmentation.getActiveSegmentationRepresentation(toolGroupId)

  const cacheSegmentationVolume = cornerstone.cache.getVolume(
    activeSegmentationRepresentation.segmentationId
  )
  const labelmapData = Cornerstone3D.Segmentation.generateLabelMaps2DFrom3D(cacheSegmentationVolume)

  console.log(labelmapData)

  // mock metadata
  labelmapData.metadata = []
  labelmapData.segmentsOnLabelmap.forEach((segmentIndex: number) => {
    const color = segmentation.config.color.getColorForSegmentIndex(
      toolGroupId,
      activeSegmentationRepresentation.segmentationRepresentationUID,
      segmentIndex
    )

    const segmentMetadata = generateMockMetadata(segmentIndex, color)
    labelmapData.metadata[segmentIndex] = segmentMetadata
  })

  const generatedSegmentation = Cornerstone3D.Segmentation.generateSegmentation(
    csImages,
    labelmapData,
    cornerstone.metaData
  )

  helpers.downloadDICOMData(generatedSegmentation.dataset, 'mySEG.dcm')
}

function generateMockMetadata(segmentIndex: number, color: cornerstone.Types.Color) {
  const RecommendedDisplayCIELabValue = (
    dcmjs.data.Colors.rgb2DICOMLAB(color.slice(0, 3).map((value) => value / 255)) as number[]
  ).map((value) => Math.round(value))

  return {
    SegmentedPropertyCategoryCodeSequence: {
      CodeValue: 'T-D0050',
      CodingSchemeDesignator: 'SRT',
      CodeMeaning: 'Tissue'
    },
    SegmentNumber: segmentIndex.toString(),
    SegmentLabel: 'Tissue ' + segmentIndex.toString(),
    SegmentAlgorithmType: 'SEMIAUTOMATIC',
    SegmentAlgorithmName: 'Slicer Prototype',
    RecommendedDisplayCIELabValue,
    SegmentedPropertyTypeCodeSequence: {
      CodeValue: 'T-D0050',
      CodingSchemeDesignator: 'SRT',
      CodeMeaning: 'Tissue'
    }
  }
}

export async function importSegmentation(files: FileList, imageIds: string[]) {
  if (!volumeId) return console.log('no volume found')

  for (let i = 0; i < files.length; i++) {
    await readSegmentation(files[i], imageIds)
  }
}

async function readSegmentation(file: File, imageIds: string[]) {
  const imageId = wadouri.fileManager.add(file)

  const image = await cornerstone.imageLoader.loadAndCacheImage(imageId)

  if (!image) return console.log('segmentation image not found')

  const instance = cornerstone.metaData.get('instance', imageId)

  if (instance.Modality !== 'SEG') {
    console.error('This is not segmentation: ' + file.name)
    return
  }

  const arrayBuffer = image.bufferView?.buffer

  if (!arrayBuffer) return

  loadSegmentation(arrayBuffer, imageIds)
}

async function loadSegmentation(arrayBuffer: ArrayBuffer, imageIds: string[]) {
  const newSegmentationId = 'LOADED_SEGMENTATION_ID'

  const generateToolState = await Cornerstone3D.Segmentation.generateToolState(
    imageIds,
    arrayBuffer,
    cornerstone.metaData
  )
}
