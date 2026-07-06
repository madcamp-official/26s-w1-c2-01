from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Brainstorm API"
    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://app:app@db:5432/app"
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    # JWT 인증
    jwt_secret_key: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14

    # 프론트엔드 연동용 CORS 허용 origin
    cors_allow_origins: str = "http://localhost:5173"

    # 추천 단어 생성용 Gemini API 키 (없으면 사전적 유사도 + 관련검색어 방식으로 폴백)
    gemini_api_key: str = ""
    # 무료 티어는 모델별로 할당량이 다르고 자주 바뀌므로, 코드 수정 없이 .env에서만 바꿔가며 쓸 수 있게 함
    gemini_model: str = "gemini-3.5-flash"
    # gemini_model이 할당량 초과 등으로 실패하면 순서대로 시도할 모델들 (콤마 구분, 모델마다 무료 할당량이
    # 별도로 관리되므로 하나가 소진돼도 다른 모델로 자동 전환된다)
    gemini_fallback_models: str = "gemini-3.1-flash-lite,gemini-2.5-flash,gemini-2.5-flash-lite"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # list로 변환 (.env는 list 직접 못 넣음)
    @property
    def cors_allow_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]

    @property
    def gemini_models_in_order(self) -> list[str]:
        """gemini_model을 1순위로, gemini_fallback_models를 그다음 순서로 하되 중복은 제거한다."""
        ordered = [self.gemini_model.strip()] if self.gemini_model.strip() else []
        for model in self.gemini_fallback_models.split(","):
            model = model.strip()
            if model and model not in ordered:
                ordered.append(model)
        return ordered


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

