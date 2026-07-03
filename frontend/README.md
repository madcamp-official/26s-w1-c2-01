
  # Web-based Mind Mapping Tool

  This is a code bundle for Web-based Mind Mapping Tool. The original project is available at https://www.figma.com/design/HWZgqHt1raAmq5rWZYxFM0/Web-based-Mind-Mapping-Tool.

  ## Running the code

  Node.js 22 LTS is recommended.

  ```bash
  npm ci
  npm run dev
  ```

  Open http://localhost:5173 in a browser.

  Production build and local preview:

  ```bash
  npm run build
  npm run preview
  ```

  On Windows PowerShell with script execution disabled, use `npm.cmd` instead of `npm`.

## Backend integration

`VITE_API_BASE_URL`의 기본값은 `http://localhost:8000/api/v1`입니다. 인증, 워크스페이스/멤버/마인드맵/블록 조회, 역할 변경과 댓글 작성·수정·해결은 백엔드 API를 사용합니다.

아직 백엔드 저장 대상이 아닌 데이터는 프론트엔드 더미 또는 로컬 상태로 유지합니다.

- 블록 `x/y` 좌표와 자동 정렬 결과: 사용자별 로컬 레이아웃이며 공유하지 않음
- 추천 노드 문구: 추천 작업 결과가 준비되지 않은 동안 UI 데모 더미 사용 (`TODO: recommendation API polling/SSE 연결`)
- API 데이터가 전혀 없는 신규 계정의 빈 화면: 현재 데모 워크스페이스 fallback 사용 (`TODO: empty state 구현`)
  
