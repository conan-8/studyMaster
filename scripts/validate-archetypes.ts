/**
 * validate-archetypes: research/sat/archetypes/<section>/*.json vs
 * schemas/archetype.schema.json.
 * Cross-checks per archetype:
 *   - taxonomyCode exists in the subject's taxonomy.json
 *   - every distractorLogic[].misconceptionId exists in the subject's misconceptions.json
 *   - every diagramSpec.allowedArchetypeIds entry exists in database/diagrams/
 *
 * Math archetypes are delivered: all sections (rw, math) validate strictly.
 * A section directory that is absent entirely is still only a note (so the
 * suite passes on fresh checkouts before any archetypes are authored).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  createAjv,
  loadJson,
  runSuite,
  schemaValidate,
  archetypeFiles,
  taxonomyCodes,
  misconceptionIds,
  diagramArchetypeIds,
  ARCHETYPES_DIR,
} from './lib/catalog.js';
import { REPO_ROOT } from './lib/validate.js';

const ARCHETYPE_SCHEMA = path.join(REPO_ROOT, 'schemas', 'archetype.schema.json');
const IN_FLIGHT_SECTIONS = new Set<string>([]);

interface Archetype {
  slug?: string;
  subjectCode?: string;
  taxonomyCode?: string;
  distractorLogic?: Array<{ misconceptionId: string }>;
  diagramSpec?: { allowedArchetypeIds?: string[] };
}

runSuite('archetypes', (reporter) => {
  const ajv = createAjv();
  const files = archetypeFiles();
  const sectionsPresent = new Set(files.map((f) => f.section));
  for (const section of IN_FLIGHT_SECTIONS) {
    if (!sectionsPresent.has(section)) {
      reporter.note(`archetypes section '${section}' is absent or has no .json files yet (in flight) — skipped`);
    }
  }
  if (!fs.existsSync(ARCHETYPES_DIR) || files.length === 0) {
    reporter.note('no archetype files under research/sat/archetypes/');
    return 0;
  }
  const diagramIds = diagramArchetypeIds();
  const taxonomyCache = new Map<string, Set<string>>();
  const misconceptionCache = new Map<string, Set<string>>();
  let checked = 0;

  for (const { section, file } of files) {
    const inFlight = IN_FLIGHT_SECTIONS.has(section);
    const data = loadJson(file) as Archetype;
    const valid = schemaValidate(ajv, ARCHETYPE_SCHEMA, file, data, reporter, { warnOnly: inFlight });
    if (!valid) {
      checked++;
      continue;
    }
    const subject = data.subjectCode ?? '';
    const report = (jsonPath: string, message: string): void => {
      if (inFlight) reporter.warn(file, jsonPath, message);
      else reporter.error(file, jsonPath, message);
    };
    if (!taxonomyCache.has(subject)) taxonomyCache.set(subject, taxonomyCodes(subject));
    if (!misconceptionCache.has(subject)) misconceptionCache.set(subject, misconceptionIds(subject));
    const codes = taxonomyCache.get(subject)!;
    const misconceptions = misconceptionCache.get(subject)!;

    if (codes.size === 0) {
      report('/subjectCode', `no taxonomy.json found for subject '${subject}' — cannot resolve taxonomyCode`);
    } else if (data.taxonomyCode && !codes.has(data.taxonomyCode)) {
      report('/taxonomyCode', `taxonomyCode '${data.taxonomyCode}' does not exist in database/${subject}/taxonomy.json`);
    }
    (data.distractorLogic ?? []).forEach((d, i) => {
      if (misconceptions.size === 0) {
        report(`/distractorLogic/${i}/misconceptionId`, `no misconceptions.json found for subject '${subject}' — cannot resolve misconceptionId`);
      } else if (!misconceptions.has(d.misconceptionId)) {
        report(`/distractorLogic/${i}/misconceptionId`, `misconceptionId '${d.misconceptionId}' does not exist in database/${subject}/misconceptions.json`);
      }
    });
    (data.diagramSpec?.allowedArchetypeIds ?? []).forEach((id, i) => {
      if (!diagramIds.has(id)) {
        report(`/diagramSpec/allowedArchetypeIds/${i}`, `diagram archetype '${id}' does not exist in database/diagrams/`);
      }
    });
    checked++;
  }
  return checked;
});
