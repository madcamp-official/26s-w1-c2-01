from functools import lru_cache

MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"  # 다국어 지원, 384차원


@lru_cache(maxsize=1)
def _get_model():
    # Celery worker 프로세스가 실제로 이 함수를 처음 호출할 때(=첫 추천 요청 처리 시)만 로드되게 지연 import
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(MODEL_NAME)


def compute_embedding(text: str) -> list[float]:
    """텍스트 하나를 384차원 벡터로 변환, 코사인 유사도 비교를 염두에 두고 정규화"""
    model = _get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()