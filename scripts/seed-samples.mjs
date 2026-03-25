/**
 * Seed script: imports sample data from maatikei-hashmua into Supabase.
 *
 * Usage:  node scripts/seed-samples.mjs
 */

import { readFileSync } from "fs";
import { join } from "path";

// ── Supabase config ──────────────────────────────────────────────
const SUPABASE_URL = "https://yfxhvmajmklxandwugts.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmeGh2bWFqbWtseGFuZHd1Z3RzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ2MTIyNCwiZXhwIjoyMDkwMDM3MjI0fQ.hOtG4bQvIt-Vbi_Jd5ydddy2MNQJWZfYnc1qDfPwT5c";

const SAMPLES_DIR =
  "C:/Users/ChezkyKohn/maatikei-hashmua/2_sample_sets_to_test_on";

// ── Helper: call Supabase REST API ───────────────────────────────
async function supabasePost(table, rows, { upsert = false } = {}) {
  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: upsert
      ? "resolution=merge-duplicates,return=representation"
      : "return=representation",
  };

  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(
      `POST ${table} failed (${res.status}): ${body}`
    );
  }
  return JSON.parse(body);
}

// ── Read sample files ────────────────────────────────────────────
function readSampleFile(subdir, filename) {
  return readFileSync(join(SAMPLES_DIR, subdir, filename), "utf-8");
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log("Reading sample files...");

  const transcript1 = readSampleFile("hoshana_rabba_5710", "transcript.txt");
  const transcript2 = readSampleFile(
    "vaeschanan_sharon_springs_5727",
    "transcript.txt"
  );

  // Check mendel_alignment.json
  let alignmentData = null;
  try {
    const raw = readSampleFile(
      "vaeschanan_sharon_springs_5727",
      "mendel_alignment.json"
    );
    alignmentData = JSON.parse(raw);
    console.log(
      `mendel_alignment.json: ${alignmentData.length} word-level entries`
    );
    console.log(
      "  Sample entry:",
      JSON.stringify(alignmentData[0])
    );
    const hasWordLevel = alignmentData.every(
      (w) =>
        typeof w.text === "string" &&
        typeof w.start === "number" &&
        typeof w.end === "number"
    );
    console.log(
      `  Contains word-level alignment data: ${hasWordLevel}`
    );
  } catch (err) {
    console.log("mendel_alignment.json not found or invalid:", err.message);
  }

  // ── 1. Insert audio_files ──────────────────────────────────────
  console.log("\nInserting audio_files...");
  const audioRows = [
    { id: "a_1", name: "Hoshana Rabba 5710", year: 5710, type: "sicha" },
    {
      id: "a_2",
      name: "Vaeschanan Sharon Springs 5727",
      year: 5727,
      type: "sicha",
    },
  ];
  const audioResult = await supabasePost("audio_files", audioRows, {
    upsert: true,
  });
  console.log(`  Inserted ${audioResult.length} audio_files rows.`);

  // ── 2. Insert transcripts ─────────────────────────────────────
  console.log("Inserting transcripts...");
  const transcriptRows = [
    {
      id: "t_1",
      name: "Hoshana Rabba 5710 Transcript",
      year: 5710,
      first_line: transcript1.slice(0, 100),
      text: transcript1,
    },
    {
      id: "t_2",
      name: "Vaeschanan Sharon Springs 5727 Transcript",
      year: 5727,
      first_line: transcript2.slice(0, 100),
      text: transcript2,
    },
  ];
  const transcriptResult = await supabasePost("transcripts", transcriptRows, {
    upsert: true,
  });
  console.log(`  Inserted ${transcriptResult.length} transcript rows.`);

  // ── 3. Insert mappings (audio <-> transcript) ─────────────────
  console.log("Inserting mappings...");
  const mappingRows = [
    {
      audio_id: "a_1",
      transcript_id: "t_1",
      confidence: 1.0,
      match_reason: "manual_seed",
    },
    {
      audio_id: "a_2",
      transcript_id: "t_2",
      confidence: 1.0,
      match_reason: "manual_seed",
    },
  ];
  const mappingResult = await supabasePost("mappings", mappingRows, {
    upsert: true,
  });
  console.log(`  Inserted ${mappingResult.length} mapping rows.`);

  // ── 4. Insert alignment for vaeschanan if available ────────────
  if (alignmentData) {
    console.log("Inserting alignment for vaeschanan...");
    const alignmentRow = [
      {
        audio_id: "a_2",
        words: alignmentData,
        avg_confidence: null,
        low_confidence_count: null,
      },
    ];
    const alignResult = await supabasePost("alignments", alignmentRow, {
      upsert: true,
    });
    console.log(`  Inserted ${alignResult.length} alignment row.`);
  }

  console.log("\nSeed complete!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
