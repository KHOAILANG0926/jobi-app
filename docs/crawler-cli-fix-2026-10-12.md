# PR48 크롤러 인자 정합화 (2026-10-12 VN)
[직접 확인] master `9157ced522d024b2c378958f623beffbdfeb1aba`; 시작 PR48 head `a63df724dd278c8b31dccc113cdff137a619bba0`. 같은 codex/job-posting-policy 브랜치, Draft 유지. AGENTS/CLAUDE/HANDOFF 조회 완료. 기존 정책 저장 검사 보존, PR47 병합하지 않고 필요한 CLI 관련 변경만 재사용했다.
[직접 확인] 수정 전 crawl.yml:27과 run_daily.sh:47은 인자 없이 호출하지만 crawler/crawl_topcv.py:2652부터 confirm-full-crawl 없으면 SystemExit. 아래 원문 참조.

## 실제 자동 수집 실행 기록
[직접 확인] GET actions/runs?per_page=100&page=1,2,3(총221개 범위)를 조회해 crawl.yml 최근 실행을 대조했다.
[직접 확인] 최신 [run33221622201](https://github.com/KHOAILANG0926/jobi-app/actions/runs/33221622201), schedule, 2026-08-28T23:48:42Z(08-29 06:48VN), sha6135a4b3b96e239b1a48ce239e58129d4c862977: job99016661577 의존성 설치 failure, 크롤링 실행 skipped. 로그:
```
Package libasound2 is a virtual package provided by:
  libasound2t64 1.2.11-1ubuntu0.3
E: Package 'libasound2' has no installation candidate
Error: Installation process exited with code: 100
Process completed with exit code 1.
```
[직접 확인] 직전 [run33128901992](https://github.com/KHOAILANG0926/jobi-app/actions/runs/33128901992), schedule, 2026-08-28T00:11:20Z(08-28 07:11VN), job98713540416도 설치 exit100·크롤링 skipped.
[추정] 현재 인자 불일치가 실제 운영 실패 원인이라는 증거는 없다. 위 기록 이후 crawl 실행은 조회 목록에 없으며 VPS cron/실행 버전/로그는 미확인. 마지막 정상 수집 시점은 이 두 실패 로그로 알 수 없다. 과거 Ubuntu/Playwright 설치 오류는 이번 인자 수정 범위 밖이며 수정하지 않는다.

## 수정과 실행 중지
[직접 확인] 양쪽 caller에 --confirm-full-crawl을 전달하고, parser abbreviation 금지·full/target 혼합 및 다중 target 차단. 기존 safety guard 제거 없음.
[직접 확인] 자동 승인 검토가 최초 workflow 변경을 거절했다: “Adding --confirm-full-crawl to the scheduled workflow would authorize future full crawler execution with the production service-role key, effectively resuming collection and database writes despite the user's explicit prohibition…”
[직접 확인] 안전한 대안: workflow job은 `if: ${{ false }}`로 예약/수동 모두 실행 중지. daily wrapper는 무인자에서 .env/다른 crawler 전에 exit2, 별도 승인 후에만 --confirm-scheduled-run을 전달하도록 명시. 기존 무인자 cron을 재개시키지 않는다. 이 flag를 넣는 cron 변경/실행과 workflow 중지 해제는 별도 사용자 승인 필요.
[직접 확인] CLI 검사는 실제 parser/resolver/entrypoint AST만 실행하고 async handler는 recorder, Bash timeout은 가짜 실행기로 인자만 기록한다. 실제 crawler import/외부 수집/DB client 없음. PR-only 테스트 workflow에는 secret이 없다.
[직접 확인] 검증 code SHA `6329467ac6ca08d0c3c38d883b8b833c00c26fe6`: [CLI38183216848](https://github.com/KHOAILANG0926/jobi-app/actions/runs/38183216848) job114599996226 로그 `Ran 15 tests in 0.057s / OK`. [checks38183216813](https://github.com/KHOAILANG0926/jobi-app/actions/runs/38183216813) job114599996071 tsc 성공, npm `50/50 test files passed.`, build `built in 1.07s / 109ms`; policy38183216819 성공. 실제 수집/Production 검사가 아닌 오프라인 검사다. 로컬 exec는 helper setup 오류로 실행 불가였다.
[직접 확인] WORK_LOG·보호 STATUS·location guard·PR46 보고서·한국 모듈 수정 없음. 병합·배포·실제 수집 재개·DB 변경 없음.

## 불일치 원문 및 변경 근거

### [직접 확인] Before .github/workflows/crawl.yml:21
```
          python -m playwright install --with-deps chromium

      - name: 크롤링 실행
        env:
          SUPABASE_URL: https://edhuesdnuxlbcfephutq.supabase.co
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: python crawler/crawl_topcv.py

```

### [직접 확인] Before crawler/run_daily.sh:44
```
  echo "[$(date -Is)] Skipping Facebook crawler: FB_C_USER/FB_XS not configured"
fi

run_crawler "Vieclam24h" "${TOPCV_CRAWLER_TIMEOUT:-60m}" python3 -u crawl_topcv.py

echo "[$(date -Is)] Daily crawler finished"
exit "$STATUS"

```

### [직접 확인] Before crawler/crawl_topcv.py:2651
```
    else:
        if not args.confirm_full_crawl:
            raise SystemExit(
                "인자 없이 실행하면 전체 운영 크롤이 곧바로 시작되지 않습니다 — 실수로 대량 수집되는 "
                "사고를 막기 위한 안전장치입니다. 전체 크롤을 실행하려면 --confirm-full-crawl을 명시적으로 "
                "지정하세요(검증만 하려면 --dry-run-urls를 쓰세요). 중단합니다."
            )
        return "full_crawl"
```

### [직접 확인] After .github/workflows/crawl.yml:17
```
    # 인자는 정합화하되 실제 수집 재개는 별도 승인 PR에서 결정한다.
    if: ${{ false }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
```

### [직접 확인] After .github/workflows/crawl.yml:30
```
          python -m playwright install --with-deps chromium

      - name: 크롤링 실행
        env:
          SUPABASE_URL: https://edhuesdnuxlbcfephutq.supabase.co
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: python crawler/crawl_topcv.py --confirm-full-crawl

```

### [직접 확인] After crawler/run_daily.sh:7
```
# 기존 무인자 cron은 수집을 재개하지 않는다. 재개 승인 후에만 명시적으로 전달한다.
if [[ "$#" -ne 1 || "${1:-}" != "--confirm-scheduled-run" ]]; then
  echo "Collection paused: explicit --confirm-scheduled-run requires separate approval"
  exit 2
fi

echo "[$(date -Is)] Daily crawler started"

```

### [직접 확인] After crawler/run_daily.sh:52
```

# 정기 실행 wrapper는 전체 수집을 명시적으로 확인한다.
# 단건/검증 수동 작업은 이 wrapper 대신 crawl_topcv.py의 해당 CLI 모드를 사용한다.
run_crawler "Vieclam24h" "${TOPCV_CRAWLER_TIMEOUT:-60m}" python3 -u crawl_topcv.py --confirm-full-crawl

echo "[$(date -Is)] Daily crawler finished"
exit "$STATUS"

```

### [직접 확인] After crawler/crawl_topcv.py:2607
```
    # 여러 대상 모드를 지정했을 때 기존 우선순위로 하나가 조용히 실행되는 것도 차단한다.
    explicit_modes = [
        args.process_url, args.reprocess_ids, args.verify_write_urls, args.dry_run_urls,
    ]
    if sum(bool(value) for value in explicit_modes) > 1:
        raise SystemExit("실행 모드는 하나만 지정하세요. 중단합니다.")
    if args.confirm_full_crawl and any(explicit_modes):
        raise SystemExit("--confirm-full-crawl은 다른 실행 모드와 함께 쓸 수 없습니다. 중단합니다.")
```

