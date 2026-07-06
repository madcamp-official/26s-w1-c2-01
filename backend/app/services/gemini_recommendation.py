import logging

from pydantic import BaseModel

from app.config import settings
from app.services.recommendation import normalize_dedup_key

logger = logging.getLogger(__name__)

_SYSTEM_INSTRUCTION = (
    "당신은 마인드맵 브레인스토밍 앱의 연관 단어 추천 엔진입니다. "
    "입력된 아이디어와 반드시 같은 언어로 답하세요 (한국어 입력에는 한국어, 영어 입력에는 영어로). "
    "제안은 완전한 문장이 아니라 1~4단어의 짧은 명사구여야 합니다. "
    "'제외 목록'에 있는 단어와 같거나 의미가 사실상 같은 표현은 절대 제안하지 마세요. "
    "'같은 색상 그룹'으로 주어진 단어들과 주제적으로 어울리되, 아직 다루지 않은 새로운 하위 개념을 제안하세요."
)


class _SuggestionList(BaseModel):
    suggestions: list[str]


_client = None


def _get_client():
    global _client
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _build_prompt(content: str, color_group: list[str], exclude: list[str], limit: int) -> str:
    lines = [f"아이디어: {content}"]
    if color_group:
        lines.append("같은 색상 그룹의 다른 아이디어: " + ", ".join(color_group))
    if exclude:
        lines.append("이미 나왔으므로 제외해야 할 단어: " + ", ".join(exclude))
    lines.append(f"위 내용을 참고해 새로운 연관 키워드를 {limit}개 제안해줘.")
    return "\n".join(lines)


def generate_keyword_suggestions(
    *, content: str, color_group: list[str], exclude: list[str], limit: int = 6,
) -> list[str]:
    """Gemini로 색상 그룹 맥락 + 제외 목록을 반영한 연관 키워드 생성. 실패/키 미설정 시 빈 리스트."""
    if not settings.gemini_api_key:
        return []

    from google.genai import types

    prompt = _build_prompt(content, color_group[:8], exclude[:30], limit)
    try:
        response = _get_client().models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=_SuggestionList,
                temperature=0.9,
            ),
        )
        parsed = _SuggestionList.model_validate_json(response.text)
    except Exception:
        # 원인(할당량 초과 429, 일시 장애 503, 응답 스키마 불일치 등)을 알 수 없으면
        # 폴백만 계속 타는 상황을 디버깅할 방법이 없으므로 반드시 로그를 남긴다
        logger.warning("Gemini 추천 생성 실패, 관련검색어 폴백으로 전환", exc_info=True)
        return []

    excluded_keys = {normalize_dedup_key(item) for item in exclude} | {normalize_dedup_key(content)}
    seen: set[str] = set()
    results: list[str] = []
    for word in parsed.suggestions:
        key = normalize_dedup_key(word)
        word = word.strip()
        if not word or key in excluded_keys or key in seen:
            continue
        seen.add(key)
        results.append(word)
    return results[:limit]
