#!/usr/bin/env python3
"""LangGraph workflow for Google Docs ingestion with section-aware semantic clustering."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple, TypedDict

from google.oauth2 import service_account
from googleapiclient.discovery import build
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.graph import END, StateGraph
from openai import OpenAI
from pinecone import Pinecone


GOOGLE_DOC_SCOPES = [
    "https://www.googleapis.com/auth/documents.readonly",
]


class MaterialLoadState(TypedDict, total=False):
    docs_url: str
    user_id: str
    syllabus_id: str
    document_id: str
    document_title: str
    document_text: str
    sections: List[Dict[str, Any]]
    chunk_records: List[Dict[str, Any]]
    cluster_summary: List[Dict[str, Any]]
    upsert_count: int
    namespace: str
    result: Dict[str, Any]


def chunk_list(items: Sequence[Any], size: int) -> List[List[Any]]:
    return [list(items[index:index + size]) for index in range(0, len(items), size)]


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def google_service_account_info() -> Dict[str, Any]:
    raw_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    file_path = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "").strip()

    if file_path:
        resolved_path = Path(file_path).expanduser().resolve()
        if not resolved_path.is_file():
            raise RuntimeError(
                f"GOOGLE_SERVICE_ACCOUNT_FILE does not point to a readable JSON key file: {resolved_path}"
            )
        with resolved_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    if raw_json:
        return json.loads(raw_json)

    private_key = require_env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace("\\n", "\n")
    return {
        "type": "service_account",
        "project_id": require_env("GOOGLE_SERVICE_ACCOUNT_PROJECT_ID"),
        "private_key_id": os.getenv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID", "").strip(),
        "private_key": private_key,
        "client_email": require_env("GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL"),
        "client_id": os.getenv("GOOGLE_SERVICE_ACCOUNT_CLIENT_ID", "").strip(),
        "token_uri": os.getenv("GOOGLE_SERVICE_ACCOUNT_TOKEN_URI", "https://oauth2.googleapis.com/token"),
    }


def build_docs_client():
    credentials = service_account.Credentials.from_service_account_info(
        google_service_account_info(),
        scopes=GOOGLE_DOC_SCOPES,
    )
    return build("docs", "v1", credentials=credentials, cache_discovery=False)


def extract_document_id(docs_url: str) -> str:
    match = re.search(r"/document/d/([a-zA-Z0-9_-]+)", docs_url)
    if not match:
        raise RuntimeError("Unable to extract a Google Docs document ID from the provided URL.")
    return match.group(1)


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u000b", " ").replace("\xa0", " ")).strip()


def clean_paragraph_text(paragraph: Dict[str, Any]) -> str:
    parts: List[str] = []
    for paragraph_element in paragraph.get("elements", []):
        text_run = paragraph_element.get("textRun")
        if text_run and text_run.get("content"):
            parts.append(text_run["content"])
    return normalize_whitespace("".join(parts))


def heading_level_for_style(named_style: str) -> Optional[int]:
    if named_style == "TITLE":
        return 1
    if named_style == "SUBTITLE":
        return 2

    match = re.match(r"HEADING_(\d+)", named_style or "")
    if not match:
        return None
    return max(1, int(match.group(1)))


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "cluster"


def truncate_words(value: str, max_words: int = 14) -> str:
    words = value.split()
    if len(words) <= max_words:
        return value
    return " ".join(words[:max_words]).rstrip(" ,.;:") + "..."


def cosine_similarity(vector_a: Sequence[float], vector_b: Sequence[float]) -> float:
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0

    for value_a, value_b in zip(vector_a, vector_b):
        dot += value_a * value_b
        norm_a += value_a * value_a
        norm_b += value_b * value_b

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


def average_embeddings(vectors: Sequence[Sequence[float]]) -> List[float]:
    if not vectors:
        return []

    length = len(vectors[0])
    totals = [0.0] * length
    for vector in vectors:
        for index, value in enumerate(vector):
            totals[index] += value

    averaged = [value / len(vectors) for value in totals]
    norm = math.sqrt(sum(value * value for value in averaged))
    if norm == 0:
        return averaged
    return [value / norm for value in averaged]


def topic_hints_from_env() -> List[Dict[str, Any]]:
    raw = os.getenv("MATERIAL_LOAD_TOPIC_HINTS_JSON", "").strip()
    if not raw:
        return []

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"MATERIAL_LOAD_TOPIC_HINTS_JSON is invalid JSON: {error}") from error

    if not isinstance(parsed, list):
        return []

    hints: List[Dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        name = normalize_whitespace(str(item.get("name", "")))
        subtopics = item.get("subtopics", [])
        cleaned_subtopics = []
        if isinstance(subtopics, list):
            cleaned_subtopics = [
                normalize_whitespace(str(subtopic))
                for subtopic in subtopics
                if normalize_whitespace(str(subtopic))
            ]
        if name:
            hints.append(
                {
                    "name": name,
                    "subtopics": cleaned_subtopics,
                }
            )
    return hints


def build_topic_candidates(topic_hints: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    candidates: List[Dict[str, str]] = []
    seen_labels = set()

    for topic in topic_hints:
        topic_name = topic["name"]
        topic_label = topic_name
        if topic_label not in seen_labels:
            candidates.append(
                {
                    "label": topic_label,
                    "topic": topic_name,
                    "subtopic": "",
                    "strategy": "topic-hint",
                }
            )
            seen_labels.add(topic_label)

        for subtopic in topic.get("subtopics", []):
            label = f"{topic_name} - {subtopic}"
            if label in seen_labels:
                continue
            candidates.append(
                {
                    "label": label,
                    "topic": topic_name,
                    "subtopic": subtopic,
                    "strategy": "topic-subtopic-hint",
                }
            )
            seen_labels.add(label)

    return candidates


def ensure_section(
    sections: List[Dict[str, Any]],
    current_key: str,
    section_path: List[str],
    section_level: int,
) -> Dict[str, Any]:
    if sections and sections[-1]["key"] == current_key:
        return sections[-1]

    section_title = section_path[-1] if section_path else "Overview"
    section = {
        "key": current_key,
        "sectionIndex": len(sections),
        "sectionTitle": section_title,
        "sectionPath": list(section_path),
        "sectionLevel": section_level,
        "textParts": [],
    }
    sections.append(section)
    return section


def extract_document_sections(document: Dict[str, Any]) -> Tuple[str, List[Dict[str, Any]]]:
    document_title = normalize_whitespace(document.get("title", "Untitled Google Doc")) or "Untitled Google Doc"
    sections: List[Dict[str, Any]] = []
    heading_stack: List[str] = []
    default_path = ["Overview"]
    current_section = ensure_section(sections, "__overview__", default_path, 0)

    def walk(elements: List[Dict[str, Any]]) -> None:
        nonlocal current_section, heading_stack

        for element in elements:
            paragraph = element.get("paragraph")
            if paragraph:
                paragraph_text = clean_paragraph_text(paragraph)
                if paragraph_text:
                    named_style = paragraph.get("paragraphStyle", {}).get("namedStyleType", "")
                    level = heading_level_for_style(named_style)

                    if level is not None:
                        heading_stack = heading_stack[: level - 1]
                        heading_stack.append(paragraph_text)
                        section_key = " > ".join(heading_stack)
                        current_section = ensure_section(sections, section_key, heading_stack, level)
                        continue

                    if not current_section:
                        current_section = ensure_section(sections, "__overview__", default_path, 0)

                    current_section["textParts"].append(paragraph_text)

            table = element.get("table")
            if table:
                for row in table.get("tableRows", []):
                    for cell in row.get("tableCells", []):
                        walk(cell.get("content", []))

            toc = element.get("tableOfContents")
            if toc:
                walk(toc.get("content", []))

    walk(document.get("body", {}).get("content", []))

    section_records: List[Dict[str, Any]] = []
    document_parts: List[str] = []

    for section in sections:
        section_text = re.sub(r"\n{3,}", "\n\n", "\n".join(section["textParts"])).strip()
        if not section_text:
            continue

        section_path = section["sectionPath"] or default_path
        section_title = section["sectionTitle"] or default_path[-1]
        document_parts.append(section_text)
        section_records.append(
            {
                "sectionIndex": section["sectionIndex"],
                "sectionTitle": section_title,
                "sectionPath": section_path,
                "sectionLevel": section["sectionLevel"],
                "text": section_text,
            }
        )

    if not section_records:
        fallback_text = normalize_whitespace(document_title)
        if not fallback_text:
            raise RuntimeError("The Google Doc did not return any readable text.")
        section_records.append(
            {
                "sectionIndex": 0,
                "sectionTitle": "Overview",
                "sectionPath": default_path,
                "sectionLevel": 0,
                "text": fallback_text,
            }
        )
        document_parts.append(fallback_text)

    document_text = "\n\n".join(document_parts).strip()
    return document_title, section_records


def fetch_google_doc(state: MaterialLoadState) -> MaterialLoadState:
    docs_url = state["docs_url"]
    document_id = extract_document_id(docs_url)
    docs_client = build_docs_client()
    document = docs_client.documents().get(documentId=document_id).execute()
    document_title, sections = extract_document_sections(document)
    document_text = "\n\n".join(section["text"] for section in sections).strip()

    if not document_text:
        raise RuntimeError("The Google Doc did not return any readable text.")

    return {
        **state,
        "document_id": document_id,
        "document_title": document_title,
        "document_text": document_text,
        "sections": sections,
    }


def split_document(state: MaterialLoadState) -> MaterialLoadState:
    chunk_size = int(os.getenv("MATERIAL_LOAD_CHUNK_SIZE", "200"))
    chunk_overlap = int(os.getenv("MATERIAL_LOAD_CHUNK_OVERLAP", "20"))
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

    chunk_records: List[Dict[str, Any]] = []
    chunk_index = 0
    for section in state.get("sections", []):
        section_chunks = [
            chunk.strip()
            for chunk in splitter.split_text(section["text"])
            if chunk.strip()
        ]
        for local_index, chunk_text in enumerate(section_chunks):
            chunk_records.append(
                {
                    "chunkIndex": chunk_index,
                    "sectionChunkIndex": local_index,
                    "sectionIndex": section["sectionIndex"],
                    "sectionTitle": section["sectionTitle"],
                    "sectionPath": " > ".join(section["sectionPath"]),
                    "sectionLevel": section["sectionLevel"],
                    "text": chunk_text,
                }
            )
            chunk_index += 1

    if not chunk_records:
        raise RuntimeError("No chunks were generated from the document text.")

    return {
        **state,
        "chunk_records": chunk_records,
    }


def embed_chunks(state: MaterialLoadState) -> MaterialLoadState:
    api_key = require_env("OPENAI_API_KEY")
    model_name = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
    embedding_dim = int(os.getenv("OPENAI_EMBED_DIM", "1536"))
    batch_size = int(os.getenv("MATERIAL_LOAD_EMBED_BATCH_SIZE", "32"))
    openai_client = OpenAI(api_key=api_key)

    chunk_records = [dict(record) for record in state.get("chunk_records", [])]
    for batch in chunk_list(chunk_records, batch_size):
        embedding_response = openai_client.embeddings.create(
            model=model_name,
            input=[record["text"] for record in batch],
            dimensions=embedding_dim,
        )

        for record, item in zip(batch, embedding_response.data):
            if len(item.embedding) != embedding_dim:
                raise RuntimeError(
                    f"Embedding dimension mismatch for chunk {record['chunkIndex']}: "
                    f"expected {embedding_dim}, got {len(item.embedding)}"
                )
            record["embedding"] = item.embedding

    return {
        **state,
        "chunk_records": chunk_records,
    }


def average_link_similarity(
    cluster_a: Sequence[int],
    cluster_b: Sequence[int],
    similarity_matrix: Sequence[Sequence[float]],
) -> float:
    total = 0.0
    comparisons = 0
    for index_a in cluster_a:
        for index_b in cluster_b:
            total += similarity_matrix[index_a][index_b]
            comparisons += 1
    if comparisons == 0:
        return 0.0
    return total / comparisons


def agglomerative_cluster_indices(
    indices: List[int],
    similarity_matrix: Sequence[Sequence[float]],
    merge_threshold: float,
) -> List[List[int]]:
    clusters = [[index] for index in indices]
    if len(clusters) <= 1:
        return clusters

    while True:
        best_pair: Optional[Tuple[int, int]] = None
        best_score = merge_threshold

        for left_index in range(len(clusters)):
            for right_index in range(left_index + 1, len(clusters)):
                score = average_link_similarity(
                    clusters[left_index],
                    clusters[right_index],
                    similarity_matrix,
                )
                if score > best_score:
                    best_score = score
                    best_pair = (left_index, right_index)

        if best_pair is None:
            break

        left_index, right_index = best_pair
        merged = clusters[left_index] + clusters[right_index]
        clusters[left_index] = sorted(merged)
        clusters.pop(right_index)

    return [sorted(cluster) for cluster in clusters]


def merge_small_clusters(
    clusters: List[List[int]],
    chunk_records: Sequence[Dict[str, Any]],
    min_cluster_size: int,
    min_similarity_to_merge: float,
) -> List[List[int]]:
    if len(clusters) <= 1:
        return clusters

    working = [sorted(cluster) for cluster in clusters]

    while True:
        small_cluster_index = next(
            (index for index, cluster in enumerate(working) if len(cluster) < min_cluster_size),
            None,
        )
        if small_cluster_index is None:
            break

        source_cluster = working[small_cluster_index]
        source_centroid = average_embeddings(
            [chunk_records[index]["embedding"] for index in source_cluster]
        )

        best_target_index = None
        best_score = min_similarity_to_merge

        for target_index, candidate_cluster in enumerate(working):
            if target_index == small_cluster_index:
                continue
            candidate_centroid = average_embeddings(
                [chunk_records[index]["embedding"] for index in candidate_cluster]
            )
            similarity = cosine_similarity(source_centroid, candidate_centroid)
            if similarity > best_score:
                best_score = similarity
                best_target_index = target_index

        if best_target_index is None:
            break

        working[best_target_index] = sorted(working[best_target_index] + source_cluster)
        working.pop(small_cluster_index)

    return [sorted(cluster) for cluster in working]


def derive_cluster_label(cluster_chunks: Sequence[Dict[str, Any]]) -> str:
    titles: Dict[str, int] = {}
    for chunk in cluster_chunks:
        title = normalize_whitespace(chunk.get("sectionTitle", ""))
        if title and title.lower() != "overview":
            titles[title] = titles.get(title, 0) + 1

    if titles:
        return sorted(titles.items(), key=lambda item: (-item[1], len(item[0])))[0][0]

    sample_text = cluster_chunks[0].get("text", "")
    sentence = re.split(r"[.!?]\s+", sample_text, maxsplit=1)[0].strip()
    sentence = truncate_words(sentence or sample_text, 10)
    return sentence or "Cluster"


def summarize_cluster(
    cluster_id: str,
    label: str,
    strategy: str,
    cluster_chunks: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    section_titles: List[str] = []
    seen_titles = set()
    for chunk in cluster_chunks:
        title = normalize_whitespace(chunk.get("sectionTitle", ""))
        if title and title not in seen_titles:
            section_titles.append(title)
            seen_titles.add(title)
        if len(section_titles) >= 3:
            break

    representative = truncate_words(cluster_chunks[0].get("text", ""), 28)

    return {
        "clusterId": cluster_id,
        "label": label,
        "strategy": strategy,
        "chunkCount": len(cluster_chunks),
        "sectionTitles": section_titles,
        "sampleText": representative,
        "firstChunkIndex": cluster_chunks[0]["chunkIndex"],
        "lastChunkIndex": cluster_chunks[-1]["chunkIndex"],
    }


def cluster_chunks(state: MaterialLoadState) -> MaterialLoadState:
    chunk_records = [dict(record) for record in state.get("chunk_records", [])]
    if not chunk_records:
        raise RuntimeError("No chunk records available for clustering.")

    embeddings = [record["embedding"] for record in chunk_records]
    similarity_matrix = [
        [cosine_similarity(embeddings[row], embeddings[column]) for column in range(len(embeddings))]
        for row in range(len(embeddings))
    ]

    topic_hints = topic_hints_from_env()
    topic_candidates = build_topic_candidates(topic_hints)
    topic_match_threshold = float(os.getenv("MATERIAL_LOAD_TOPIC_MATCH_THRESHOLD", "0.38"))
    merge_threshold = float(os.getenv("MATERIAL_LOAD_CLUSTER_MERGE_THRESHOLD", "0.76"))
    min_cluster_size = int(os.getenv("MATERIAL_LOAD_MIN_CLUSTER_SIZE", "2"))
    min_similarity_to_merge_small = float(
        os.getenv("MATERIAL_LOAD_MIN_SIMILARITY_TO_MERGE_SMALL_CLUSTER", "0.62")
    )

    assigned_clusters: List[Tuple[str, str, str, List[int]]] = []
    assigned_chunk_indexes = set()

    if topic_candidates:
        api_key = require_env("OPENAI_API_KEY")
        model_name = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
        embedding_dim = int(os.getenv("OPENAI_EMBED_DIM", "1536"))
        openai_client = OpenAI(api_key=api_key)

        label_embeddings_response = openai_client.embeddings.create(
            model=model_name,
            input=[candidate["label"] for candidate in topic_candidates],
            dimensions=embedding_dim,
        )
        label_embeddings = {
            candidate["label"]: item.embedding
            for candidate, item in zip(topic_candidates, label_embeddings_response.data)
        }

        hint_groups: Dict[str, Dict[str, Any]] = {}
        for chunk_index, record in enumerate(chunk_records):
            best_candidate: Optional[Dict[str, str]] = None
            best_score = topic_match_threshold
            for candidate in topic_candidates:
                score = cosine_similarity(record["embedding"], label_embeddings[candidate["label"]])
                if score > best_score:
                    best_score = score
                    best_candidate = candidate

            if not best_candidate:
                continue

            label = best_candidate["label"]
            if label not in hint_groups:
                hint_groups[label] = {
                    "label": label,
                    "strategy": best_candidate["strategy"],
                    "indices": [],
                }
            hint_groups[label]["indices"].append(chunk_index)
            assigned_chunk_indexes.add(chunk_index)

        for label, group in sorted(hint_groups.items(), key=lambda item: min(item[1]["indices"])):
            assigned_clusters.append(
                (
                    slugify(label),
                    label,
                    group["strategy"],
                    sorted(group["indices"]),
                )
            )

    remaining_indices = [
        index for index in range(len(chunk_records)) if index not in assigned_chunk_indexes
    ]
    unsupervised_clusters = agglomerative_cluster_indices(
        remaining_indices,
        similarity_matrix,
        merge_threshold,
    )
    unsupervised_clusters = merge_small_clusters(
        unsupervised_clusters,
        chunk_records,
        min_cluster_size,
        min_similarity_to_merge_small,
    )

    unique_ids = {cluster_id for cluster_id, _, _, _ in assigned_clusters}
    cluster_summary: List[Dict[str, Any]] = []

    def next_unique_cluster_id(base_label: str, cluster_number: int) -> str:
        candidate = slugify(base_label)
        if not candidate:
            candidate = f"cluster-{cluster_number}"
        if candidate not in unique_ids:
            unique_ids.add(candidate)
            return candidate

        suffix = 2
        while f"{candidate}-{suffix}" in unique_ids:
            suffix += 1
        candidate = f"{candidate}-{suffix}"
        unique_ids.add(candidate)
        return candidate

    combined_clusters: List[Tuple[str, str, str, List[int]]] = list(assigned_clusters)
    for cluster_number, member_indices in enumerate(unsupervised_clusters, start=1):
        if not member_indices:
            continue
        cluster_chunks = [chunk_records[index] for index in member_indices]
        label = derive_cluster_label(cluster_chunks)
        cluster_id = next_unique_cluster_id(label, cluster_number)
        combined_clusters.append((cluster_id, label, "semantic-agglomerative", sorted(member_indices)))

    combined_clusters.sort(key=lambda cluster: min(cluster[3]) if cluster[3] else 0)

    for cluster_rank, (cluster_id, label, strategy, member_indices) in enumerate(combined_clusters):
        cluster_chunks = [chunk_records[index] for index in member_indices]
        cluster_chunks.sort(key=lambda chunk: chunk["chunkIndex"])
        summary = summarize_cluster(cluster_id, label, strategy, cluster_chunks)
        summary["clusterRank"] = cluster_rank
        cluster_summary.append(summary)

        for record in cluster_chunks:
            record["clusterId"] = cluster_id
            record["clusterLabel"] = label
            record["clusterStrategy"] = strategy
            record["clusterRank"] = cluster_rank

    return {
        **state,
        "chunk_records": chunk_records,
        "cluster_summary": cluster_summary,
    }


def upsert_clusters(state: MaterialLoadState) -> MaterialLoadState:
    model_name = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
    embedding_dim = int(os.getenv("OPENAI_EMBED_DIM", "1536"))
    pinecone_api_key = require_env("PINECONE_API_KEY")
    index_name = require_env("PINECONE_INDEX_NAME")
    namespace = os.getenv("PINECONE_NAMESPACE", "").strip()

    pinecone = Pinecone(api_key=pinecone_api_key)
    index = pinecone.Index(index_name)

    vectors = []
    for record in state.get("chunk_records", []):
        vectors.append(
            {
                "id": f"{state['document_id']}_{record['chunkIndex']}",
                "values": record["embedding"],
                "metadata": {
                    "documentId": state["document_id"],
                    "documentTitle": state["document_title"],
                    "sourceUrl": state["docs_url"],
                    "userId": state.get("user_id", ""),
                    "syllabusId": state.get("syllabus_id", ""),
                    "chunkIndex": record["chunkIndex"],
                    "sectionChunkIndex": record["sectionChunkIndex"],
                    "sectionIndex": record["sectionIndex"],
                    "sectionTitle": record["sectionTitle"],
                    "sectionPath": record["sectionPath"],
                    "sectionLevel": record["sectionLevel"],
                    "clusterId": record.get("clusterId", ""),
                    "clusterLabel": record.get("clusterLabel", ""),
                    "clusterStrategy": record.get("clusterStrategy", ""),
                    "clusterRank": record.get("clusterRank", -1),
                    "text": record["text"][:8000],
                    "embeddingModel": model_name,
                    "embeddingDim": embedding_dim,
                    "sourceType": "google-doc",
                },
            }
        )

    if namespace:
        index.upsert(vectors=vectors, namespace=namespace)
    else:
        index.upsert(vectors=vectors)

    cluster_summary = sorted(
        state.get("cluster_summary", []),
        key=lambda item: (-item["chunkCount"], item["label"].lower()),
    )

    return {
        **state,
        "upsert_count": len(vectors),
        "namespace": namespace,
        "result": {
            "documentId": state["document_id"],
            "documentTitle": state["document_title"],
            "sourceUrl": state["docs_url"],
            "syllabusId": state.get("syllabus_id", ""),
            "chunksCreated": len(vectors),
            "embeddingModel": model_name,
            "embeddingDim": embedding_dim,
            "pineconeIndex": index_name,
            "namespace": namespace or "(default)",
            "clusteringEnabled": True,
            "clusteringStrategy": "hybrid-semantic",
            "clustersCreated": len(cluster_summary),
            "sectionCount": len(state.get("sections", [])),
            "clusterSummary": cluster_summary,
        },
    }


def build_graph():
    graph = StateGraph(MaterialLoadState)
    graph.add_node("fetch_google_doc", fetch_google_doc)
    graph.add_node("split_document", split_document)
    graph.add_node("embed_chunks", embed_chunks)
    graph.add_node("cluster_chunks", cluster_chunks)
    graph.add_node("upsert_clusters", upsert_clusters)

    graph.set_entry_point("fetch_google_doc")
    graph.add_edge("fetch_google_doc", "split_document")
    graph.add_edge("split_document", "embed_chunks")
    graph.add_edge("embed_chunks", "cluster_chunks")
    graph.add_edge("cluster_chunks", "upsert_clusters")
    graph.add_edge("upsert_clusters", END)

    return graph.compile()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest a Google Doc into Pinecone using a LangGraph workflow.")
    parser.add_argument("--docs-url", required=True, help="Google Docs URL to ingest")
    parser.add_argument("--user-id", default="", help="Optional user identifier stored in Pinecone metadata")
    parser.add_argument("--syllabus-id", default="", help="Optional syllabus identifier stored in Pinecone metadata")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    workflow = build_graph()
    result = workflow.invoke(
        {
            "docs_url": args.docs_url,
            "user_id": args.user_id,
            "syllabus_id": args.syllabus_id,
        }
    )
    sys.stdout.write(json.dumps(result.get("result", {})) + "\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # pragma: no cover - CLI safety path
        sys.stderr.write(str(error).strip() + "\n")
        raise SystemExit(1)
