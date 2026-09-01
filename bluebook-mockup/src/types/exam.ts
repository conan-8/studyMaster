export interface DiagramSpec {
  kind: 'triangle' | 'parabola' | 'barchart'
  caption: string
}

export interface Question {
  id: string
  skill: string
  prompt: string
  passageHeading?: string
  /** Stimulus text. Wrap a sentence in [[double brackets]] to render it underlined. */
  passage?: string
  /** Multiple-choice options. Omit for student-produced (grid-in) responses. */
  options?: string[]
  /** Correct option letter ('A'-'D') or numeric string for grid-in. */
  correct: string
  diagram?: DiagramSpec
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
