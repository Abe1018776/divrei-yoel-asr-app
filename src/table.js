import { getState, updateState } from './state.js';
import { getPipelineStatus, statusBadgeClass, HEBREW_MONTHS, formatDuration, truncate, debounce } from './utils.js';
import { syncMapping } from './db.js';
import { getSuggestedMatches } from './mapping.js';

let currentFilter = 'all';
let yearFilter = '';
let monthFilter = '';
let typeFilter = '';
let searchQuery = '';
let selectedIds = new Set();

export function renderTable() {
  const state = getState();
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  const filtered = filterAudio(state.audio, state);

  filtered.forEach((audio, index) => {
    const status = getPipelineStatus(audio.id, state);
    const mapping = state.mappings[audio.id];
    const transcript = mapping ? state.transcripts.find(t => t.id === mapping.transcriptId) : null;

    const tr = document.createElement('tr');
    tr.dataset.id = audio.id;
    tr.className = selectedIds.has(audio.id) ? 'selected' : '';
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td><input type="checkbox" class="row-select" data-id="${audio.id}" ${selectedIds.has(audio.id) ? 'checked' : ''}></td>
      <td class="name-cell">${audio.name || audio.id}</td>
      <td>${audio.year || ''}</td>
      <td>${audio.month ? HEBREW_MONTHS[audio.month - 1] || audio.month : ''}</td>
      <td>${audio.day || ''}</td>
      <td>${audio.type || ''}</td>
      <td>${formatDuration(audio.duration_minutes)}</td>
      <td><span class="badge ${statusBadgeClass(status)}">${status}</span></td>
      <td>${transcript ? truncate(transcript.name, 30) : '—'}</td>
      <td>${truncate(audio.comments, 20)}</td>`;

    tr.querySelector('.name-cell').addEventListener('click', () => {
      if (status === 'unmapped') toggleExpansion(audio, tr, state);
      else window.open(`/detail.html?id=${audio.id}`, '_blank');
    });

    tr.querySelector('.row-select').addEventListener('change', (e) => {
      if (e.target.checked) selectedIds.add(audio.id);
      else selectedIds.delete(audio.id);
      updateBulkActions();
    });

    tbody.appendChild(tr);
  });
}

function filterAudio(audioList, state) {
  return audioList.filter(a => {
    const status = getPipelineStatus(a.id, state);
    if (currentFilter !== 'all' && status !== currentFilter) return false;
    if (yearFilter && a.year != yearFilter) return false;
    if (monthFilter && a.month != monthFilter) return false;
    if (typeFilter && a.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (a.name || '').toLowerCase();
      const mapping = state.mappings[a.id];
      const tName = mapping ? (state.transcripts.find(t => t.id === mapping.transcriptId)?.name || '').toLowerCase() : '';
      if (!name.includes(q) && !tName.includes(q)) return false;
    }
    return true;
  });
}

function toggleExpansion(audio, tr, state) {
  const existing = tr.nextElementSibling;
  if (existing?.classList.contains('expansion-row')) { existing.remove(); return; }

  const suggestions = getSuggestedMatches(audio, state.transcripts);
  const expRow = document.createElement('tr');
  expRow.classList.add('expansion-row');
  expRow.innerHTML = `<td colspan="11" class="expansion-cell">
    <div class="expansion-content">
      <audio controls preload="none" src="${audio.r2_link || audio.drive_link || ''}"></audio>
      <h4>Suggested Transcripts:</h4>
      <ul class="suggestion-list">
        ${suggestions.slice(0, 5).map(s => `
          <li class="suggestion" data-tid="${s.transcript.id}" data-score="${s.score}" data-reason="${s.reason}">
            <strong>${s.transcript.name || s.transcript.id}</strong>
            <span class="score">${Math.round(s.score * 100)}%</span>
            <span class="reason">${s.reason}</span>
            <em>${truncate(s.transcript.first_line, 60)}</em>
          </li>`).join('')}
        ${suggestions.length === 0 ? '<li>No suggestions found</li>' : ''}
      </ul>
    </div>
  </td>`;

  expRow.querySelectorAll('.suggestion').forEach(li => {
    li.addEventListener('click', async () => {
      const tid = li.dataset.tid;
      const score = parseFloat(li.dataset.score);
      const reason = li.dataset.reason;
      updateState('mappings', audio.id, { transcriptId: tid, confidence: score, matchReason: reason, confirmedBy: 'user' });
      await syncMapping(audio.id, { transcriptId: tid, confidence: score, matchReason: reason, confirmedBy: 'user' });
      renderTable(); updateBadges();
    });
  });
  tr.after(expRow);
}

export function setupFilters() {
  const state = getState();
  const years = [...new Set(state.audio.map(a => a.year).filter(Boolean))].sort();
  const types = [...new Set(state.audio.map(a => a.type).filter(Boolean))].sort();

  const yearSelect = document.getElementById('filter-year');
  years.forEach(y => { yearSelect.innerHTML += `<option value="${y}">${y}</option>`; });
  const typeSelect = document.getElementById('filter-type');
  types.forEach(t => { typeSelect.innerHTML += `<option value="${t}">${t}</option>`; });
  const monthSelect = document.getElementById('filter-month');
  HEBREW_MONTHS.forEach((m, i) => { monthSelect.innerHTML += `<option value="${i + 1}">${m}</option>`; });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTable();
    });
  });

  yearSelect.addEventListener('change', (e) => { yearFilter = e.target.value; renderTable(); });
  monthSelect.addEventListener('change', (e) => { monthFilter = e.target.value; renderTable(); });
  typeSelect.addEventListener('change', (e) => { typeFilter = e.target.value; renderTable(); });

  document.getElementById('filter-search').addEventListener('input', debounce((e) => {
    searchQuery = e.target.value; renderTable();
  }));

  document.getElementById('select-all').addEventListener('change', (e) => {
    document.querySelectorAll('.row-select').forEach(cb => {
      cb.checked = e.target.checked;
      if (e.target.checked) selectedIds.add(cb.dataset.id);
      else selectedIds.delete(cb.dataset.id);
    });
    updateBulkActions();
  });
}

function updateBulkActions() {
  const bar = document.getElementById('bulk-actions');
  const count = document.getElementById('selected-count');
  if (selectedIds.size > 0) { bar.style.display = 'flex'; count.textContent = `${selectedIds.size} selected`; }
  else bar.style.display = 'none';
}

export function updateBadges() {
  const state = getState();
  const counts = { all: 0, unmapped: 0, mapped: 0, cleaned: 0, aligned: 0, approved: 0 };
  state.audio.forEach(a => { counts.all++; const s = getPipelineStatus(a.id, state); if (counts[s] !== undefined) counts[s]++; });
  Object.entries(counts).forEach(([key, val]) => { const b = document.getElementById(`badge-${key}`); if (b) b.textContent = val; });
}

export function getSelectedIds() { return [...selectedIds]; }
