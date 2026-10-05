import { SHARED_JOB_POPUP_OPTIONS } from './sharedJobPopupOptions.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

assert(
  JSON.stringify(SHARED_JOB_POPUP_OPTIONS) === JSON.stringify({ offset: 24, closeOnClick: false, focusAfterOpen: false }),
  'shared job popup does not focus the first unselected job',
)

console.log('sharedJobPopupOptions.test.ts: popup option assertions passed')
