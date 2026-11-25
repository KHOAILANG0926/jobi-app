import { updateApplicationStatus, type JobApplication } from './applicationsStorage'
import { scheduleInterview } from './interviewStorage'

// 면접 일정 잡기 = 일정 저장 + 지원 상태를 'interview'로 — 웹 ScheduleInterviewModal에 있던 순서를 그대로 옮긴 공용 함수(동작 변경 없음).
// 웹 모달과 앱 면접 시트가 같은 코드로 일정을 만든다. 실패하면 예외를 던진다(호출하는 쪽이 오류 표시).
export async function scheduleInterviewForApplication(
  app: JobApplication,
  employerId: string,
  slot: { date: string; time: string; location: string; notes: string },
): Promise<void> {
  await scheduleInterview({
    jobId: app.jobId,
    jobTitle: app.jobTitle,
    company: app.company,
    seekerId: app.seekerId ?? '',
    seekerName: app.seekerName,
    employerId,
    datetime: `${slot.date}T${slot.time}:00`,
    location: slot.location.trim(),
    notes: slot.notes.trim(),
    status: 'pending',
  })
  if (!app.id) throw new Error('Application id is required to schedule an interview')
  const statusUpdated = await updateApplicationStatus(app.id, 'interview')
  if (!statusUpdated) throw new Error('Application status update failed')
}
