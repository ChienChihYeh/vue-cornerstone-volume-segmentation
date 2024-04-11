// TODO: fix metadata instance type

export interface WADORSMetaDataElement<
  ValueType = string[] | number[] | boolean | string | number
> {
  map(
    arg0: (pixelSpacing: number) => number
  ): WADORSMetaDataElement<boolean | string[] | number[] | string | number>
  Value: ValueType
}

export type WADORSMetaData = Record<string, WADORSMetaDataElement>
