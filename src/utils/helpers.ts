//from https://github.com/cornerstonejs/cornerstone3D/blob/00e347188b0b57854ddbefdfae220db42c4bf02f/utils/demo/helpers/createImageIdsAndCacheMetaData.js
import { api } from 'dicomweb-client'
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader'
import { metaData } from '@cornerstonejs/core'
import type { WADORSMetaData } from '@/types/WADORSMetaData'
import dcmjs from 'dcmjs'
// import { calibratedPixelSpacingMetadataProvider } from '@cornerstonejs/core/dist/types/utilities'
// import { CalibrationTypes } from '@cornerstonejs/core/dist/types/enums'
import type { InstanceMetadata } from '@cornerstonejs/calculate-suv'
import { calculateSUVScalingFactors } from '@cornerstonejs/calculate-suv'
import * as cornerstone from '@cornerstonejs/core'

const { Enums, utilities } = cornerstone
const csUtils = utilities
const { calibratedPixelSpacingMetadataProvider } = utilities
const { CalibrationTypes } = Enums

const ptScalingMetaDataProvider = {
  addInstance,
  get
}

export async function createImageIdsAndCacheMetaData({
  StudyInstanceUID,
  SeriesInstanceUID,
  SOPInstanceUID = null,
  wadoRsRoot,
  client = null
}: {
  StudyInstanceUID: string
  SeriesInstanceUID: string
  SOPInstanceUID?: string | null
  wadoRsRoot: string
  client?: api.DICOMwebClient | null
}): Promise<string[]> {
  const SOP_INSTANCE_UID = '00080018'
  const SERIES_INSTANCE_UID = '0020000E'
  const MODALITY = '00080060'

  const studySearchOptions = {
    studyInstanceUID: StudyInstanceUID,
    seriesInstanceUID: SeriesInstanceUID
  }

  client = client || new api.DICOMwebClient({ url: wadoRsRoot, singlepart: true })
  let instances = await client.retrieveSeriesMetadata(studySearchOptions)

  // if sop instance is provided we should filter the instances to only include the one we want
  if (SOPInstanceUID) {
    instances = instances.filter((instance) => {
      if (instance[SOP_INSTANCE_UID] && instance[SOP_INSTANCE_UID].Value) {
        return instance[SOP_INSTANCE_UID].Value[0] === SOPInstanceUID
      }
    })
  }

  let modality
  if (instances[0] && instances[0][MODALITY] && instances[0][MODALITY].Value)
    modality = instances[0][MODALITY].Value[0]
  modality = 'CT'
  let imageIds = instances.map((instanceMetaData) => {
    let SeriesInstanceUID
    if (instanceMetaData[SERIES_INSTANCE_UID] && instanceMetaData[SERIES_INSTANCE_UID].Value)
      SeriesInstanceUID = instanceMetaData[SERIES_INSTANCE_UID].Value[0]
    let SOPInstanceUIDToUse = SOPInstanceUID
    if (
      !SOPInstanceUIDToUse &&
      instanceMetaData[SOP_INSTANCE_UID] &&
      instanceMetaData[SOP_INSTANCE_UID].Value
    ) {
      SOPInstanceUIDToUse = instanceMetaData[SOP_INSTANCE_UID].Value[0] as string
    }

    const prefix = 'wadors:'

    const imageId =
      prefix +
      wadoRsRoot +
      '/studies/' +
      StudyInstanceUID +
      '/series/' +
      SeriesInstanceUID +
      '/instances/' +
      SOPInstanceUIDToUse +
      '/frames/1'

    cornerstoneDICOMImageLoader.wadors.metaDataManager.add(imageId, instanceMetaData)
    return imageId
  })

  // if the image ids represent multiframe information, creates a new list with one image id per frame
  // if not multiframe data available, just returns the same list given
  imageIds = convertMultiframeImageIds(imageIds)

  imageIds.forEach((imageId) => {
    let instanceMetaData = cornerstoneDICOMImageLoader.wadors.metaDataManager.get(imageId)

    // It was using JSON.parse(JSON.stringify(...)) before but it is 8x slower
    instanceMetaData = removeInvalidTags(instanceMetaData)

    if (instanceMetaData) {
      // Add calibrated pixel spacing

      const metadata = dcmjs.data.DicomMetaDictionary.naturalizeDataset(instanceMetaData)
      const pixelSpacing = getPixelSpacingInformation(metadata)

      if (pixelSpacing) {
        calibratedPixelSpacingMetadataProvider.add(imageId, {
          rowPixelSpacing: parseFloat(pixelSpacing[0]),
          columnPixelSpacing: parseFloat(pixelSpacing[1]),
          type: CalibrationTypes.NOT_APPLICABLE
        })
      }
    }
  })

  // we don't want to add non-pet
  // Note: for 99% of scanners SUV calculation is consistent bw slices
  if (modality === 'PT') {
    const InstanceMetadataArray: InstanceMetadata[] = []
    imageIds.forEach((imageId) => {
      const instanceMetadata = getPTImageIdInstanceMetadata(imageId)

      // TODO: Temporary fix because static-wado is producing a string, not an array of values
      // (or maybe dcmjs isn't parsing it correctly?)
      // It's showing up like 'DECY\\ATTN\\SCAT\\DTIM\\RAN\\RADL\\DCAL\\SLSENS\\NORM'
      // but calculate-suv expects ['DECY', 'ATTN', ...]
      if (typeof instanceMetadata.CorrectedImage === 'string') {
        instanceMetadata.CorrectedImage = instanceMetadata.CorrectedImage.split('\\')
      }

      if (instanceMetadata) {
        InstanceMetadataArray.push(instanceMetadata)
      }
    })
    if (InstanceMetadataArray.length) {
      try {
        const suvScalingFactors = calculateSUVScalingFactors(InstanceMetadataArray)
        InstanceMetadataArray.forEach((instanceMetadata, index) => {
          ptScalingMetaDataProvider.addInstance(
            imageIds[index],
            suvScalingFactors[index] as unknown as InstanceMetadata
          )
        })
      } catch (error) {
        console.log(error)
      }
    }
  }

  return imageIds
}

// https://github.com/cornerstonejs/cornerstone3D/blob/00e347188b0b57854ddbefdfae220db42c4bf02f/utils/demo/helpers/convertMultiframeImageIds.js
/**
 * Receives a list of imageids possibly referring to multiframe dicom images
 * and returns a list of imageid where each imageid referes to one frame.
 * For each imageId representing a multiframe image with n frames,
 * it will create n new imageids, one for each frame, and returns the new list of imageids
 * If a particular imageid no refer to a mutiframe image data, it will be just copied into the new list
 * @returns new list of imageids where each imageid represents a frame
 */
function convertMultiframeImageIds(imageIds: string[]) {
  const newImageIds: string[] = []
  imageIds.forEach((imageId) => {
    const { imageIdFrameless } = getFrameInformation(imageId)
    const instanceMetaData = metaData.get('multiframeModule', imageId)
    if (
      instanceMetaData &&
      instanceMetaData.NumberOfFrames &&
      instanceMetaData.NumberOfFrames > 1
    ) {
      const NumberOfFrames = instanceMetaData.NumberOfFrames
      for (let i = 0; i < NumberOfFrames; i++) {
        const newImageId = imageIdFrameless + (i + 1)
        newImageIds.push(newImageId)
      }
    } else {
      newImageIds.push(imageId)
    }
  })
  return newImageIds
}

function getFrameInformation(imageId: string) {
  if (imageId.includes('wadors:')) {
    const frameIndex = imageId.indexOf('/frames/')
    const imageIdFrameless = frameIndex > 0 ? imageId.slice(0, frameIndex + 8) : imageId
    return {
      frameIndex,
      imageIdFrameless
    }
  } else {
    const frameIndex = imageId.indexOf('&frame=')
    let imageIdFrameless = frameIndex > 0 ? imageId.slice(0, frameIndex + 7) : imageId
    if (!imageIdFrameless.includes('&frame=')) {
      imageIdFrameless = imageIdFrameless + '&frame='
    }
    return {
      frameIndex,
      imageIdFrameless
    }
  }
}

/**
 * Remove invalid tags from a metadata and return a new object.
 *
 * At this time it is only removing tags that has `null` or `undefined` values
 * which is our main goal because that breaks when `naturalizeDataset(...)` is
 * called.
 *
 * Validating the tag id using regex like /^[a-fA-F0-9]{8}$/ make it run
 * +50% slower and looping through all characteres (split+every+Set or simple
 * FOR+Set) double the time it takes to run. It is currently taking +12ms/1k
 * images on average which can change depending on the machine.
 *
 * @param srcMetadata - source metadata
 * @returns new metadata object without invalid tags
 */
function removeInvalidTags(srcMetadata: WADORSMetaData) {
  // Object.create(null) make it ~9% faster
  const dstMetadata = Object.create(null)
  const tagIds = Object.keys(srcMetadata)
  let tagValue

  tagIds.forEach((tagId) => {
    tagValue = srcMetadata[tagId]

    if (tagValue !== undefined && tagValue !== null) {
      dstMetadata[tagId] = tagValue
    }
  })

  return dstMetadata
}

// See https://github.com/OHIF/Viewers/blob/94a9067fe3d291d30e25a1bda5913511388edea2/platform/core/src/utils/metadataProvider/getPixelSpacingInformation.js
// TODO: fix metadata instance type
function getPixelSpacingInformation(instance: any) {
  // See http://gdcm.sourceforge.net/wiki/index.php/Imager_Pixel_Spacing

  // TODO: Add Ultrasound region spacing
  // TODO: Add manual calibration

  // TODO: Use ENUMS from dcmjs
  const projectionRadiographSOPClassUIDs = [
    '1.2.840.10008.5.1.4.1.1.1', //	CR Image Storage
    '1.2.840.10008.5.1.4.1.1.1.1', //	Digital X-Ray Image Storage – for Presentation
    '1.2.840.10008.5.1.4.1.1.1.1.1', //	Digital X-Ray Image Storage – for Processing
    '1.2.840.10008.5.1.4.1.1.1.2', //	Digital Mammography X-Ray Image Storage – for Presentation
    '1.2.840.10008.5.1.4.1.1.1.2.1', //	Digital Mammography X-Ray Image Storage – for Processing
    '1.2.840.10008.5.1.4.1.1.1.3', //	Digital Intra – oral X-Ray Image Storage – for Presentation
    '1.2.840.10008.5.1.4.1.1.1.3.1', //	Digital Intra – oral X-Ray Image Storage – for Processing
    '1.2.840.10008.5.1.4.1.1.12.1', //	X-Ray Angiographic Image Storage
    '1.2.840.10008.5.1.4.1.1.12.1.1', //	Enhanced XA Image Storage
    '1.2.840.10008.5.1.4.1.1.12.2', //	X-Ray Radiofluoroscopic Image Storage
    '1.2.840.10008.5.1.4.1.1.12.2.1', //	Enhanced XRF Image Storage
    '1.2.840.10008.5.1.4.1.1.12.3' // X-Ray Angiographic Bi-plane Image Storage	Retired
  ]

  const {
    PixelSpacing,
    ImagerPixelSpacing,
    SOPClassUID,
    PixelSpacingCalibrationType,
    PixelSpacingCalibrationDescription,
    EstimatedRadiographicMagnificationFactor,
    SequenceOfUltrasoundRegions
  } = instance

  const isProjection = projectionRadiographSOPClassUIDs.includes(SOPClassUID as unknown as string)

  const TYPES = {
    NOT_APPLICABLE: 'NOT_APPLICABLE',
    UNKNOWN: 'UNKNOWN',
    CALIBRATED: 'CALIBRATED',
    DETECTOR: 'DETECTOR'
  }

  if (!isProjection) {
    return PixelSpacing
  }

  if (isProjection && !ImagerPixelSpacing) {
    // If only Pixel Spacing is present, and this is a projection radiograph,
    // PixelSpacing should be used, but the user should be informed that
    // what it means is unknown
    return {
      PixelSpacing,
      type: TYPES.UNKNOWN,
      isProjection
    }
  } else if (PixelSpacing && ImagerPixelSpacing && PixelSpacing === ImagerPixelSpacing) {
    // If Imager Pixel Spacing and Pixel Spacing are present and they have the same values,
    // then the user should be informed that the measurements are at the detector plane
    return {
      PixelSpacing,
      type: TYPES.DETECTOR,
      isProjection
    }
  } else if (PixelSpacing && ImagerPixelSpacing && PixelSpacing !== ImagerPixelSpacing) {
    // If Imager Pixel Spacing and Pixel Spacing are present and they have different values,
    // then the user should be informed that these are "calibrated"
    // (in some unknown manner if Pixel Spacing Calibration Type and/or
    // Pixel Spacing Calibration Description are absent)
    return {
      PixelSpacing,
      type: TYPES.CALIBRATED,
      isProjection,
      PixelSpacingCalibrationType,
      PixelSpacingCalibrationDescription
    }
  } else if (!PixelSpacing && ImagerPixelSpacing) {
    let CorrectedImagerPixelSpacing = ImagerPixelSpacing
    if (
      EstimatedRadiographicMagnificationFactor &&
      typeof EstimatedRadiographicMagnificationFactor === 'number'
    ) {
      // Note that in IHE Mammo profile compliant displays, the value of Imager Pixel Spacing is required to be corrected by
      // Estimated Radiographic Magnification Factor and the user informed of that.
      // TODO: should this correction be done before all of this logic?
      CorrectedImagerPixelSpacing = ImagerPixelSpacing.map(
        (pixelSpacing: number) => pixelSpacing / EstimatedRadiographicMagnificationFactor
      )
    } else {
      console.warn(
        'EstimatedRadiographicMagnificationFactor was not present. Unable to correct ImagerPixelSpacing.'
      )
    }

    return {
      PixelSpacing: CorrectedImagerPixelSpacing,
      isProjection
    }
  } else if (SequenceOfUltrasoundRegions && typeof SequenceOfUltrasoundRegions === 'object') {
    const { PhysicalDeltaX, PhysicalDeltaY } = SequenceOfUltrasoundRegions
    const USPixelSpacing = [PhysicalDeltaX * 10, PhysicalDeltaY * 10]

    return {
      PixelSpacing: USPixelSpacing
    }
  } else if (
    SequenceOfUltrasoundRegions &&
    Array.isArray(SequenceOfUltrasoundRegions) &&
    SequenceOfUltrasoundRegions.length > 1
  ) {
    console.warn(
      'Sequence of Ultrasound Regions > one entry. This is not yet implemented, all measurements will be shown in pixels.'
    )
  } else if (!isProjection && !ImagerPixelSpacing) {
    // If only Pixel Spacing is present, and this is not a projection radiograph,
    // we can stop here
    return {
      PixelSpacing,
      type: TYPES.NOT_APPLICABLE,
      isProjection
    }
  }

  console.warn(
    'Unknown combination of PixelSpacing and ImagerPixelSpacing identified. Unable to determine spacing.'
  )
}

function getPTImageIdInstanceMetadata(imageId: string): InstanceMetadata {
  const petSequenceModule = metaData.get('petIsotopeModule', imageId)
  const generalSeriesModule = metaData.get('generalSeriesModule', imageId)
  const patientStudyModule = metaData.get('patientStudyModule', imageId)

  const ptSeriesModule = metaData.get('petSeriesModule', imageId)
  const ptImageModule = metaData.get('petImageModule', imageId)

  if (!petSequenceModule) {
    throw new Error('petSequenceModule metadata is required')
  }

  const radiopharmaceuticalInfo = petSequenceModule.radiopharmaceuticalInfo

  const { seriesDate, seriesTime, acquisitionDate, acquisitionTime } = generalSeriesModule
  const { patientWeight } = patientStudyModule
  const { correctedImage, units, decayCorrection } = ptSeriesModule

  if (
    seriesDate === undefined ||
    seriesTime === undefined ||
    patientWeight === undefined ||
    acquisitionDate === undefined ||
    acquisitionTime === undefined ||
    correctedImage === undefined ||
    units === undefined ||
    decayCorrection === undefined ||
    radiopharmaceuticalInfo.radionuclideTotalDose === undefined ||
    radiopharmaceuticalInfo.radionuclideHalfLife === undefined ||
    (radiopharmaceuticalInfo.radiopharmaceuticalStartDateTime === undefined &&
      seriesDate === undefined &&
      radiopharmaceuticalInfo.radiopharmaceuticalStartTime === undefined)
    //
  ) {
    throw new Error('required metadata are missing')
  }

  const instanceMetadata: InstanceMetadata = {
    CorrectedImage: correctedImage,
    Units: units,
    RadionuclideHalfLife: radiopharmaceuticalInfo.radionuclideHalfLife,
    RadionuclideTotalDose: radiopharmaceuticalInfo.radionuclideTotalDose,
    DecayCorrection: decayCorrection,
    PatientWeight: patientWeight,
    SeriesDate: seriesDate,
    SeriesTime: seriesTime,
    AcquisitionDate: acquisitionDate,
    AcquisitionTime: acquisitionTime
  }

  if (
    radiopharmaceuticalInfo.radiopharmaceuticalStartDateTime &&
    radiopharmaceuticalInfo.radiopharmaceuticalStartDateTime !== undefined &&
    typeof radiopharmaceuticalInfo.radiopharmaceuticalStartDateTime === 'string'
  ) {
    instanceMetadata.RadiopharmaceuticalStartDateTime =
      radiopharmaceuticalInfo.radiopharmaceuticalStartDateTime
  }

  if (
    radiopharmaceuticalInfo.radiopharmaceuticalStartDateTime &&
    radiopharmaceuticalInfo.radiopharmaceuticalStartDateTime !== undefined &&
    typeof radiopharmaceuticalInfo.radiopharmaceuticalStartDateTime !== 'string'
  ) {
    const dateString = convertInterfaceDateToString(
      radiopharmaceuticalInfo.radiopharmaceuticalStartDateTime
    )
    instanceMetadata.RadiopharmaceuticalStartDateTime = dateString
  }

  if (
    instanceMetadata.AcquisitionDate &&
    instanceMetadata.AcquisitionDate !== undefined &&
    typeof instanceMetadata.AcquisitionDate !== 'string'
  ) {
    const dateString = convertInterfaceDateToString(instanceMetadata.AcquisitionDate)
    instanceMetadata.AcquisitionDate = dateString
  }

  if (
    instanceMetadata.SeriesDate &&
    instanceMetadata.SeriesDate !== undefined &&
    typeof instanceMetadata.SeriesDate !== 'string'
  ) {
    const dateString = convertInterfaceDateToString(instanceMetadata.SeriesDate)
    instanceMetadata.SeriesDate = dateString
  }

  if (
    radiopharmaceuticalInfo.radiopharmaceuticalStartTime &&
    radiopharmaceuticalInfo.radiopharmaceuticalStartTime !== undefined &&
    typeof radiopharmaceuticalInfo.radiopharmaceuticalStartTime === 'string'
  ) {
    instanceMetadata.RadiopharmaceuticalStartTime =
      radiopharmaceuticalInfo.radiopharmaceuticalStartTime
  }

  if (
    radiopharmaceuticalInfo.radiopharmaceuticalStartTime &&
    radiopharmaceuticalInfo.radiopharmaceuticalStartTime !== undefined &&
    typeof radiopharmaceuticalInfo.radiopharmaceuticalStartTime !== 'string'
  ) {
    const timeString = convertInterfaceTimeToString(
      radiopharmaceuticalInfo.radiopharmaceuticalStartTime
    )
    instanceMetadata.RadiopharmaceuticalStartTime = timeString
  }

  if (
    instanceMetadata.AcquisitionTime &&
    instanceMetadata.AcquisitionTime !== undefined &&
    typeof instanceMetadata.AcquisitionTime !== 'string'
  ) {
    const timeString = convertInterfaceTimeToString(instanceMetadata.AcquisitionTime)
    instanceMetadata.AcquisitionTime = timeString
  }

  if (
    instanceMetadata.SeriesTime &&
    instanceMetadata.SeriesTime !== undefined &&
    typeof instanceMetadata.SeriesTime !== 'string'
  ) {
    const timeString = convertInterfaceTimeToString(instanceMetadata.SeriesTime)
    instanceMetadata.SeriesTime = timeString
  }

  if (ptImageModule.frameReferenceTime && ptImageModule.frameReferenceTime !== undefined) {
    instanceMetadata.FrameReferenceTime = ptImageModule.frameReferenceTime
  }

  if (ptImageModule.actualFrameDuration && ptImageModule.actualFrameDuration !== undefined) {
    instanceMetadata.ActualFrameDuration = ptImageModule.actualFrameDuration
  }

  if (patientStudyModule.patientSex && patientStudyModule.patientSex !== undefined) {
    instanceMetadata.PatientSex = patientStudyModule.patientSex
  }

  if (patientStudyModule.patientSize && patientStudyModule.patientSize !== undefined) {
    instanceMetadata.PatientSize = patientStudyModule.patientSize
  }

  // Todo: add private tags
  // if (
  //   dicomMetaData['70531000'] ||
  //   dicomMetaData['70531000'] !== undefined ||
  //   dicomMetaData['70531009'] ||
  //   dicomMetaData['70531009'] !== undefined
  // ) {
  //   const philipsPETPrivateGroup: PhilipsPETPrivateGroup = {
  //     SUVScaleFactor: dicomMetaData['70531000'],
  //     ActivityConcentrationScaleFactor: dicomMetaData['70531009'],
  //   };
  //   instanceMetadata.PhilipsPETPrivateGroup = philipsPETPrivateGroup;
  // }

  // if (dicomMetaData['0009100d'] && dicomMetaData['0009100d'] !== undefined) {
  //   instanceMetadata.GEPrivatePostInjectionDateTime = dicomMetaData['0009100d'];
  // }

  return instanceMetadata
}

function convertInterfaceTimeToString(time: {
  hours: string
  minutes: string
  seconds: string
  fractionalSeconds: string
}): string {
  const hours = `${time.hours || '00'}`.padStart(2, '0')
  const minutes = `${time.minutes || '00'}`.padStart(2, '0')
  const seconds = `${time.seconds || '00'}`.padStart(2, '0')

  const fractionalSeconds = `${time.fractionalSeconds || '000000'}`.padEnd(6, '0')

  const timeString = `${hours}${minutes}${seconds}.${fractionalSeconds}`
  return timeString
}

function convertInterfaceDateToString(date: { month: string; day: string; year: string }): string {
  const month = `${date.month}`.padStart(2, '0')
  const day = `${date.day}`.padStart(2, '0')
  const dateString = `${date.year}${month}${day}`
  return dateString
}

const scalingPerImageId: Record<string, InstanceMetadata> = {}

function addInstance(imageId: string, scalingMetaData: InstanceMetadata) {
  const imageURI = csUtils.imageIdToURI(imageId)
  scalingPerImageId[imageURI] = scalingMetaData
}

function get(type: string, imageId: string) {
  if (type === 'scalingModule') {
    const imageURI = csUtils.imageIdToURI(imageId)
    return scalingPerImageId[imageURI]
  }
}
