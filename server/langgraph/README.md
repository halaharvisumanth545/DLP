# Material Load LangGraph

This workflow replicates the attached n8n flow:

1. Accept a Google Docs URL
2. Read the document through the Google Docs API
3. Split the text with a recursive character splitter
4. Create OpenAI embeddings with `text-embedding-3-small`
5. Upsert the vectors into Pinecone

## Install

```bash
pip install -r server/langgraph/requirements.txt
```

## Required Environment Variables

Use `server/.env.example` as the reference. The workflow expects:

- `OPENAI_API_KEY`
- `OPENAI_EMBED_MODEL`
- `OPENAI_EMBED_DIM`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`
- `PINECONE_NAMESPACE`
- Prefer:
  - `GOOGLE_SERVICE_ACCOUNT_FILE`
- Or use:
  - `GOOGLE_SERVICE_ACCOUNT_JSON`
- The individual `GOOGLE_SERVICE_ACCOUNT_*` fields are only a fallback path

Optional:

- `MATERIAL_LOAD_PYTHON_BIN`
- `MATERIAL_LOAD_CHUNK_SIZE`
- `MATERIAL_LOAD_CHUNK_OVERLAP`
- `MATERIAL_LOAD_EMBED_BATCH_SIZE`

## Google Docs Access

If you use a service account, the Google Doc must be shared with the service
account email address so the workflow can read it.
