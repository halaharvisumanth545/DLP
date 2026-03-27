# Reranker Service

This is the second-stage retrieval service for the project.

It is designed to sit after Pinecone retrieval:

1. your app retrieves a larger candidate pool from Pinecone
2. the reranker scores each `(query, chunk)` pair
3. the highest-scoring candidates are kept for final use

## Recommended Model

Default:

- `cross-encoder/ms-marco-MiniLM-L-6-v2`

Why this default:

- strong practical retrieve-and-rerank baseline
- much smaller than the larger BAAI rerankers
- realistic to run on CPU during local development

You can override it with:

```env
RERANKER_MODEL_NAME=BAAI/bge-reranker-base
```

## Install

Use a dedicated Python environment if you want to keep the ingestion environment separate:

```bash
python3 -m venv .venv-reranker
source .venv-reranker/bin/activate
pip install --upgrade pip
pip install -r server/reranker/requirements.txt
```

## Run

From the repo root:

```bash
source .venv-reranker/bin/activate
uvicorn server.reranker.app:app --host 0.0.0.0 --port 8091 --reload
```

## Environment Variables

Optional:

```env
RERANKER_MODEL_NAME=cross-encoder/ms-marco-MiniLM-L-6-v2
RERANKER_DEVICE=cpu
RERANKER_MAX_LENGTH=512
RERANKER_BATCH_SIZE=16
```

## Test

Health:

```bash
curl http://localhost:8091/health
```

Rerank:

```bash
curl -X POST http://localhost:8091/rerank \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is normalization in DBMS?",
    "top_n": 3,
    "candidates": [
      {"id": "c1", "text": "Normalization reduces redundancy and dependency in relational schemas."},
      {"id": "c2", "text": "Operating systems manage process scheduling and memory."},
      {"id": "c3", "text": "Third normal form removes transitive dependency from a relation."}
    ]
  }'
```

## Integration Plan

When you wire this into the Node retrieval path, change retrieval to:

1. Pinecone query with `topK=20` or `topK=30`
2. send returned chunks to this service
3. keep the reranked top results
4. later apply adaptive top-k on the reranker scores
