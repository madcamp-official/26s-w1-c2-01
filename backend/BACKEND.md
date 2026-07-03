# Backend skeleton

FastAPI, PostgreSQL (pgvector), Redis, Celery, WebSocket/SSE를 위한 최소 실행 골격입니다.
README의 API 명세 및 DB 모델은 아직 구현하지 않았습니다.

## 실행

```bash
cd backend
cp .env.example .env
docker compose up --build
```

Windows PowerShell에서는 `Copy-Item .env.example .env`를 사용하면 됩니다.

- API 문서: http://localhost:8000/docs
- 기본 헬스 체크: http://localhost:8000/api/v1/health
- 의존성 준비 확인: http://localhost:8000/api/v1/health/ready
- WebSocket: `ws://localhost:8000/api/v1/ws/workspaces/{workspace_id}`
- SSE: `http://localhost:8000/api/v1/sse/workspaces/{workspace_id}`

WebSocket은 현재 단일 프로세스 echo 골격이며, 실제 구현 시 JWT 인증과 Redis pub/sub을 연결해야 합니다.
SSE는 15초마다 heartbeat만 전송합니다.
