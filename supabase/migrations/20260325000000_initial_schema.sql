-- ================================================
-- Divrei Yoel ASR Workbench - Initial Schema
-- Mirrors JEM ASR App database structure
-- ================================================

-- 1. Audio files table
CREATE TABLE IF NOT EXISTS audio_files (
  id TEXT PRIMARY KEY,
  name TEXT,
  r2_link TEXT,
  drive_link TEXT,
  year INTEGER,
  month INTEGER,
  day INTEGER,
  type TEXT,
  duration_minutes FLOAT,
  is_selected_50hr BOOLEAN DEFAULT false,
  is_benchmark BOOLEAN DEFAULT false,
  comments TEXT,
  trim_start FLOAT,
  trim_end FLOAT,
  name_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Transcripts table
CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  name TEXT,
  year INTEGER,
  month INTEGER,
  day INTEGER,
  first_line TEXT,
  text TEXT,
  drive_link TEXT,
  r2_transcript_link TEXT,
  source_transcript_id TEXT REFERENCES transcripts(id),
  name_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Mappings table (audio <-> transcript links)
CREATE TABLE IF NOT EXISTS mappings (
  audio_id TEXT PRIMARY KEY REFERENCES audio_files(id) ON DELETE CASCADE,
  transcript_id TEXT REFERENCES transcripts(id),
  confidence FLOAT,
  match_reason TEXT,
  confirmed_by TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Alignments table (word-level timestamps)
CREATE TABLE IF NOT EXISTS alignments (
  audio_id TEXT PRIMARY KEY REFERENCES audio_files(id) ON DELETE CASCADE,
  words JSONB,
  avg_confidence FLOAT,
  low_confidence_count INTEGER,
  aligned_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Reviews table (human approval)
CREATE TABLE IF NOT EXISTS reviews (
  audio_id TEXT PRIMARY KEY REFERENCES audio_files(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('approved', 'rejected', 'skipped')),
  edited_text TEXT,
  reviewed_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Transcript edits (versioned text)
CREATE TABLE IF NOT EXISTS transcript_edits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  audio_id TEXT REFERENCES audio_files(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  text TEXT,
  original_text TEXT,
  clean_rate INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'system',
  UNIQUE(audio_id, version)
);

-- 7. ASR models configuration
CREATE TABLE IF NOT EXISTS asr_models (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Benchmark results
CREATE TABLE IF NOT EXISTS benchmark_results (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  audio_id TEXT REFERENCES audio_files(id),
  model_name TEXT,
  wer FLOAT,
  cer FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ================================================
-- Views
-- ================================================

-- Audio pipeline status view
CREATE OR REPLACE VIEW audio_pipeline_status AS
SELECT
  a.id,
  a.name,
  a.year,
  a.month,
  a.day,
  a.type,
  a.duration_minutes,
  a.is_selected_50hr,
  a.is_benchmark,
  m.transcript_id,
  m.confidence AS mapping_confidence,
  al.avg_confidence AS alignment_confidence,
  al.low_confidence_count,
  r.status AS review_status,
  CASE
    WHEN r.status = 'approved' THEN 'approved'
    WHEN r.status = 'rejected' THEN 'rejected'
    WHEN al.audio_id IS NOT NULL THEN 'aligned'
    WHEN te.audio_id IS NOT NULL THEN 'cleaned'
    WHEN m.audio_id IS NOT NULL THEN 'mapped'
    ELSE 'unmapped'
  END AS pipeline_status
FROM audio_files a
LEFT JOIN mappings m ON m.audio_id = a.id
LEFT JOIN alignments al ON al.audio_id = a.id
LEFT JOIN reviews r ON r.audio_id = a.id
LEFT JOIN (
  SELECT DISTINCT audio_id FROM transcript_edits WHERE version = 'cleaned'
) te ON te.audio_id = a.id;

-- Latest edits view
CREATE OR REPLACE VIEW latest_edits AS
SELECT DISTINCT ON (audio_id)
  id, audio_id, version, text, original_text, clean_rate, created_at, created_by
FROM transcript_edits
ORDER BY audio_id, created_at DESC;

-- ================================================
-- Name history tracking triggers
-- ================================================

CREATE OR REPLACE FUNCTION track_name_history()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    NEW.name_history = COALESCE(NEW.name_history, '[]'::jsonb) ||
      jsonb_build_object('name', OLD.name, 'changed_at', now());
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audio_files_name_history
  BEFORE UPDATE ON audio_files
  FOR EACH ROW
  WHEN (NEW.name IS DISTINCT FROM OLD.name)
  EXECUTE FUNCTION track_name_history();

CREATE TRIGGER transcripts_name_history
  BEFORE UPDATE ON transcripts
  FOR EACH ROW
  WHEN (NEW.name IS DISTINCT FROM OLD.name)
  EXECUTE FUNCTION track_name_history();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audio_files_updated_at
  BEFORE UPDATE ON audio_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER transcripts_updated_at
  BEFORE UPDATE ON transcripts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ================================================
-- Row Level Security (RLS)
-- ================================================

ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE asr_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_results ENABLE ROW LEVEL SECURITY;

-- Authenticated-only policies
CREATE POLICY "auth_read_audio" ON audio_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_audio" ON audio_files FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_audio" ON audio_files FOR UPDATE TO authenticated USING (true);

CREATE POLICY "auth_read_transcripts" ON transcripts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_transcripts" ON transcripts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_transcripts" ON transcripts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "auth_read_mappings" ON mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_mappings" ON mappings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_mappings" ON mappings FOR UPDATE TO authenticated USING (true);

CREATE POLICY "auth_read_alignments" ON alignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_alignments" ON alignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_alignments" ON alignments FOR UPDATE TO authenticated USING (true);

CREATE POLICY "auth_read_reviews" ON reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_reviews" ON reviews FOR UPDATE TO authenticated USING (true);

CREATE POLICY "auth_read_edits" ON transcript_edits FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_edits" ON transcript_edits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_edits" ON transcript_edits FOR UPDATE TO authenticated USING (true);

CREATE POLICY "auth_all_asr_models" ON asr_models FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_all_benchmarks" ON benchmark_results FOR ALL TO authenticated USING (true);

-- ================================================
-- Indexes for performance
-- ================================================

CREATE INDEX IF NOT EXISTS idx_audio_files_year ON audio_files(year);
CREATE INDEX IF NOT EXISTS idx_audio_files_type ON audio_files(type);
CREATE INDEX IF NOT EXISTS idx_audio_files_selected ON audio_files(is_selected_50hr) WHERE is_selected_50hr = true;
CREATE INDEX IF NOT EXISTS idx_transcripts_year ON transcripts(year);
CREATE INDEX IF NOT EXISTS idx_mappings_transcript ON mappings(transcript_id);
CREATE INDEX IF NOT EXISTS idx_edits_audio ON transcript_edits(audio_id);
CREATE INDEX IF NOT EXISTS idx_edits_audio_version ON transcript_edits(audio_id, version);
CREATE INDEX IF NOT EXISTS idx_benchmarks_audio ON benchmark_results(audio_id);
