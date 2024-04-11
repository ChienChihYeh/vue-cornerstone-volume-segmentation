import * as cornerstoneTools from '@cornerstonejs/tools'
import { toolGroupId } from '@/constants/cornerstoneIds'
import addManipulationBindings from './addManipulationBindings'
import labelmapTools from './labelmapTools'

const {
  // ZoomTool,
  BrushTool,
  SegmentationDisplayTool,
  // StackScrollMouseWheelTool,
  ToolGroupManager
} = cornerstoneTools

export function initToolGroup() {
  // cornerstoneTools.addTool(ZoomTool)
  cornerstoneTools.addTool(BrushTool)
  cornerstoneTools.addTool(SegmentationDisplayTool)
  cornerstoneTools.addTool(cornerstoneTools.PaintFillTool)
  // cornerstoneTools.addTool(StackScrollMouseWheelTool)

  const toolGroup = ToolGroupManager.createToolGroup(toolGroupId)

  // toolGroup?.addTool(ZoomTool.toolName)
  toolGroup?.addTool(BrushTool.toolName)
  // toolGroup?.addTool(StackScrollMouseWheelTool.toolName)
  toolGroup?.addTool(SegmentationDisplayTool.toolName)

  // toolGroup?.setToolActive(StackScrollMouseWheelTool.toolName)
  // toolGroup?.setToolActive(BrushTool.toolName, { bindings: [{ mouseButton: 1 }] })
  // toolGroup?.setToolActive(ZoomTool.toolName, { bindings: [{ mouseButton: 2 }] })
  if (toolGroup) addManipulationBindings(toolGroup, { toolMap: labelmapTools.toolMap })
  toolGroup?.setToolActive(SegmentationDisplayTool.toolName)
}
