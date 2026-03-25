export function renderReviewPanel(words, cleanedText, originalText) {
  const originalWords = (originalText || '').split(/\s+/).filter(Boolean);
  const cleanedWords = (cleanedText || '').split(/\s+/).filter(Boolean);
  const lcs = computeLCS(originalWords, cleanedWords);

  const originalHtml = originalWords.map((w, i) => {
    const isRemoved = !lcs.originalKept.has(i);
    return `<span class="${isRemoved ? 'word-removed' : 'word-kept'}">${w}</span>`;
  }).join(' ');

  const cleanedHtml = (words || []).map((w, i) => {
    const conf = w.confidence || 0;
    let cls = 'conf-high';
    if (conf < 0.4) cls = 'conf-low';
    else if (conf < 0.8) cls = 'conf-mid';
    return `<span class="word-chip ${cls}" data-index="${i}" data-start="${w.start}" data-end="${w.end}" contenteditable="false">${w.word}</span>`;
  }).join(' ');

  return { originalHtml, cleanedHtml };
}

function computeLCS(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const originalKept = new Set();
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { originalKept.add(i - 1); i--; j--; }
    else if (dp[i - 1][j] > dp[i][j - 1]) i--;
    else j--;
  }
  return { originalKept };
}

export function setupKaraokeMode(audioPlayer, wordsContainer) {
  let animFrame;
  function updateHighlight() {
    const currentTime = audioPlayer.currentTime;
    const chips = wordsContainer.querySelectorAll('.word-chip');
    chips.forEach(chip => {
      const start = parseFloat(chip.dataset.start);
      const end = parseFloat(chip.dataset.end);
      chip.classList.toggle('word-highlight', currentTime >= start && currentTime <= end);
      chip.classList.toggle('word-past', currentTime > end);
    });
    if (!audioPlayer.paused) animFrame = requestAnimationFrame(updateHighlight);
  }
  audioPlayer.addEventListener('play', () => { animFrame = requestAnimationFrame(updateHighlight); });
  audioPlayer.addEventListener('pause', () => cancelAnimationFrame(animFrame));
  audioPlayer.addEventListener('seeked', updateHighlight);
}

export function setupWordEditing(wordsContainer, onEdit) {
  wordsContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.word-chip');
    if (!chip) return;
    chip.contentEditable = 'true';
    chip.focus();
  });
  wordsContainer.addEventListener('blur', (e) => {
    const chip = e.target.closest('.word-chip');
    if (!chip) return;
    chip.contentEditable = 'false';
    const index = parseInt(chip.dataset.index);
    const newWord = chip.textContent.trim();
    if (onEdit) onEdit(index, newWord);
  }, true);
}
