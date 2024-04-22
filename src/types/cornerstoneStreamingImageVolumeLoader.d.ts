import type { Types } from '@cornerstonejs/core'
import StreamingImageVolume from './StreamingImageVolume'
interface IVolumeLoader {
  promise: Promise<StreamingImageVolume>
  cancel: () => void
  decache: () => void
}

type Options = {
  imageIds: string[]
  progressiveRendering?: boolean | Types.IRetrieveConfiguration
}

declare function cornerstoneStreamingImageVolumeLoader(
  volumeId: string,
  options: Options | Record<string, any> | undefined
): IVolumeLoader
export default cornerstoneStreamingImageVolumeLoader
