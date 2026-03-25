export function generateKaraokeASS(words, duration, options = {}) {
  const {
    fontName = 'David', fontSize = 48, primaryColor = '&H00FFFFFF',
    highlightColor = '&H0000D4FF', outlineColor = '&H00000000',
    marginV = 80, wordsPerLine = 6
  } = options;

  let ass = `[Script Info]
Title: Divrei Yoel Karaoke
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},${highlightColor},${outlineColor},&H80000000,0,0,0,0,100,100,0,0,1,3,2,2,50,50,${marginV},1
Style: Karaoke,${fontName},${fontSize},${primaryColor},${highlightColor},${outlineColor},&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,50,50,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    const lineWords = words.slice(i, i + wordsPerLine);
    if (lineWords.length > 0) lines.push(lineWords);
  }

  for (const lineWords of lines) {
    const lineStart = lineWords[0].start;
    const lineEnd = lineWords[lineWords.length - 1].end;
    const startTime = formatASSTime(lineStart);
    const endTime = formatASSTime(lineEnd + 0.5);

    let karaokeText = '';
    for (let i = 0; i < lineWords.length; i++) {
      const w = lineWords[i];
      const kDuration = Math.round((w.end - w.start) * 100);
      if (i > 0) {
        const gap = Math.round((w.start - lineWords[i - 1].end) * 100);
        if (gap > 0) karaokeText += `{\\k${gap}} `;
        else karaokeText += ' ';
      }
      karaokeText += `{\\kf${kDuration}}${w.word}`;
    }
    ass += `Dialogue: 0,${startTime},${endTime},Karaoke,,0,0,0,,${karaokeText}\n`;
  }
  return ass;
}

function formatASSTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function generateSRT(words, wordsPerLine = 8) {
  const lines = [];
  for (let i = 0; i < words.length; i += wordsPerLine) lines.push(words.slice(i, i + wordsPerLine));
  return lines.map((lineWords, index) => {
    const start = formatSRTTime(lineWords[0].start);
    const end = formatSRTTime(lineWords[lineWords.length - 1].end);
    return `${index + 1}\n${start} --> ${end}\n${lineWords.map(w => w.word).join(' ')}\n`;
  }).join('\n');
}

function formatSRTTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}
