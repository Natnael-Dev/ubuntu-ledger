-- Migration 013: AI Extensions (pg_trgm and pgvector)
-- Authoritative source: T-AI-010 / T-AI-011
-- Strictly assistive extensions for NLP similarity, fuzzy text matching, and vector embeddings.
-- Has zero impact on the core deterministic ledger (INV-01, k-anonymity, audit chain).

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
