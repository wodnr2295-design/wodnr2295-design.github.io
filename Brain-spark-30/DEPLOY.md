# 배포 정보

- **라이브 URL**: https://wodnr2295-design.github.io/Brain-spark-30/
- **호스팅**: GitHub Pages (repo `wodnr2295-design/wodnr2295-design.github.io`, `main` 브랜치, `/` 루트)
- **배포 위치**: 해당 저장소의 `Brain-spark-30/` 폴더
- **최초 배포 커밋**: `2156c52` · **최신 배포 커밋**: `67c0b49`

## 왜 별도 저장소가 아닌가

계획은 `wodnr2295-design/Brain-spark-30` 저장소를 새로 만드는 것이었지만, 현재 연결된 GitHub
앱 토큰에는 저장소 생성 권한이 없습니다.

```
POST /user/repos  →  403 Resource not accessible by integration
```

`wodnr2295-design.github.io`는 이미 Pages로 서비스 중이고(네이버 사이트 확인 파일 1개만 있는 상태),
그 아래 `Brain-spark-30/` 폴더로 배포하면 **요청한 URL과 완전히 같은 주소**가 됩니다.
기존 파일은 건드리지 않았습니다.

## 업데이트 방법

```bash
git clone https://github.com/wodnr2295-design/wodnr2295-design.github.io.git
# Brain-spark-30/ 폴더 내용을 이 프로젝트의 최신 파일로 교체
git add Brain-spark-30 && git commit -m "Update BRAIN SPARK 30" && git push
```

푸시 후 GitHub Pages가 약 40초 안에 자동 재빌드합니다.

## 나중에 독립 저장소로 옮기려면

GitHub 연결에 저장소 생성(Administration) 권한이 추가되면 아래처럼 그대로 옮길 수 있습니다.
URL은 동일합니다.

```bash
gh repo create wodnr2295-design/Brain-spark-30 --public --source=. --push
gh api -X POST repos/wodnr2295-design/Brain-spark-30/pages \
  -f 'source[branch]=main' -f 'source[path]=/'
```
