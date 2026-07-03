import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path
 
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
 
from alembic import context
 
# backend/ 디렉터리를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings    # noqa: E402
from app.models import Base    # noqa: E402

config = context.config
 
# .env(settings.database_url)를 단일 소스로 사용
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 모든 모델의 metadata를 참조 (autogenerate용)
target_metadata = Base.metadata