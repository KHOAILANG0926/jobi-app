import { HOME_MAP_GESTURE_OPTIONS } from './homeMapGestures.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }

assert(HOME_MAP_GESTURE_OPTIONS.cooperativeGestures === true, 'page scroll wins over the map: wheel / one-finger swipe scroll the page')
for (const key of ['WindowsHelpText', 'MacHelpText', 'MobileHelpText'] as const) {
  const text = HOME_MAP_GESTURE_OPTIONS.locale[`CooperativeGesturesHandler.${key}`]
  assert(typeof text === 'string' && text.length > 10 && !/scroll to zoom|two fingers/i.test(text), `${key} is localized (Vietnamese)`)
}

console.log('homeMapGestures.test.ts: cooperative gesture assertions passed')
