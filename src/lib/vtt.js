export function parseVtt(input) {
  const blocks = String(input || '').replace(/^\uFEFF/, '').replace(/\r/g, '').split(/\n\s*\n/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const index = lines.findIndex(line => line.includes(' --> '));
    if (index < 0) continue;
    const [start, end] = lines[index].split(' --> ');
    const text = lines.slice(index + 1).join(' ').replace(/<[^>]*>/g, '').trim();
    if (!text) continue;
    cues.push({ start: start.trim(), end: end.trim().split(/\s+/)[0], text });
  }
  return cues;
}

export function timeSeconds(stamp) {
  const parts = String(stamp || '').replace(',', '.').split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function excerptAround(cues, index, seconds = 36) {
  const centre = timeSeconds(cues[index]?.start);
  const selected = cues.filter(cue => Math.abs(timeSeconds(cue.start) - centre) <= seconds);
  return {
    start: selected[0]?.start || cues[index]?.start || '',
    end: selected.at(-1)?.end || cues[index]?.end || '',
    text: selected.map(cue => cue.text).join(' '),
  };
}
