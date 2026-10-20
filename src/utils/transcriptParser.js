/**
 * Handcrafted Zero-Dependency Transcript & Subtitles Parser for DocView-All
 * Supports WebVTT (.vtt), SubRip (.srt), JSON arrays, and Plain Text (.txt)
 */

export function parseTimestampToSeconds(str) {
  if (!str) return 0;
  const cleaned = str.trim().replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return m * 60 + s;
  }
  return parseFloat(cleaned) || 0;
}

export function formatCueTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const remSec = s % 60;
  if (h > 0) {
    return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}:${remSec < 10 ? '0' : ''}${remSec}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${remSec < 10 ? '0' : ''}${remSec}`;
}

export function parseTranscript(input) {
  if (!input) return [];

  // 1. Array of cue objects already provided
  if (Array.isArray(input)) {
    return input.map((item, idx) => ({
      id: item.id || idx + 1,
      start: typeof item.start === 'number' ? item.start : parseTimestampToSeconds(item.start),
      end: typeof item.end === 'number' ? item.end : parseTimestampToSeconds(item.end),
      text: String(item.text || item.content || '').trim()
    })).filter(c => c.text);
  }

  // 2. Object with cues or transcript property
  if (typeof input === 'object' && input !== null) {
    if (Array.isArray(input.cues)) return parseTranscript(input.cues);
    if (Array.isArray(input.transcript)) return parseTranscript(input.transcript);
    if (Array.isArray(input.subtitles)) return parseTranscript(input.subtitles);
  }

  const text = String(input).trim();

  // 3. JSON string
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      return parseTranscript(parsed);
    } catch {
      // not JSON, fallback to text parsing
    }
  }

  // 4. WebVTT (.vtt) or SubRip (.srt)
  if (text.includes('-->')) {
    const cues = [];
    const blocks = text.split(/\r?\n\r?\n/);

    blocks.forEach((block, idx) => {
      const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      // Find arrow line (e.g. "00:00:01.000 --> 00:00:04.500")
      let timeLineIdx = lines.findIndex(l => l.includes('-->'));
      if (timeLineIdx === -1) return;

      const timeLine = lines[timeLineIdx];
      const timeParts = timeLine.split('-->');
      if (timeParts.length < 2) return;

      const startTime = parseTimestampToSeconds(timeParts[0]);
      // Remove any trailing VTT alignment cues like "line:0 position:20%"
      const cleanEndTimeStr = timeParts[1].trim().split(/\s+/)[0];
      const endTime = parseTimestampToSeconds(cleanEndTimeStr);

      const textLines = lines.slice(timeLineIdx + 1);
      const cueText = textLines.join(' ').replace(/<[^>]+>/g, '').trim();

      if (cueText) {
        cues.push({
          id: cues.length + 1,
          start: startTime,
          end: endTime || startTime + 4,
          text: cueText
        });
      }
    });

    if (cues.length > 0) return cues;
  }

  // 5. Plain text fallback: split by non-empty lines
  const plainLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return plainLines.map((line, idx) => ({
    id: idx + 1,
    start: idx * 4,
    end: (idx + 1) * 4,
    text: line
  }));
}

/**
 * Generates standard WebVTT format string from cues
 */
export function generateVttContent(cues) {
  let vtt = 'WEBVTT\n\n';
  cues.forEach((cue, idx) => {
    const sH = Math.floor(cue.start / 3600);
    const sM = Math.floor((cue.start % 3600) / 60);
    const sS = (cue.start % 60).toFixed(3);
    const startStr = `${sH < 10 ? '0' : ''}${sH}:${sM < 10 ? '0' : ''}${sM}:${sS < 10 ? '0' : ''}${sS}`;

    const eH = Math.floor(cue.end / 3600);
    const eM = Math.floor((cue.end % 3600) / 60);
    const eS = (cue.end % 60).toFixed(3);
    const endStr = `${eH < 10 ? '0' : ''}${eH}:${eM < 10 ? '0' : ''}${eM}:${eS < 10 ? '0' : ''}${eS}`;

    vtt += `${idx + 1}\n${startStr} --> ${endStr}\n${cue.text}\n\n`;
  });
  return vtt;
}
