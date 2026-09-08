# D1 사용량 조사

2026-09-08 Cloudflare GraphQL에서 해당 공개 DB의 누적 읽기 716,265행, 쓰기 89,735행을 확인했다. 무료 한도는 읽기 500만 행/일·쓰기 10만 행/일이며 UTC 00:00에 초기화된다. 카운터는 이미 사용한 양이므로 배포가 기존 누적치를 낮추지는 않는다.

출처: [Cloudflare D1 요금과 행 집계](https://developers.cloudflare.com/d1/platform/pricing/), [D1 메타데이터](https://developers.cloudflare.com/d1/worker-api/return-object/), [D1 관측 지표](https://developers.cloudflare.com/d1/observability/metrics-analytics/).

## 저장 경로

기존 구현은 모든 일반 명령에서 선수·계약·스태프·협상·순위 테이블을 사용자 단위로 지우고 재삽입했다. 지금은 실제 변경된 컬럼의 행만 UPSERT한다. 삭제도 사라진 기본키에 한정한다. snapshot revision의 compare-and-swap와 write_token guard 아래 D1 batch 하나로 처리하므로 지는 요청은 projection을 변경하지 않는다.

저장 후 재무 재조회도 제거한다. 이미 읽은 원장과 새로 확정한 지출 항목으로 응답을 만들며, 기존 원장을 전달하지 않는 repository 호출은 이전과 같이 DB에서 읽는다. 구버전 snapshot은 원본과 보정된 다음 상태를 비교하므로 새 필드/능력 보정도 필요한 행에 반영한다.

## 재현

```sh
node scripts/profile-d1.mjs 5f407eb3cf5228bdb769d2ee2d6069c78f3943e7
```

로컬 격리 D1에 migration을 적용하고 같은 seed로 저장 전후의 D1 `meta`를 수집한다. baseline repository 소스는 Git에서 읽으며 운영 DB를 쓰지 않는다. 테스트용 번들은 Git 제외 work 아래 만들고 종료 시 지운다.

| 저장 명령 | 이전 읽기 / 쓰기 | 개선 읽기 / 쓰기 |
| --- | ---: | ---: |
| 보고 읽기 | 696 / 688 | 3 / 4 |
| 전술 변경 | 696 / 688 | 3 / 4 |
| 날짜 1일 진행 | 699 / 691 | 92 / 50 |
| 경기 시작·프리뷰 적용 | 697 / 688 | 3 / 4 |
| 경기 완료 | 702 / 693 | 94 / 52 |

HTTP/인증·초기 카탈로그·migration 비용을 포함하지 않는 로컬 저장 경로 비교다. index 갱신도 D1 쓰기에 포함되므로 snapshot + action 두 SQL이 실제로는 4행 쓰기로 측정된다. API/D1 통합 테스트는 쓰기 회귀와 원자적 저장을 함께 확인한다.

카탈로그 cold 조회는 현재 17,567행으로 남아 있으며 후속 읽기 최적화에서 별도로 줄인다. 운영 사용량은 배포 전후 같은 기간·비슷한 요청량으로 비교해야 한다.
