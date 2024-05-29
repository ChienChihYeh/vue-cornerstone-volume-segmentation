declare module 'dcmjs' {
  import type { WADORSMetaData } from './WADORSMetaData'
  import cornerstone from '@cornerstonejs/core'
  type Dcmjs = {
    data: {
      Colors: cornerstone.Types.Colors
      DicomMetaDictionary: {
        naturalizeDataset: (dataset: WADORSMetaData) => WADORSMetaData
      }
    }
  }

  const dcmjs: Dcmjs
  export default dcmjs
}
