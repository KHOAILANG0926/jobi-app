# 박닌 주요 KCN 정문 좌표 dry-run (2026-10-08)

DB 쓰기 없음. 로컬 파일 저장 없음(결과는 이 요약만 문서화). 출처: OpenStreetMap Overpass (ODbL).

## 건수
- 검사한 KCN/CCN 도형: 59건, 그중 주요 KCN 22건
- 등급 A(이름 있는 KCN 정문, 출처 명확): 0건
- 등급 B(도형 경계 30m 이내 barrier=gate 등 이름 없는 출입구): 주요 KCN 중 9곳에 후보 있음(후보 노드 40개), 전체 17곳(후보 노드 62개)
- 등급 C: 0건
- 후보 없음: 주요 KCN 13곳

## 미수행(정직한 보고)
- VietMap POI/검색: 미수행 — 서버 키(`VIETMAP_SERVICE_KEY`)가 아직 Vercel에 없고 비공개 저장소 DDL도 미승인.
- 위성 확인: 미수행 — 이 환경에서 위성 타일을 확인할 수 없음. 아래 후보는 **미확인**이며 `industrialParks.ts`에 넣지 않았다.
- B 후보에는 access=no/private 출입구, 공장·주거 출입구가 섞여 있어 KCN 대표 정문으로 확정할 수 없다.

## 주요 KCN별 결과
| KCN | OSM ref | A | B | C | B 후보 |
|---|---|---|---|---|---|
| Khu công nghiệp Đại Đồng - Hoàn Sơn | way/642268651 | 0 | 3 | 0 | node/8823701261, node/13142020369, node/13142022268 |
| Khu công nghiệp Đình Trám | way/597865634 | 0 | 1 | 0 | node/8498765326(no) |
| Khu Công nghiệp Gia Bình I | way/1489181623 | 0 | 0 | 0 | - |
| Khu công nghiệp Gia Bình II | way/1346104850 | 0 | 0 | 0 | - |
| Khu công nghiệp Hanaka | way/642268658 | 0 | 0 | 0 | - |
| Khu công nghiệp Nam Sơn - Hạp Lĩnh | way/1265422032 | 0 | 1 | 0 | node/13124347039 |
| Khu công nghiệp Quang Châu | way/806896214 | 0 | 0 | 0 | - |
| Khu công nghiệp Quế Võ | way/597872887 | 0 | 0 | 0 | - |
| Khu công nghiệp Quế Võ II | way/597920929 | 0 | 0 | 0 | - |
| Khu công nghiệp Quế Võ III | way/1184113104 | 0 | 2 | 0 | node/12803450926, node/12803450927 |
| Khu công nghiệp Thuận Thành 2 | way/1119170920 | 0 | 0 | 0 | - |
| Khu công nghiệp Thuận Thành 3 | way/1119170923 | 0 | 0 | 0 | - |
| Khu công nghiệp Thuận Thành III | way/1467190501 | 0 | 0 | 0 | - |
| Khu công nghiệp Tiên Sơn | way/28473576 | 0 | 0 | 0 | - |
| Khu công nghiệp Vân Trung | way/704069818 | 0 | 4 | 0 | node/13433890987(no), node/13433890988(no), node/13433890989(no), node/13433890990(no) |
| Khu công nghiệp Việt Hàn | way/897187625 | 0 | 0 | 0 | - |
| Khu công nghiệp VSIP Bắc Ninh | way/642274405 | 0 | 19 | 0 | node/12855644117, node/12855644118, node/12855644119, node/12855644122, node/12855644129, node/12855644130, node/12855644131, node/12855644132, node/12855644138, node/12855664328, node/12855664329, node/12950972864, node/12950972871, node/12950976169, node/12950976170, node/12950976173, node/12950976176, node/12950976177, node/12950976190 |
| Khu công nghiệp Yên Phong - Giai đoạn 1 | way/598146230 | 0 | 3 | 0 | node/14172720035, node/14172720036, node/14173752820 |
| Khu Công Nghiệp Yên Phong II | way/1257183941 | 0 | 0 | 0 | - |
| Khu Công Nghiệp Yên Phong II | way/1257183942 | 0 | 0 | 0 | - |
| Khu Công Nghiệp Yên Phong II C | way/1257183934 | 0 | 3 | 0 | node/12923394729, node/13195328774, node/13195328775 |
| Khu công nghiệp Yên Phong mở rộng | way/805410975 | 0 | 4 | 0 | node/13808627981 Cổng 2, node/13808627988 Cổng 1, node/13808627994 Cổng A, node/13808627995 Cổng A |

## 결과의 의미
- 정문 좌표가 승인되기 전까지 KCN 단계 "Đến cổng KCN"은 표시되지 않고, 승인 좌표도 없으면 "Gọi hỏi đường"(전화)로 안내된다.
- 다음 결정: VietMap 키 투입 후 POI 검색 + 위성 확인으로 B 후보를 승격할지 결정.
