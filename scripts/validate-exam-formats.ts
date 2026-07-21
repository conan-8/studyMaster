import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { examFormatSchema } from "@/lib/exam-format/schema";

const DATABASE_DIR = join(process.cwd(), "database");

type ValidationResult = {
  folder: string;
  valid: boolean;
  errors: string[];
};

function validateFile(folder: string): ValidationResult {
  const filePath = join(DATABASE_DIR, folder, "exam_format.json");
  const errors: string[] = [];

  if (!existsSync(filePath)) {
    return { folder, valid: false, errors: ["exam_format.json not found"] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (e) {
    return { folder, valid: false, errors: [`Invalid JSON: ${e}`] };
  }

  const result = examFormatSchema.safeParse(raw);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
    return { folder, valid: false, errors };
  }

  const data = result.data;

  const sectionWeightSum = data.sections.reduce(
    (sum, s) => sum + s.weightPercent,
    0,
  );
  if (Math.abs(sectionWeightSum - 100) > 1) {
    errors.push(
      `Section weights sum to ${sectionWeightSum.toFixed(1)}%, expected ~100%`,
    );
  }

  if (data.unitWeights.length > 0) {
    const unitWeightSum = data.unitWeights.reduce((sum, u) => {
      if (typeof u.weightPercent === "number") return sum + u.weightPercent;
      return sum + (u.weightPercent.min + u.weightPercent.max) / 2;
    }, 0);
    if (Math.abs(unitWeightSum - 100) > 30) {
      errors.push(
        `Unit weights sum to ~${unitWeightSum.toFixed(1)}% (midpoints), expected ~100%`,
      );
    }
  }

  return { folder, valid: errors.length === 0, errors };
}

function main() {
  const entries = readdirSync(DATABASE_DIR, { withFileTypes: true });
  const folders = entries
    .filter((e) => e.isDirectory() && e.name.startsWith("AP_"))
    .map((e) => e.name)
    .sort();

  console.log(`Validating ${folders.length} subject folders...\n`);

  let passed = 0;
  let failed = 0;

  for (const folder of folders) {
    const result = validateFile(folder);
    if (result.valid) {
      passed++;
      console.log(`  PASS  ${folder}`);
    } else {
      failed++;
      console.log(`  FAIL  ${folder}`);
      for (const err of result.errors) {
        console.log(`        - ${err}`);
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed out of ${folders.length} subjects.`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
