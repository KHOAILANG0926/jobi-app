declare const fixtures: Array<{
  id: string
  input: { title: string; company: string; description: string; salary: string; category: string }
  expected: 'allow' | 'exclude' | 'review'
}>
export default fixtures
