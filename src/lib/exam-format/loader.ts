import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { examFormatSchema, type ExamFormat } from "./schema";

const DATABASE_DIR = join(process.cwd(), "database");

export function loadExamFormat(subjectFolder: string): ExamFormat {
  const filePath = join(DATABASE_DIR, subjectFolder, "exam_format.json");
  if (!existsSync(filePath)) {
    throw new Error(`Exam format not found: ${filePath}`);
  }
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  return examFormatSchema.parse(raw);
}

export function loadAllExamFormats(): Map<string, ExamFormat> {
  const entries = readdirSync(DATABASE_DIR, { withFileTypes: true });
  const formats = new Map<string, ExamFormat>();

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("AP_")) continue;
    const filePath = join(DATABASE_DIR, entry.name, "exam_format.json");
    if (!existsSync(filePath)) continue;
    const raw = JSON.parse(readFileSync(filePath, "utf-8"));
    const parsed = examFormatSchema.parse(raw);
    formats.set(entry.name, parsed);
  }

  return formats;
}

export function listSubjectFolders(): string[] {
  const entries = readdirSync(DATABASE_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && e.name.startsWith("AP_"))
    .map((e) => e.name)
    .sort();
}
