#!/usr/bin/env python3
"""Standalone reranker service for Pinecone retrieval candidates."""

from __future__ import annotations

import math
import os
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import CrossEncoder


def env_int(name: str, default: int) -> int:
    value = os.getenv(name, "").strip()
    if not value:
        return default
    return int(value)


def env_str(name: str, default: str) -> str:
    value = os.getenv(name, "").strip()
    return value or default


def sigmoid(value: float) -> float:
    if value >= 0:
        exp_term = math.exp(-value)
        return 1.0 / (1.0 + exp_term)
    exp_term = math.exp(value)
    return exp_term / (1.0 + exp_term)


class Candidate(BaseModel):
    id: Optional[str] = None
    text: str = Field(min_length=1)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RerankRequest(BaseModel):
    query: str = Field(min_length=1)
    candidates: List[Candidate] = Field(min_length=1)
    top_n: Optional[int] = Field(default=None, ge=1)
    return_documents: bool = True


class RankedCandidate(BaseModel):
    rank: int
    original_index: int
    id: Optional[str] = None
    score: float
    normalized_score: float
    text: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RerankResponse(BaseModel):
    query: str
    model: str
    total_candidates: int
    returned_candidates: int
    results: List[RankedCandidate]


class ServiceState:
    reranker: Optional[CrossEncoder] = None
    model_name: str = ""


service_state = ServiceState()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    model_name = env_str("RERANKER_MODEL_NAME", "cross-encoder/ms-marco-MiniLM-L-6-v2")
    model_kwargs: Dict[str, Any] = {
        "max_length": env_int("RERANKER_MAX_LENGTH", 512),
        "trust_remote_code": False,
    }

    device = os.getenv("RERANKER_DEVICE", "").strip()
    if device:
        model_kwargs["device"] = device

    service_state.model_name = model_name
    service_state.reranker = CrossEncoder(model_name, **model_kwargs)
    yield


app = FastAPI(
    title="DLP Reranker Service",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "model": service_state.model_name,
        "loaded": service_state.reranker is not None,
    }


@app.post("/rerank", response_model=RerankResponse)
def rerank(request: RerankRequest) -> RerankResponse:
    if service_state.reranker is None:
        raise HTTPException(status_code=503, detail="Reranker model is not loaded.")

    pairs = [(request.query, candidate.text) for candidate in request.candidates]
    scores = service_state.reranker.predict(
        pairs,
        batch_size=env_int("RERANKER_BATCH_SIZE", 16),
        convert_to_numpy=True,
        show_progress_bar=False,
    )

    ranked_results: List[RankedCandidate] = []
    for index, (candidate, score) in enumerate(zip(request.candidates, scores)):
        score_value = float(score)
        ranked_results.append(
            RankedCandidate(
                rank=0,
                original_index=index,
                id=candidate.id,
                score=score_value,
                normalized_score=sigmoid(score_value),
                text=candidate.text if request.return_documents else None,
                metadata=candidate.metadata,
            )
        )

    ranked_results.sort(key=lambda item: item.score, reverse=True)

    for rank, item in enumerate(ranked_results, start=1):
        item.rank = rank

    if request.top_n is not None:
        ranked_results = ranked_results[:request.top_n]

    return RerankResponse(
        query=request.query,
        model=service_state.model_name,
        total_candidates=len(request.candidates),
        returned_candidates=len(ranked_results),
        results=ranked_results,
    )
