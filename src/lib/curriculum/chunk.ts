export type UnitChunk = {
  unit: number | null;
  label: string;
  text: string;
};

const UNIT_HEADING_SOURCE = String.raw`(?:Period\s+(\d)\b|Unit\s+(\d)\b[:\u2013])`;

type HeadingMatch = {
  index: number;
  unit: number | null;
  label: string;
};

export function chunkByUnit(pages: string[]): UnitChunk[] {
  const full = pages.join("\n\n");
  const re = new RegExp(UNIT_HEADING_SOURCE, "gi");

  const matches: HeadingMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(full)) !== null) {
    const raw = m[1] ?? m[2];
    matches.push({
      index: m.index,
      unit: raw ? Number.parseInt(raw, 10) : null,
      label: m[0].trim(),
    });
  }

  const chunks: UnitChunk[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : full.length;
    chunks.push({
      unit: matches[i].unit,
      label: matches[i].label,
      text: full.slice(start, end).trim(),
    });
  }

  return chunks;
}

export function extractSkillsRegion(pages: string[]): string {
  const full = pages.join("\n\n");
  let idx = full.search(/AP Historical Thinking Skills/i);
  if (idx === -1) {
    idx = full.search(/Historical Thinking Skills/i);
  }
  if (idx === -1) return "";
  return full.slice(idx, idx + 10000).trim();
}
