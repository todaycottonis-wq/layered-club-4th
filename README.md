# Layered Club 4기 모집 페이지

정적 사이트예요. 배포되는 파일은 `public/` 폴더입니다.

- `index.html`: 페이지 원본(조각). 수정은 여기서 하고 `python3 tools/build.py`로 `public/`을 다시 만들어요.
- `public/`: Vercel이 서비스하는 완성본 (index.html + img)
- `tools/apps-script.gs`, `tools/구글시트-설정.md`: 신청 데이터를 구글 시트로 받는 설정
- 신청 접수 주소는 `index.html`의 `CONFIG.endpoint`에 넣어요.
