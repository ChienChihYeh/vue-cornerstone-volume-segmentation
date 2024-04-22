import type { Types } from '@cornerstonejs/core'
import { StreamingImageVolume } from '@cornerstonejs/streaming-image-volume-loader'
// import StreamingImageVolume from './StreamingImageVolume'
interface IVolumeLoader {
  promise: Promise<StreamingImageVolume>
  cancel: () => void
  decache: () => void
}

type Options = {
  imageIds: string[]
  progressiveRendering?: boolean | Types.IRetrieveConfiguration
}

export type StreamImageLoader = (
  volumeId: string,
  options: Options | Record<string, any> | undefined
) => IVolumeLoader
