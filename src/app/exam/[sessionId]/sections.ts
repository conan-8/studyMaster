/**
 * Presentation-layer parsing for the exam shell.
 *
 * Two Json columns are read:
 *  - ExamBlueprint.sectionsJson — the blueprint's section structure
 *    (an array of sections, or a `{ sections: [...] }` wrapper).
 *  - ExamSession.answersJson — the assembled question ids grouped per section,
 *    canonical shape `Array<{ sectionId, questionIds }>` in section order
 *    (a few tolerant fallbacks are accepted for robustness).
 *
 * These helpers only normalize already-assembled data for display; assembly
 * itself lives in @/lib/exam/assemble (part-core) and is never duplicated here.
 */

export type ShellSubPart = {
  id: string;
  name: string;
  questionCount: number;
  durationMinutes: number;
};

export type BlueprintSection = {
  id: string;
  name: string;
  type: string;
  questionCount: number;
  durationMinutes: number;
  weightPercent?: number;
  calculatorAllowed?: boolean;
  subParts: ShellSubPart[];
};

/** What the client shell receives: blueprint structure + assembled count. */
export type ShellSection = BlueprintSection & {
  assembledCount: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toSubPart(value: unknown): ShellSubPart | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string") {
    return null;
  }
  return {
    id: record.id,
    name: typeof record.name === "string" ? record.name : record.id,
    questionCount: toNumber(record.questionCount) ?? 0,
    durationMinutes: toNumber(record.durationMinutes) ?? 0,
  };
}

function toSection(value: unknown): BlueprintSection | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string") {
    return null;
  }
  const rawSubParts = Array.isArray(record.subParts) ? record.subParts : [];
  return {
    id: record.id,
    name: typeof record.name === "string" ? record.name : `Section ${record.id}`,
    type: typeof record.type === "string" ? record.type : "MCQ",
    questionCount: toNumber(record.questionCount) ?? 0,
    durationMinutes: toNumber(record.durationMinutes) ?? 0,
    weightPercent: toNumber(record.weightPercent),
    calculatorAllowed:
      typeof record.calculatorAllowed === "boolean" ? record.calculatorAllowed : undefined,
    subParts: rawSubParts
      .map(toSubPart)
      .filter((subPart): subPart is ShellSubPart => subPart !== null),
  };
}

/** Blueprint sectionsJson -> ordered section list (R34/R35). */
export function parseBlueprintSections(sectionsJson: unknown): BlueprintSection[] {
  let list: unknown = sectionsJson;
  const wrapper = asRecord(sectionsJson);
  if (wrapper && Array.isArray(wrapper.sections)) {
    list = wrapper.sections;
  }
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(toSection)
    .filter((section): section is BlueprintSection => section !== null);
}

/** answersJson -> sectionId -> number of assembled questions (R24/R36). */
export function parseAssembledCounts(answersJson: unknown): Map<string, number> {
  const counts = new Map<string, number>();

  let list: unknown = answersJson;
  const wrapper = asRecord(answersJson);
  if (wrapper && Array.isArray(wrapper.sections)) {
    list = wrapper.sections;
  }

  if (Array.isArray(list)) {
    for (const entry of list) {
      const record = asRecord(entry);
      if (!record) {
        continue;
      }
      const sectionId = record.sectionId ?? record.id ?? record.section;
      if (typeof sectionId !== "string") {
        continue;
      }
      const ids = record.questionIds ?? record.ids ?? record.questions ?? record.answers;
      counts.set(sectionId, Array.isArray(ids) ? ids.length : 0);
    }
    return counts;
  }

  if (wrapper) {
    // Object keyed by section id -> id list.
    for (const [sectionId, value] of Object.entries(wrapper)) {
      counts.set(sectionId, Array.isArray(value) ? value.length : 0);
    }
  }

  return counts;
}
