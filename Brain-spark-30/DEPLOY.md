# 배포 정보

- **라이브 URL**: https://wodnr2295-design.github.io/Brain-spark-30/
- **호스팅**: GitHub Pages (repo `wodnr2295-design/wodnr2295-design.github.io`, `main` 브랜치, `/` 루트)
- **배포 위치**: 해당 저장소의 `Brain-spark-30/` 폴더
- **최초 배포 커밋**: `2156c52` · **스나이퍼/대비 개선**: `67c0b49` · **60초·13종·도전장 링크(v2.0)**: 아래 커밋 참고

> URL은 30초 시절 그대로 `/Brain-spark-30/`을 유지합니다. 앱 이름과 화면 표기는 `BRAIN SPARK 60` / 1분으로 바뀌었지만,
> 이미 공유된 링크가 깨지지 않도록 경로는 옮기지 않았습니다.

## 바뀐 것 (v2.0)

- 제한시간 30초 → 60초, 등급·티어·시드 랭킹·코인 보상 재조정
- 미니게임 9종 → 13종 (순간 판별 · 초시계 스톱 · 패턴 빈칸 · 플래시 그리드 추가)
- 도전장 링크(`?c=…`, URL-safe Base64): 결과/기록 화면에서 복사 → 받은 사람은 로비 배너·랭킹(친구 배지)에 자동 등록
- `localStorage` 키(`brainspark30.v1`)와 저장 구조는 유지 (기존 코인·커스터마이징·기록 호환)

## 업데이트 방법

```bash
git clone https://github.com/wodnr2295-design/wodnr2295-design.github.io.git
# Brain-spark-30/ 폴더 내용을 이 프로젝트의 최신 파일로 교체
git add Brain-spark-30 && git commit -m "Update BRAIN SPARK 60" && git push
```

푸시 후 GitHub Pages가 약 40초 안에 자동 재빌드합니다.

배포본 검증:

```bash
python3 tests/live_check.py   # 라이브 URL에서 1분·13종·도전장 링크까지 확인
```

## 왜 별도 저장소가 아닌가

계획은 `wodnr2295-design/Brain-spark-30` 저장소를 새로 만드는 것이었지만, 현재 연결된 GitHub
앱 토큰에는 저장소 생성 권한이 없습니다.

```
POST /user/repos  →  403 Resource not accessible by integration
```

`wodnr2295-design.github.io`는 이미 Pages로 서비스 중이고, 그 아래 `Brain-spark-30/` 폴더로 배포하면
**요청한 URL과 완전히 같은 주소**가 됩니다. 기존 파일은 건드리지 않았습니다.

## 나중에 독립 저장소로 옮기려면

GitHub 연결에 저장소 생성(Administration) 권한이 추가되면 아래처럼 그대로 옮길 수 있습니다.
URL은 동일합니다.

```bash
gh repo create wodnr2295-design/Brain-spark-30 --public --source=. --push
gh api -X POST repos/wodnr2295-design/Brain-spark-30/pages \
  -f 'source[branch]=main' -f 'source[path]=/'
```
