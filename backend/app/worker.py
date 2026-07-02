from celery import Celery

from app.config import settings

celery_app = Celery(
    "brainstorm",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.update(task_track_started=True, task_serializer="json", accept_content=["json"])


@celery_app.task(name="app.tasks.ping")
def ping() -> str:
    return "pong"

