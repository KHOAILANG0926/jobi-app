# src/lib 역할 분류표 (스냅샷)

생성: `node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs scripts/arch/lib-roles.mjs > docs/architecture/lib-roles.md`
실제 import 그래프에서 읽은 값이며 손으로 고치지 않는다. 시험이 지키는 것은 표가 아니라 규칙(`src/archtest/layers.test.ts`)이다.

## 규칙 요약
- R1·R2: 서버 함수(`api/`)와 Node 도구(`scripts/`·`ops/`)가 끌어오는 `src` 코드는 React·브라우저 전역·브라우저 Supabase 클라이언트·화면 코드·css를 만지면 안 된다(알려진 빚만 `layers.test.ts`의 KNOWN에 이유와 함께 허용).
- R3·R4: `src/lib`·`data`·`types`·`context`는 화면 코드(`components`·`pages`·`app`)를 가져오지 않는다(타입 포함, 알려진 1건).
- R5: `src/types`는 값을 가져오지 않는다.
- 앱↔웹: 앱은 웹 화면 코드를 가져오지 않고 웹은 `src/app`을 가져오지 않는다(`src/app/boundary.test.ts`).

## 합계 (src/lib 파일 130개)
- 엔진(서버·Node에서 쓰임, 순수): 50개
- 순수(서버 사용 증거 없음): 40개
- 간접 의존(끌어오는 파일이 브라우저 의존): 12개
- 브라우저 의존(저장·이벤트·React): 14개
- 데이터 접근(브라우저 Supabase 직접): 14개
- 웹과 앱이 함께 쓰는 파일: 69개 · 웹만: 23개 · 앱만: 0개 · 서버(api)가 쓰는 파일: 32개

## 엔진(서버·Node에서 쓰임, 순수) — 50개

| 파일 | 쓰는 곳 | 비고 |
|---|---|---|
| `addressParse.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `addressReader.ts` | 서버(api)·Node 도구 |  |
| `administrativeArea.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `aiClassifyGuard.ts` | Node 도구 |  |
| `benefitWords.ts` | Node 도구 |  |
| `brandLogo.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `brandRows.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `businessType.ts` | Node 도구 |  |
| `cardPhoto.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `companyLogo.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `companyPlaceSearch.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `companyReader.ts` | 서버(api)·Node 도구 |  |
| `directionsPlan.ts` | 웹·앱·Node 도구 |  |
| `fushanSource.fixture.ts` | Node 도구 |  |
| `goongLocate.ts` | 서버(api)·Node 도구 |  |
| `industrialPark.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `inspectReading.ts` | Node 도구 |  |
| `jobArea.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `jobCoords.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `jobDescriptionBuild.ts` | Node 도구 |  |
| `jobDescriptionExtract.ts` | Node 도구 |  |
| `jobDetailFill.ts` | Node 도구 |  |
| `jobDetailSections.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `jobDetailView.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `jobIdentity.ts` | 서버(api)·Node 도구 |  |
| `jobInspect.ts` | Node 도구 |  |
| `jobMultiRole.fixtures.ts` | Node 도구 |  |
| `jobPostingPolicy.mjs` | 웹·앱·Node 도구 |  |
| `jobQuyenLoi.ts` | 웹·앱·Node 도구 |  |
| `jobRepair.ts` | Node 도구 |  |
| `jobRolePresentation.ts` | 웹·앱·Node 도구 |  |
| `locationCandidateMatch.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `locationLevel.ts` | 서버(api) |  |
| `locationPrecheck.ts` | 서버(api)·Node 도구 |  |
| `locationReviewClue.ts` | 서버(api) |  |
| `logoLookup.ts` | 서버(api)·Node 도구 |  |
| `mealBenefit.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `occupationGroups.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `parkLocate.ts` | Node 도구 |  |
| `r2Areas.fixtures.ts` | Node 도구 |  |
| `r2Oracle.fixtures.ts` | Node 도구 |  |
| `realJobs.fixtures.ts` | Node 도구 |  |
| `regionKeywords.ts` | Node 도구 |  |
| `salaryReader.ts` | Node 도구 |  |
| `screenAudit.ts` | Node 도구 |  |
| `shopKinds.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `sourceSalary.ts` | Node 도구 |  |
| `sourceTag.ts` | 웹·앱·Node 도구 |  |
| `supabase.ts` | 웹·앱·서버(api)·Node 도구 |  |
| `supabaseServer.ts` | 웹·Node 도구 |  |

## 순수(서버 사용 증거 없음) — 40개

| 파일 | 쓰는 곳 | 비고 |
|---|---|---|
| `adminJobDraft.ts` | 웹 |  |
| `albamonTemplate.ts` | 웹 |  |
| `authStorage.ts` | (가져오는 곳 없음) |  |
| `benefitIconArt.ts` | 웹 |  |
| `brandCandidates.ts` | 웹 |  |
| `cardText.ts` | 웹·앱 |  |
| `categoryVisuals.ts` | (가져오는 곳 없음) |  |
| `companyBranch.ts` | 웹·앱 |  |
| `conditionLines.ts` | 웹·앱 |  |
| `cvPdf.ts` | 웹 |  |
| `detailRich.ts` | 웹·앱 |  |
| `fitPins.ts` | 웹 |  |
| `homeDiscovery.ts` | 웹·앱 |  |
| `inViewOnce.ts` | 웹 |  |
| `jobAreaWards.ts` | 웹·앱 |  |
| `jobConditions.ts` | 웹·앱 |  |
| `jobCriteria.mjs` | (가져오는 곳 없음) |  |
| `jobDescriptionBuild.fixtures.ts` | (가져오는 곳 없음) |  |
| `jobId.ts` | 웹·앱 |  |
| `jobListFilter.ts` | 웹·앱 |  |
| `jobPolicyWrite.ts` | 웹·앱 |  |
| `jobQualityFilter.ts` | 웹·앱 |  |
| `jobRecruitmentSummary.ts` | 웹·앱 |  |
| `jobSuggestions.ts` | 웹·앱 |  |
| `jobUtils.ts` | 웹·앱 |  |
| `koreaJobFormat.ts` | 웹 |  |
| `mainJobCards.ts` | 웹·앱 |  |
| `mapPlace.ts` | 웹·앱 |  |
| `mapPushPin.ts` | 웹·앱 |  |
| `nearbyFacilities.ts` | 웹·앱 |  |
| `postJobForm.ts` | 웹·앱 |  |
| `postJobPreview.ts` | 웹 |  |
| `r2Industry.fixtures.ts` | (가져오는 곳 없음) |  |
| `recruitColumns.ts` | 웹·앱 |  |
| `representativeSearchPages.ts` | 웹 |  |
| `shortArea.ts` | 웹·앱 |  |
| `sourceRecruitmentRoles.ts` | 웹·앱 |  |
| `templateHtml.ts` | 웹 |  |
| `wardArea.ts` | (가져오는 곳 없음) |  |
| `workScheduleParse.ts` | 웹·앱 |  |

## 간접 의존(끌어오는 파일이 브라우저 의존) — 12개

| 파일 | 쓰는 곳 | 비고 |
|---|---|---|
| `addressLocate.ts` | 서버(api)·Node 도구 | 끌어옴: lib/adminVietmapClient.ts |
| `applySubmit.ts` | 웹·앱 | 끌어옴: lib/accountCvStorage.ts, lib/applicationsStorage.ts |
| `autoLocationResolver.ts` | 서버(api)·Node 도구 | 끌어옴: lib/adminVietmapClient.ts, lib/recommendStorage.ts |
| `chototAutoLocate.ts` | 서버(api)·Node 도구 | 끌어옴: lib/adminVietmapClient.ts |
| `cvAccountSync.ts` | 웹·앱 | 끌어옴: lib/accountCvStorage.ts, lib/cvStorage.ts |
| `fetchJobsData.ts` | 웹·앱 | 끌어옴: lib/jobRows.ts |
| `homeMapFilters.ts` | 웹·앱·서버(api)·Node 도구 | 끌어옴: lib/recommendStorage.ts |
| `homeMapSearch.ts` | 웹·Node 도구 | 끌어옴: lib/recommendStorage.ts |
| `interviewSchedule.ts` | 웹·앱 | 끌어옴: lib/applicationsStorage.ts, lib/interviewStorage.ts |
| `jobSearch.ts` | 웹·앱 | 끌어옴: lib/recommendStorage.ts |
| `mapR1.ts` | 웹·앱·서버(api)·Node 도구 | 끌어옴: lib/recommendStorage.ts |
| `wardLocate.ts` | (가져오는 곳 없음) | 끌어옴: lib/adminVietmapClient.ts |

## 브라우저 의존(저장·이벤트·React) — 14개

| 파일 | 쓰는 곳 | 비고 |
|---|---|---|
| `accountMigrationStorage.ts` | 웹 | 브라우저 전역(window·document·localStorage 등) |
| `cvCompleteness.ts` | 웹 | 브라우저 전역(window·document·localStorage 등) |
| `cvStorage.ts` | 웹·앱 | 브라우저 전역(window·document·localStorage 등) |
| `geoapify.ts` | 웹 | 브라우저 전역(window·document·localStorage 등) |
| `imageResize.ts` | 웹·앱 | 브라우저 전역(window·document·localStorage 등) |
| `jobsListView.ts` | 웹 | 브라우저 전역(window·document·localStorage 등) |
| `notificationsStorage.ts` | 웹·앱 | 브라우저 전역(window·document·localStorage 등) |
| `recommendStorage.ts` | 웹·앱·서버(api)·Node 도구 | 브라우저 전역(window·document·localStorage 등) |
| `reviewsStorage.ts` | 웹 | 브라우저 전역(window·document·localStorage 등) |
| `storage.ts` | 웹·앱 | 브라우저 전역(window·document·localStorage 등) |
| `todayVnStore.ts` | 웹·앱 | react, 브라우저 전역(window·document·localStorage 등) |
| `useMobileLayout.ts` | 웹 | react, 브라우저 전역(window·document·localStorage 등) |
| `userLocation.ts` | 웹 | 브라우저 전역(window·document·localStorage 등) |
| `viewHistoryStorage.ts` | 웹·앱 | 브라우저 전역(window·document·localStorage 등) |

## 데이터 접근(브라우저 Supabase 직접) — 14개

| 파일 | 쓰는 곳 | 비고 |
|---|---|---|
| `accountCvStorage.ts` | 웹·앱 | 브라우저 전역(window·document·localStorage 등), 브라우저 Supabase 클라이언트(src/lib/supabase.ts) |
| `accountProfileStorage.ts` | 웹 | 브라우저 Supabase 클라이언트(src/lib/supabase.ts) |
| `accountRoles.ts` | 웹·앱 | 브라우저 Supabase 클라이언트(src/lib/supabase.ts) |
| `adminOperations.ts` | 웹·앱 | 브라우저 Supabase 클라이언트(src/lib/supabase.ts) |
| `adminVietmapClient.ts` | 서버(api)·Node 도구 | 브라우저 Supabase 클라이언트(src/lib/supabase.ts) |
| `applicationsStorage.ts` | 웹·앱 | 브라우저 전역(window·document·localStorage 등), 브라우저 Supabase 클라이언트(src/lib/supabase.ts) |
| `communityStorage.ts` | 웹·앱 | 브라우저 Supabase 클라이언트(src/lib/supabase.ts) |
| `interviewStorage.ts` | 웹·앱 | 브라우저 전역(window·document·localStorage 등), 브라우저 Supabase 클라이언트(src/lib/supabase.ts) |
| `jobAlerts.ts` | 웹·앱 | 브라우저 Supabase 클라이언트(src/lib/supabase.ts) |
| `jobRows.ts` | 웹·앱 | 브라우저 Supabase 클라이언트(src/lib/supabase.ts) |
| `koreaJobsApi.ts` | 웹 | 브라우저 Supabase 클라이언트(src/lib/supabase.ts) |
| `messagesStorage.ts` | 웹·앱 | 브라우저 전역(window·document·localStorage 등), 브라우저 Supabase 클라이언트(src/lib/supabase.ts) |
| `occupations.ts` | 웹 | react, 브라우저 Supabase 클라이언트(src/lib/supabase.ts) |
| `postJobSubmit.ts` | 웹·앱 | 브라우저 Supabase 클라이언트(src/lib/supabase.ts) |

