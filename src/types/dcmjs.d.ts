declare module 'dcmjs' {
  import type { WADORSMetaData } from './WADORSMetaData'
  type Dcmjs = {
    data: {
      Colors: any
      DicomMetaDictionary: {
        naturalizeDataset: (dataset: WADORSMetaData) => WADORSMetaData
      }
    }
  }

  const dcmjs: Dcmjs
  export default dcmjs
}
