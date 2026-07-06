import json

import httpx


def normalize_dedup_key(text: str) -> str:
    """추천 중복/제외 판정용 정규화 키.

    앞뒤 공백과 대소문자뿐 아니라 단어 사이 공백 유무까지 같은 표현으로 취급해야,
    "시작 시점"과 "시작시점"처럼 띄어쓰기만 다른 표현이 서로 다른 추천으로 새어나가지 않는다.
    """
    return "".join(text.split()).lower()


async def fetch_related_search_terms(query: str, limit: int = 5) -> list[str]:
    """관련검색어 후보를 외부 자동완성 API에서 가져옴"""
    url = "https://duckduckgo.com/ac/"
    params = {"q": query, "kl": "kr-kr"}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            # 응답 헤더에 charset이 없으면 httpx가 인코딩을 추측하다 한글이 깨질 수 있어,
            # 항상 UTF-8로 고정 디코딩해 자동 감지에 의존하지 않는다
            data = json.loads(response.content.decode("utf-8"))
    except (httpx.HTTPError, ValueError, UnicodeDecodeError):
        # 외부 API가 잠깐 죽어도 추천 기능 전체가 죽으면 안 되므로, 빈 리스트로 조용히 폴백
        return []

    terms = [item["phrase"] for item in data if isinstance(item, dict) and "phrase" in item]
    return terms[:limit]


def merge_recommendations(
    semantic_candidates: list[dict],
    search_terms: list[str],
    *,
    semantic_weight: float,
    search_weight: float,
    limit: int = 6,
    exclude: set[str] | None = None,
) -> list[dict]:
    """사전적 유사성 후보 + 관련검색어 후보를 가중치로 합산해서 하나의 순위 목록으로 만듦

    `exclude`는 원본 블록 내용이나 이미 존재하는 하위 노드처럼, 그대로 다시 추천되면
    의미 없는 레이블들을 걸러내기 위한 정규화된(`normalize_dedup_key`) 키 집합이다.
    """
    excluded_keys = exclude or set()
    scores: dict[str, float] = {}
    display: dict[str, str] = {}
    source: dict[str, str] = {}

    for candidate in semantic_candidates:
        key = normalize_dedup_key(candidate["content"])
        if not key or key in excluded_keys:
            continue
        scores[key] = scores.get(key, 0.0) + candidate["score"] * semantic_weight
        display.setdefault(key, candidate["content"].strip())
        source.setdefault(key, "semantic")

    total_terms = max(len(search_terms), 1)
    for rank, term in enumerate(search_terms):
        key = normalize_dedup_key(term)
        term = term.strip()
        if not key or key in excluded_keys:
            continue
        rank_score = max(0.0, 1 - rank / total_terms)
        scores[key] = scores.get(key, 0.0) + rank_score * search_weight
        display.setdefault(key, term)
        source.setdefault(key, "search")

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [
        {"content": display[key], "score": round(value, 4), "source": source[key]}
        for key, value in ranked
        if value > 0
    ]