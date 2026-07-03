from fastapi import APIRouter

from app.api.routes import auth, blocks, comments, health, invitations, mindmaps, realtime, recommendations, users, workspaces

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(workspaces.router)
api_router.include_router(invitations.router)
api_router.include_router(mindmaps.router)
api_router.include_router(blocks.router)
api_router.include_router(comments.router)
api_router.include_router(recommendations.router)
api_router.include_router(realtime.router)

