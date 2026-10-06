import { sheetDragResult } from './mobileSheetGesture.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }

assert(sheetDragResult(2, false) === 'toggle' && sheetDragResult(-3, true) === 'toggle', 'tapping the handle toggles collapsed/expanded')
assert(sheetDragResult(-80, false) === 'expand', 'dragging up from collapsed expands')
assert(sheetDragResult(-80, true) === 'stay', 'dragging up when expanded stays expanded')
assert(sheetDragResult(80, true) === 'collapse', 'dragging down from expanded collapses')
assert(sheetDragResult(80, false) === 'close', 'dragging down from collapsed closes')
assert(sheetDragResult(20, false) === 'stay' && sheetDragResult(-20, true) === 'stay', 'small drags snap back without changing state')

console.log('mobileSheetGesture.test.ts: bottom sheet handle assertions passed')
