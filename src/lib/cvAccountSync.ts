import { deleteCvPhoto, loadAccountCv, loadCvPhoto, saveAccountCv, uploadCvPhoto } from './accountCvStorage'
import { saveCv, type CvData } from './cvStorage'

// 계정 CV의 읽기·저장 순서 — 웹 CvBuilder에 있던 것을 그대로 옮긴 공용 함수(동작 변경 없음). 웹 CV 화면과 앱 CV 화면이 같은 코드로 읽고 쓴다.

/** 계정에서 CV를 읽고(사진 포함) 이 기기에도 저장한다. 계정에 CV가 없으면 null. */
export async function loadHydratedAccountCv(userId: string): Promise<{ cv: CvData; photoPath: string | null } | null> {
  const remote = await loadAccountCv(userId)
  if (!remote) return null
  const photoDataUrl = remote.photoPath ? await loadCvPhoto(userId, remote.photoPath) : null
  const hydrated = { ...remote.cv, profilePhotoDataUrl: photoDataUrl }
  saveCv(hydrated, userId)
  return { cv: hydrated, photoPath: remote.photoPath }
}

/** 계정에 CV(사진 업로드 포함)를 저장하고 이 기기 사본도 갱신한다. 사진을 지웠으면 이전 사진 파일도 지운다. 새 사진 경로를 돌려준다. */
export async function saveAccountCvWithPhoto(userId: string, data: CvData, previousPhotoPath: string | null): Promise<string | null> {
  const nextPhotoPath = data.profilePhotoDataUrl ? await uploadCvPhoto(userId, data.profilePhotoDataUrl) : null
  await saveAccountCv(userId, data, nextPhotoPath)
  if (!nextPhotoPath && previousPhotoPath) deleteCvPhoto(userId, previousPhotoPath).catch(() => undefined)
  saveCv(data, userId)
  return nextPhotoPath
}
