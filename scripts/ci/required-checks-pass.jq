# 봇 자동병합 필수 검사 판정(#728 S1). 입력 = collapse-check-runs.jq 결과. true일 때만 병합 후보.
# 4종(checks·app-screen·guard·publication-gate): 같은 이름이 여러 개면 전부 성공이어야 하고, 각각 최소 1개는 있어야 한다.
(all(.[] | select(.name=="checks" or .name=="app-screen" or .name=="guard" or .name=="publication-gate"); .status=="completed" and .conclusion=="success")) and
(any(.[]; .name=="checks" and .conclusion=="success")) and
(any(.[]; .name=="app-screen" and .conclusion=="success")) and
(any(.[]; .name=="guard" and .conclusion=="success")) and
(any(.[]; .name=="publication-gate" and .conclusion=="success"))
