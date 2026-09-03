export interface DiagramSpec {
  kind?: 'triangle' | 'parabola' | 'barchart'
  caption?: string
  /** Real parameterized figure: rendered by the studyMaste SVG renderer
   *  bundle (public/renderers.js, window.StudyMasteRenderers). When present
   *  it replaces the placeholder glyph. */
  live?: {
    archetypeId: string
    parameters: Record<string, unknown>
  }
}

export interface TableSpec {
  caption?: string
  columns: string[]
  rows: Array<Array<string | number>>
}

export interface Question {
  id: string
  skill: string
  prompt: string
  passageHeading?: string
  /** Stimulus text. Wrap a sentence in [[double brackets]] to render it underlined. */
  passage?: string
  /** Table stimulus (rendered above the prompt). */
  table?: TableSpec
  /** Multiple-choice options. Omit for student-produced (grid-in) responses. */
  options?: string[]
  /** Correct option letter ('A'-'D') or numeric string for grid-in. */
  correct: string
  /** Explanation shown after checking an answer (zen mode). */
  rationale?: string
  diagram?: DiagramSpec
  /** Rendered question image (harvested math items carry the whole question
   *  as a picture — College Board draws equations as vector art). */
  imageAsset?: string
  /** Archetype (canonical skill slug) this question belongs to. */
  archetype?: string
}

export interface ExamModule {
  id: string
  label: string
  title: string
  minutes: number
  /** Two-pane passage | question layout (Reading & Writing) vs single column (Math). */
  split: boolean
  questions: Question[]
}
