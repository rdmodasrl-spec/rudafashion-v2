-- Enable pgvector extension in PostgreSQL before creating vector columns and HNSW indexes
CREATE EXTENSION IF NOT EXISTS vector;