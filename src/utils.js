export const HEBREW_MONTHS = [
  'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול',
  'תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר'
];

export function formatDuration(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function truncate(str, len = 50) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function getPipelineStatus(audioId, state) {
  if (state.reviews[audioId]?.status === 'approved') return 'approved';
  if (state.reviews[audioId]?.status === 'rejected') return 'rejected';
  if (state.alignments[audioId]) return 'aligned';
  if (state.cleaning[audioId]) return 'cleaned';
  if (state.mappings[audioId]) return 'mapped';
  return 'unmapped';
}

export function statusBadgeClass(status) {
  const map = {
    unmapped: 'badge-gray', mapped: 'badge-blue', cleaned: 'badge-yellow',
    aligned: 'badge-orange', approved: 'badge-green', rejected: 'badge-red'
  };
  return map[status] || 'badge-gray';
}
