export function getSuggestedMatches(audio, transcripts) {
  const scored = transcripts.map(t => {
    let score = 0;
    let reason = '';

    if (audio.year && t.year && audio.year === t.year) {
      if (audio.month && t.month && audio.month === t.month) {
        if (audio.day && t.day && audio.day === t.day) {
          score = 1.0; reason = 'exact date';
        } else { score = 0.5; reason = 'year+month'; }
      } else { score = 0.25; reason = 'year only'; }
    }

    if (audio.type && t.name) {
      const typeLower = audio.type.toLowerCase();
      const nameLower = t.name.toLowerCase();
      if (nameLower.includes(typeLower) ||
          (typeLower === 'sicha' && nameLower.includes('שיחה')) ||
          (typeLower === 'maamar' && nameLower.includes('מאמר'))) {
        score += 0.15;
        reason += (reason ? ' + ' : '') + 'type match';
      }
    }

    if (t.first_line) score += 0.05;
    score = Math.min(score, 1.0);
    return { transcript: t, score, reason: reason || 'no match' };
  });

  return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
}
