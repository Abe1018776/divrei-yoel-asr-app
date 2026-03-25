import { loadFromSupabase } from './db.js';

const STATE_KEY = 'divrei-yoel-asr-state';

let state = {
  audio: [], transcripts: [], mappings: {}, cleaning: {},
  alignments: {}, reviews: {}, trims: {}, audioNames: {}, asrModels: []
};

export function getState() { return state; }

export function initState(catalog) {
  state.audio = catalog.audio || [];
  state.transcripts = catalog.transcripts || [];
  const cached = localStorage.getItem(STATE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      Object.assign(state, parsed, { audio: state.audio, transcripts: state.transcripts });
    } catch (e) { console.warn('Invalid cached state'); }
  }
}

export function mergeSupabaseData(remote) {
  for (const m of (remote.mappings || [])) {
    state.mappings[m.audio_id] = {
      transcriptId: m.transcript_id, confidence: m.confidence,
      matchReason: m.match_reason, confirmedBy: m.confirmed_by
    };
  }
  for (const a of (remote.alignments || [])) {
    state.alignments[a.audio_id] = {
      avgConfidence: a.avg_confidence, lowConfidenceCount: a.low_confidence_count, alignedAt: a.aligned_at
    };
  }
  for (const r of (remote.reviews || [])) {
    state.reviews[r.audio_id] = {
      status: r.status, editedText: r.edited_text, reviewedAt: r.reviewed_at
    };
  }
  for (const e of (remote.edits || [])) {
    if (e.version === 'cleaned') {
      state.cleaning[e.audio_id] = {
        cleanedText: e.text, originalText: e.original_text, cleanRate: e.clean_rate
      };
    }
  }
  for (const a of state.audio) {
    if (a.trim_start || a.trim_end) {
      state.trims[a.id] = { start: a.trim_start || 0, end: a.trim_end || 0 };
    }
  }
  saveLocal();
}

export function updateState(key, id, value) {
  if (!state[key]) state[key] = {};
  state[key][id] = value;
  saveLocal();
}

function saveLocal() {
  const toSave = {
    mappings: state.mappings, cleaning: state.cleaning, alignments: state.alignments,
    reviews: state.reviews, trims: state.trims, audioNames: state.audioNames, asrModels: state.asrModels
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(toSave));
}

export function exportState() { return JSON.stringify(state, null, 2); }

export function importState(json) {
  try {
    const imported = JSON.parse(json);
    Object.assign(state, imported);
    saveLocal();
    return true;
  } catch (e) { console.error('Import failed:', e); return false; }
}
