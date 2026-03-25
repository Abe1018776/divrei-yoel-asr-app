import { checkAuth, signOut } from './auth.js';
import { loadFromSupabase } from './db.js';
import { initState, mergeSupabaseData, getState, exportState, importState } from './state.js';
import { renderTable, setupFilters, updateBadges } from './table.js';
import { getPipelineStatus } from './utils.js';

async function init() {
  const session = await checkAuth();
  if (!session) return;

  document.getElementById('table-body').innerHTML = '<tr><td colspan="11">Loading...</td></tr>';

  const remote = await loadFromSupabase();
  initState(remote);
  mergeSupabaseData(remote);
  renderTable();
  setupFilters();
  updateBadges();

  document.getElementById('btn-sign-out').addEventListener('click', signOut);

  document.getElementById('btn-export-state').addEventListener('click', () => {
    const blob = new Blob([exportState()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'divrei-yoel-state.json'; a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    const state = getState();
    const rows = [['ID','Name','Year','Month','Day','Type','Duration','Status','Transcript'].join(',')];
    for (const a of state.audio) {
      const mapping = state.mappings[a.id];
      const transcript = mapping ? state.transcripts.find(t => t.id === mapping.transcriptId) : null;
      const status = getPipelineStatus(a.id, state);
      rows.push([a.id, `"${a.name||''}"`, a.year, a.month, a.day, a.type||'', a.duration_minutes||'', status, `"${transcript?.name||''}"`].join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'divrei-yoel-export.csv'; a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-import-state').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      if (importState(text)) { renderTable(); updateBadges(); }
    };
    input.click();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.ctrlKey) {
      e.preventDefault();
      document.getElementById('filter-search').focus();
    }
  });
}

init();
