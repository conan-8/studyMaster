export type QuestionType = "MCQ" | "SAQ" | "DBQ" | "LEQ";

export type Choice = { id: string; text: string };

export type ReviewQuestion = {
  id: string;
  type: QuestionType;
  difficulty: number;
  stem: string;
  stimulus: string | null;
  choices: Choice[];
  correctAnswer: string | null;
  rubric: unknown | null;
  explanation: string;
  misconceptionTags: string[];
  sourceTag: string;
  subjectCode: string;
  topicCode: string;
  topicTitle: string;
  createdAt: string;
};
