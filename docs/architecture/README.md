# 웹·앱·크롤링 구조와 작업 영역 (2026-11-25 구조 정리)

대표 지시(2026-11-25): 웹과 앱을 둘 다 독립적으로 운영·발전시키되, 지금은 GitHub·Vercel·Supabase와 공통 처리 시스템을 함께 쓴다.
물리적 서버·DB 분리, 엔진 복제, 대규모 파일 이동은 하지 않고, 나중에 각각 독립 운영할 수 있는 **구조적 기반**만 마련한다.
이 문서는 그 기준이며, 코드가 기준이다 — 규칙은 시험이 지키고 이 문서는 읽는 사람을 돕는다.

## 1. 구조도

```
            ┌──────────── 계약: DB(테이블·RPC·RLS) · src/types ────────────┐
            │                                                              │
  엔진(순수 TS)                  공통 클라이언트 계층                  화면
  src/lib 중 서버·Node가 쓰는 것   src/lib(*Storage 등)·src/context      웹: src/pages · src/components · index.css
  (주소·회사·급여 읽기, 위치 확인,   · 환경 어댑터 kvStore · eventBus       앱: src/app · app.html · app.css
   공고 검사…)  ← 브라우저·React 금지 ← browserEnv가 브라우저와 연결
            │                          │
   서버: api/ · crawler/ · scripts/   (서버는 엔진만 사용)
```

- **엔진**: 서버 함수(`api/`)와 Node 도구(`scripts/`·`ops/`)가 끌어오는 `src` 코드. React·브라우저 전역·브라우저 Supabase 클라이언트·화면 코드를 만지지 않는다(`src/archtest/layers.test.ts` R1·R2).
- **공통 클라이언트 계층**: 웹과 앱이 함께 쓰는 데이터 접근·계산. 브라우저 저장소·window 이벤트는 `src/lib/kvStore.ts`·`src/lib/eventBus.ts` 인터페이스를 거치고, 브라우저와의 연결은 `src/lib/browserEnv.ts` 한 곳이다(R6). 웹·앱 입구(`src/main.tsx`·`src/app/main.tsx`) 첫 줄이 어댑터를 끼운다.
- **화면**: 웹과 앱은 서로 가져오지 않는다. 앱은 웹 화면 코드(`src/pages`·지도 외 `src/components`·`index.css`)를 쓰지 않고, 웹은 `src/app`을 쓰지 않는다(`src/app/boundary.test.ts`).
- **아래 계층은 화면을 가져오지 않는다**: `src/lib`·`data`·`types`·`context`는 `components`·`pages`·`app`을 가져오지 않는다(R3·R4), `src/types`는 값을 가져오지 않는다(R5).
- 파일별 역할 스냅샷: [`lib-roles.md`](./lib-roles.md)(생성 스크립트 `scripts/arch/lib-roles.mjs`, 시험은 표가 아니라 규칙을 지킨다).

## 2. 작업 영역과 담당

| 영역 | 경로 | 담당 작업 창 | 수정할 때 돌릴 검사 |
|---|---|---|---|
| 크롤링·데이터 처리 | `crawler/`·`scripts/`·데이터 쪽 `supabase/`·엔진 파일 | 크롤링 창 | 해당 시험 + 공통이면 아래 공통 |
| 웹 전용 | `src/pages`·`src/components`·`src/index.css`·`index.html` | 웹 창 | `npm run test:web`·`npm run typecheck:web` |
| 앱 전용 | `src/app`·`app.html`·`vite.app.config.mjs` | 앱 창 | `npm run test:app`·`npm run typecheck:app`·`npm run build:app` |
| 공통(웹·앱·서버가 함께) | `src/lib`·`src/context`·`src/data`·`src/types`·`api/` | 영향 범위를 확인한 창 | `npm test`(전부) + 웹·앱 화면 검사 |
| DB·인증·권한 | `supabase/`·RLS | 기존 승인 체계 | 기존 절차(STRICT) 그대로 |
| 빌드·배포·검사 | 워크플로·`vite.config.ts`·`package.json`·`tsconfig*` | 구조 정리(대표 승인) | 기존 필수 검사 그대로 |

`npm run test:changed`는 바뀐 파일로 범위를 정한다 — 앱·웹 전용 파일만 바뀌면 그 범위, 공통·미분류가 하나라도 있으면 전부(`src/archtest/testScopes.ts`). 필수 CI는 이 선택을 쓰지 않고 전부 돌린다.

## 3. 공통 코드를 고칠 때 (책임과 절차)
1. 공통 파일(`src/lib`·`context`·`data`·`types`·`api`)은 **작은 PR**로 나눠 바꾼다. 웹·앱 양쪽에 영향이 있다고 보고 PR 본문 「작업 범위」에 영향(웹/앱/서버)을 적는다.
2. 올리기 전에 같은 파일을 고치는 열린 PR과 최근 병합 PR을 직접 확인한다(`check-pr-ready`가 강제). 같은 공통 파일을 두 창이 동시에 고치지 않고, 필요하면 먼저 병합되는 쪽을 정한다.
3. 같은 문제를 웹과 앱에서 각각 고치지 않는다 — 공통 함수(예: `lib/jobDetailDerive.ts`)에 먼저 둔다.
4. 승인된 화면 틀 파일(`src/pages/JobDetail.tsx` 등, `scripts/test-desktop-baseline.mjs`가 해시로 잠금)은 화면 결과가 같더라도 대표 수동 Approve가 필요하다.
5. 브라우저 저장소·window 이벤트가 필요하면 `kvLocal`/`kvSession`·`emitEvent`/`onEvent`를 쓰고, 직접 쓰지 않는다. 네이티브 전환 때는 어댑터에 다른 구현을 끼우면 된다(`installKvStores`·`installEventBus`).

## 4. 알려진 빚 (새로 늘리지 않는다)
`src/archtest/layers.test.ts`의 KNOWN 목록이 기준이다. 이유와 함께 적혀 있고, 고치면 그 줄을 지운다. 새 위반은 시험이 막는다.

## 5. 향후 독립 운영(물리 분리)이 필요해질 때의 순서
계기(팀원 추가, 앱 전용 도메인·배포 주기 분리, 네이티브 앱 전환, 트래픽 분리)가 생기면 아래 순서로 한다. 지금은 하지 않는다.
1. **엔진 추출**: 위 규칙으로 순수가 보장된 엔진 파일을 `packages/core`(npm workspace)로 옮긴다 — import 경로 변경만이고 `lib-roles.md`가 대상 목록이다.
2. **공통 클라이언트 추출**: `*Storage` 계열과 환경 어댑터를 `packages/client`로. 환경 어댑터 덕분에 브라우저·네이티브를 갈아끼울 수 있다.
3. **빌드·배포 분리**: 앱은 이미 `vite.app.config.mjs`로 단독 빌드되고 `tsconfig.app.json`으로 단독 타입 검사된다. 배포를 나눌 때는 앱용 Vercel 프로젝트와 `app.html` 입구만 옮긴다.
4. **DB·서버 분리는 마지막**: DB 계약(테이블·RPC·RLS)이 웹·앱의 공통 계약이므로 클라이언트가 독립된 뒤 필요할 때 판단한다.
