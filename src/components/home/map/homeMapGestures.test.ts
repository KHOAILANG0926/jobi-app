import {
  HOME_MAP_GESTURE_OPTIONS, POI_ICON_RADIUS_PX, POI_TAP_TOLERANCE_PX, TOUCH_DEVICE_QUERY,
  applyTouchMapDefaults, withinPoiIcon,
} from './homeMapGestures.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }

// Desktop and mobile: SDK default map gestures (wheel/drag on desktop, one-finger pan + pinch on touch).
assert(HOME_MAP_GESTURE_OPTIONS.cooperativeGestures === false, 'no cooperativeGestures: no Ctrl requirement, one finger moves the map')
assert(TOUCH_DEVICE_QUERY.includes('hover: none') && TOUCH_DEVICE_QUERY.includes('pointer: coarse'), 'touch-only defaults never apply to mouse devices')

// Touch defaults only turn off rotation/pitch (no compass to reset); pan and pinch stay SDK defaults.
const calls: string[] = []
applyTouchMapDefaults({ touchZoomRotate: { disableRotation: () => calls.push('rotation-off') }, touchPitch: { disable: () => calls.push('pitch-off') } })
assert(calls.join(',') === 'rotation-off,pitch-off', 'touch: rotation and pitch off, nothing else changed')

// POI taps: outside the icon/label box only a tap close to the icon centre counts.
assert(POI_TAP_TOLERANCE_PX.mouse < POI_TAP_TOLERANCE_PX.touch && POI_TAP_TOLERANCE_PX.touch <= 6, 'small tolerance, larger for fingers')
assert(withinPoiIcon(POI_ICON_RADIUS_PX + POI_TAP_TOLERANCE_PX.touch, POI_TAP_TOLERANCE_PX.touch), 'touch at icon edge + tolerance selects')
assert(!withinPoiIcon(POI_ICON_RADIUS_PX + POI_TAP_TOLERANCE_PX.touch + 1, POI_TAP_TOLERANCE_PX.touch), 'empty space beyond the tolerance does not select')
assert(!withinPoiIcon(POI_ICON_RADIUS_PX + 3, POI_TAP_TOLERANCE_PX.mouse), 'mouse tolerance is tighter than the old 8px box')

console.log('homeMapGestures.test.ts: map gesture assertions passed')
