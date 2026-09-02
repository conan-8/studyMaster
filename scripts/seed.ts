/**
 * seed.ts — idempotent seed of the studyMaste database from the repo's data
 * files. Every write is an upsert (ON CONFLICT DO UPDATE), so re-running is safe.
 *
 * Seeds: subjects (database/<SUBJECT>/exam_format.json), taxonomy_nodes,
 * misconceptions, diagram_archetypes, archetypes (whole file as spec JSONB),
 * and approved generated questions from BOTH generated-question namespaces
 * (research/sat/test-fixtures/generated-*.json and committed drafts in
 * research/sat/generated/*.json — shared discovery in lib/catalog.ts).
 * Only review.status === 'approved' is seeded; pending/rejected drafts are
 * reported as skipped counts. Generated/original questions are flagged
 * source='generated' in questions/question_versions.
 *
 * Harvested SAT content (research/sat/question-bank/*.json,
 * gitignored) seeds into the SEPARATE harvested_questions table with
 * allowed_uses {internal_eval} and an origin split: 'bluebook' (appears in a
 * Bluebook practice exam) vs 'question_bank' (general online SSQB item).
 * That table is RLS default-deny + a dev-only anon read policy so harvested
 * content never reaches the public roles outside local dev.
 *
 * Reads DATABASE_URL (a Supabase-compatible Postgres URI; see .env.example).
 * Unreachable DB -> PENDING-DEPLOY message with exact commands, exit 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { connectOrPending } from './lib/db.js';
import { loadJson, walkJson, REPO_ROOT } from './lib/validate.js';
import { listSubjects, subjectDir, archetypeFiles, generatedQuestionFiles, DIAGRAMS_DIR } from './lib/catalog.js';

interface ExamFormat {
  subject: { code: string; name: string; examMode: string };
}
interface TaxonomyFile {
  nodes: Array<{
    code: string;
    kind: string;
    title: string;
    slug: string;
    description: string;
    parentCode: string | null;
    examWeightPercent: number | null;
    sortOrder: number;
  }>;
}
interface MisconceptionsFile {
  misconceptions: Array<{
    id: string;
    taxonomyCode: string;
    name: string;
    description: string;
    detectionSignal: string;
    remediationNote: string;
  }>;
}
interface DiagramEntry {
  archetypeId: string;
  title: string;
  description: string;
  subjectsApplicable: string[];
  paramsSchema: object;
  rendererRef: string;
  notes: string | null;
}
interface ArchetypeFile {
  slug: string;
  subjectCode: string;
  taxonomyCode: string;
}
interface GeneratedQuestion {
  id: string;
  subjectCode: string;
  taxonomyCode: string;
  difficultyTarget: number;
  allowedUses: string[];
  provenance: { archetypeSlug: string; contentHash: string };
  review: { status: 'pending' | 'approved' | 'rejected' };
}

async function main(): Promise<void> {
  const client = await connectOrPending('seed');
  try {
    // --- subjects + taxonomy + misconceptions ---
    const subjects = listSubjects();
    for (const subject of subjects) {
      const examFormat = loadJson(path.join(subjectDir(subject), 'exam_format.json')) as ExamFormat;
      const family = examFormat.subject.code.startsWith('SAT_') ? 'SAT' : 'AP';
      await client.query(
        `INSERT INTO subjects (code, name, exam_mode, family)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, exam_mode = EXCLUDED.exam_mode, family = EXCLUDED.family`,
        [examFormat.subject.code, examFormat.subject.name, examFormat.subject.examMode, family],
      );

      const taxonomyFile = path.join(subjectDir(subject), 'taxonomy.json');
      if (fs.existsSync(taxonomyFile)) {
        const taxonomy = loadJson(taxonomyFile) as TaxonomyFile;
        // Parents before children (single extra pass suffices for domain -> skill depth).
        const ordered = [...taxonomy.nodes].sort((a, b) => Number(a.parentCode !== null) - Number(b.parentCode !== null));
        for (const node of ordered) {
          await client.query(
            `INSERT INTO taxonomy_nodes (code, subject_code, kind, title, slug, description, parent_code, exam_weight_percent, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (code) DO UPDATE SET
               subject_code = EXCLUDED.subject_code, kind = EXCLUDED.kind, title = EXCLUDED.title,
               slug = EXCLUDED.slug, description = EXCLUDED.description, parent_code = EXCLUDED.parent_code,
               exam_weight_percent = EXCLUDED.exam_weight_percent, sort_order = EXCLUDED.sort_order`,
            [node.code, subject, node.kind, node.title, node.slug, node.description, node.parentCode, node.examWeightPercent, node.sortOrder],
          );
        }
        console.log(`seed: ${subject}: upserted ${taxonomy.nodes.length} taxonomy node(s)`);
      }

      const misconceptionsFile = path.join(subjectDir(subject), 'misconceptions.json');
      if (fs.existsSync(misconceptionsFile)) {
        const misconceptions = loadJson(misconceptionsFile) as MisconceptionsFile;
        for (const m of misconceptions.misconceptions) {
          await client.query(
            `INSERT INTO misconceptions (id, taxonomy_code, name, description, detection_signal, remediation_note)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               taxonomy_code = EXCLUDED.taxonomy_code, name = EXCLUDED.name, description = EXCLUDED.description,
               detection_signal = EXCLUDED.detection_signal, remediation_note = EXCLUDED.remediation_note`,
            [m.id, m.taxonomyCode, m.name, m.description, m.detectionSignal, m.remediationNote],
          );
        }
        console.log(`seed: ${subject}: upserted ${misconceptions.misconceptions.length} misconception(s)`);
      }
    }
    console.log(`seed: upserted ${subjects.length} subject(s)`);

    // --- diagram archetypes ---
    const diagramFiles = walkJson(DIAGRAMS_DIR);
    for (const file of diagramFiles) {
      const d = loadJson(file) as DiagramEntry;
      await client.query(
        `INSERT INTO diagram_archetypes (archetype_id, title, description, subjects_applicable, params_schema, renderer_ref, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (archetype_id) DO UPDATE SET
           title = EXCLUDED.title, description = EXCLUDED.description, subjects_applicable = EXCLUDED.subjects_applicable,
           params_schema = EXCLUDED.params_schema, renderer_ref = EXCLUDED.renderer_ref, notes = EXCLUDED.notes`,
        [d.archetypeId, d.title, d.description, d.subjectsApplicable, JSON.stringify(d.paramsSchema), d.rendererRef, d.notes],
      );
    }
    console.log(`seed: upserted ${diagramFiles.length} diagram archetype(s)`);

    // --- question archetypes (whole file as spec JSONB) ---
    const archetypeFilesList = archetypeFiles();
    let archetypesSeeded = 0;
    for (const { section, file } of archetypeFilesList) {
      const spec = loadJson(file) as ArchetypeFile;
      await client.query(
        `INSERT INTO archetypes (slug, subject_code, taxonomy_code, spec, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (slug) DO UPDATE SET
           subject_code = EXCLUDED.subject_code, taxonomy_code = EXCLUDED.taxonomy_code,
           spec = EXCLUDED.spec, updated_at = now()`,
        [spec.slug, spec.subjectCode, spec.taxonomyCode, JSON.stringify(spec)],
      );
      archetypesSeeded++;
      void section;
    }
    console.log(`seed: upserted ${archetypesSeeded} archetype(s)`);

    // --- approved generated questions (fixtures + committed drafts) ---
    const generatedFiles = generatedQuestionFiles();
    if (generatedFiles.length === 0) {
      console.log('seed: no generated questions under research/sat/test-fixtures/ or research/sat/generated/ — question seeding skipped');
    }
    let questionsSeeded = 0;
    const skipped: Record<string, number> = {};
    for (const file of generatedFiles) {
      const q = loadJson(file) as GeneratedQuestion;
      if (q.review.status !== 'approved') {
        skipped[q.review.status] = (skipped[q.review.status] ?? 0) + 1;
        continue;
      }
      await client.query(
        `INSERT INTO questions (id, subject_code, current_version, source)
         VALUES ($1, $2, 1, 'generated')
         ON CONFLICT (id) DO UPDATE SET subject_code = EXCLUDED.subject_code`,
        [q.id, q.subjectCode],
      );
      await client.query(
        `INSERT INTO question_versions
           (question_id, version, payload, taxonomy_code, archetype_slug, difficulty, review_status, allowed_uses, provenance, content_hash)
         VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (question_id, version) DO UPDATE SET
           payload = EXCLUDED.payload, taxonomy_code = EXCLUDED.taxonomy_code, archetype_slug = EXCLUDED.archetype_slug,
           difficulty = EXCLUDED.difficulty, review_status = EXCLUDED.review_status, allowed_uses = EXCLUDED.allowed_uses,
           provenance = EXCLUDED.provenance, content_hash = EXCLUDED.content_hash`,
        [
          q.id,
          JSON.stringify(q),
          q.taxonomyCode,
          q.provenance.archetypeSlug,
          q.difficultyTarget,
          q.review.status,
          q.allowedUses,
          JSON.stringify(q.provenance),
          q.provenance.contentHash,
        ],
      );
      questionsSeeded++;
    }
    if (generatedFiles.length > 0) {
      const skippedNote = Object.entries(skipped)
        .map(([status, n]) => `${n} ${status}`)
        .join(', ');
      console.log(
        `seed: upserted ${questionsSeeded} approved generated question(s) ` +
          `(${generatedFiles.length} file(s) scanned${skippedNote ? `, skipped ${skippedNote}` : ''})`,
      );
    }

    // --- harvested SAT bank (separate table, internal_eval only) ---
    // Three question kinds overall: generated (ours), question_bank (online
    // SSQB items), and bluebook (SSQB items that appear in Bluebook practice
    // exams) — the last two live in harvested_questions, split by origin.
    const bluebookDir = path.join(REPO_ROOT, 'research', 'sat', 'question-bank');
    const bluebookFiles = fs.existsSync(bluebookDir)
      ? fs.readdirSync(bluebookDir).filter((n) => n.startsWith('ssqb-') && n.endsWith('.json'))
      : [];
    if (bluebookFiles.length === 0) {
      console.log('seed: no harvested SAT questions under research/sat/question-bank/ — harvested seeding skipped');
    }
    for (const name of bluebookFiles) {
      const q = loadJson(path.join(bluebookDir, name)) as Record<string, unknown>;
      await client.query(
        `INSERT INTO harvested_questions
           (source_id, origin, section, domain, skill, difficulty_official, difficulty_internal,
            question_type, payload, allowed_uses, source_url, harvested_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '{internal_eval}', $10, $11)
         ON CONFLICT (source_id) DO UPDATE SET
           origin = EXCLUDED.origin, section = EXCLUDED.section, domain = EXCLUDED.domain, skill = EXCLUDED.skill,
           difficulty_official = EXCLUDED.difficulty_official, difficulty_internal = EXCLUDED.difficulty_internal,
           question_type = EXCLUDED.question_type, payload = EXCLUDED.payload,
           source_url = EXCLUDED.source_url, harvested_at = EXCLUDED.harvested_at`,
        [
          q.sourceId,
          q.origin ?? 'question_bank',
          q.section,
          q.domain,
          q.skill,
          q.difficultyOfficial,
          q.difficultyInternal,
          q.questionType,
          JSON.stringify(q),
          q.sourceUrl,
          q.harvestedAt,
        ],
      );
    }
    if (bluebookFiles.length > 0) {
      console.log(`seed: upserted ${bluebookFiles.length} harvested question(s) into harvested_questions`);
    }
    console.log('seed: done');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`seed: FAILED — ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
