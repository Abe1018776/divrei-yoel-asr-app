# Divrei Yoel ASR Workbench

Yiddish ASR workbench for Rabbi Yoel (Satmar Rebbe) recordings. Modeled after the JEM ASR App architecture but as a completely separate project. Do NOT modify the jem-asr-app repo.

## Tech Stack

- **Frontend:** Vanilla JS + Vite (no framework), RTL Hebrew/Yiddish
- **Database:** Supabase PostgreSQL (project ref: `yfxhvmajmklxandwugts`, AI Torah Initiative Pro plan)
- **Hosting:** Cloudflare Pages (`divrei-yoel-asr-app.pages.dev`)
- **API:** Cloudflare Workers (4 serverless endpoints under `functions/api/`)
- **Storage:** Cloudflare R2 for audio + transcripts
- **Video Export:** FFmpeg.wasm in-browser for MP4 generation with karaoke subtitles

## Project Structure

```
divrei-yoel-asr-app/
├── index.html              # Main table view
├── detail.html             # Per-file detail/review page + video export
├── login.html              # Supabase email/password auth
├── style.css               # All styling (RTL, Torah-themed colors)
├── vite.config.js          # Multi-page Vite build
├── wrangler.toml           # Cloudflare Pages config
├── src/
│   ├── app.js              # Main entry point (index.html)
│   ├── detail.js           # Detail page entry point
│   ├── auth.js             # Supabase client + auth (shared)
│   ├── state.js            # State management (localStorage + Supabase sync)
│   ├── db.js               # Supabase CRUD helpers with pagination
│   ├── table.js            # Data table rendering, filtering, bulk actions
│   ├── mapping.js          # Audio ↔ transcript matching by date/type
│   ├── cleaning.js         # 9-pass Yiddish text cleaning
│   ├── alignment.js        # Word-level timestamps via GPU (align.kohnai.ai)
│   ├── review.js           # Human verification UI, karaoke mode, word editing
│   ├── video-export.js     # MP4 export using FFmpeg.wasm
│   ├── karaoke-subtitles.js # ASS subtitle generation with \kf timing
│   ├── background-design.js # Canvas-based video background templates
│   └── utils.js            # Hebrew months, formatting, pipeline status
├── functions/api/
│   ├── align.js            # POST /api/align → proxy to align.kohnai.ai
│   ├── audio.js            # GET /api/audio → stream from R2 with CORS
│   ├── transcript.js       # GET /api/transcript → stream text from R2
│   └── transcribe.js       # POST /api/transcribe → Gemini/YiddishLabs/Whisper
├── supabase/migrations/
│   └── 20260325000000_initial_schema.sql  # Complete schema (8 tables, views, RLS)
└── scripts/
    └── seed-samples.mjs    # Import sample data from maatikei-hashmua
```

## Database Schema

8 tables: `audio_files`, `transcripts`, `mappings`, `alignments`, `reviews`, `transcript_edits`, `asr_models`, `benchmark_results`
2 views: `audio_pipeline_status`, `latest_edits`
RLS: All tables authenticated-only. No anonymous access.

## Pipeline Stages

```
unmapped → mapped → cleaned → aligned → approved
```

Each audio file progresses through these stages. Status is derived from which tables have data for that audio_id.

## Key Conventions

- Audio file IDs: `a_1`, `a_2`, etc.
- Transcript IDs: `t_1`, `t_2`, etc.
- Transcript versions in `transcript_edits`: `'cleaned'`, `'edited'`, `'asr-gemini'`, `'asr-whisper'`, `'asr-yiddish-labs'`
- Word alignment format: `{word, start, end, confidence}` in JSONB
- Hebrew dates: year (5710-5752), month (1-12 = Nissan-Adar), day
- Text cleaning preserves abbreviation quotes (e.g., בס"ד)

## Environment Variables

```
VITE_SUPABASE_URL=https://yfxhvmajmklxandwugts.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Cloudflare Worker secrets (set via wrangler): `GEMINI_API_KEY`, `YL_API_KEY`, `GEMINI_SA_JSON`

## Build & Deploy

```bash
npm run dev          # Local dev server
npm run build        # Production build → dist/
CLOUDFLARE_API_TOKEN=... npx wrangler pages deploy dist --project-name divrei-yoel-asr-app --branch main
```

## Video Export Feature (unique to this app)

The detail page includes an MP4 video export with:
- Snippet selection (start/end time)
- 4 background templates: gradient-blue, gradient-gold, dark-elegant, parchment
- Karaoke-mode ASS subtitles with word-by-word highlight timing
- FFmpeg.wasm runs entirely in-browser (no server needed)
- Output: MP4 with static background image + audio track + animated subtitles

## Sample Data

2 recordings from `maatikei-hashmua/2_sample_sets_to_test_on/`:
- Hoshana Rabba 5710 (a_1 ↔ t_1)
- Vaeschanan Sharon Springs 5727 (a_2 ↔ t_2, includes word-level alignment)
