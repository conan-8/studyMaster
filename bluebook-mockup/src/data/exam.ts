import type { ExamModule, Question } from '../types/exam'

/**
 * One full-length practice test: 4 modules at real digital-SAT lengths
 * (27 / 27 / 22 / 22). The first items of Module 1 in each section are
 * original SAT-style questions written for this mockup; the rest are
 * lorem-ipsum placeholder items. Not affiliated with the College Board.
 */

const LOREM_PASSAGE =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'

const RW_SKILL_PROMPTS: Array<[string, string]> = [
  ['Craft and Structure — Words in Context', 'Which choice completes the text with the most logical and precise word or phrase?'],
  ['Expression of Ideas — Transitions', 'Which choice completes the text with the most logical transition?'],
  ['Standard English Conventions — Boundaries', 'Which choice completes the text so that it conforms to the conventions of Standard English?'],
  ['Information and Ideas — Central Ideas and Details', 'Which choice best states the main idea of the text?'],
]

const MATH_SKILLS = [
  'Algebra — Linear Equations',
  'Advanced Math — Nonlinear Functions',
  'Problem Solving and Data Analysis — Ratios and Percentages',
  'Geometry and Trigonometry',
]

const PLACEHOLDER_DIAGRAMS: Array<NonNullable<Question['diagram']>> = [
  { kind: 'triangle', caption: 'Triangle placeholder (not drawn to scale)' },
  { kind: 'parabola', caption: 'Coordinate plane placeholder' },
  { kind: 'barchart', caption: 'Bar graph placeholder' },
]

function rwPlaceholder(moduleId: string, n: number): Question {
  const [skill, prompt] = RW_SKILL_PROMPTS[n % RW_SKILL_PROMPTS.length]
  const base = ['lorem', 'ipsum', 'dolor', 'amet']
  const rot = n % base.length
  const options = [...base.slice(rot), ...base.slice(0, rot)]
  return { id: `${moduleId}-p${n}`, skill, passage: LOREM_PASSAGE, prompt, options, correct: 'A' }
}

function mathPlaceholder(moduleId: string, n: number): Question {
  const base: Question = {
    id: `${moduleId}-p${n}`,
    skill: MATH_SKILLS[n % MATH_SKILLS.length],
    prompt: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. If *y* = ${n + 2}*x* + ${
      n + 1
    }, sed do eiusmod tempor incididunt — what is the value of *y* when *x* = ${n + 1}?`,
    diagram: n % 4 === 1 ? PLACEHOLDER_DIAGRAMS[n % PLACEHOLDER_DIAGRAMS.length] : undefined,
    options: [String(3 + n), String(5 + n), String(7 + n), String(9 + n)],
    correct: 'A',
  }
  // Every fifth placeholder is a student-produced response (no options).
  if (n % 5 === 4) {
    return {
      ...base,
      diagram: undefined,
      options: undefined,
      prompt: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore — placeholder quantity ${n + 1}. Enter your answer as a number.`,
      correct: String(n + 1),
    }
  }
  return base
}

function fill(count: number, have: number, maker: (moduleId: string, n: number) => Question, moduleId: string): Question[] {
  const out: Question[] = []
  for (let i = 0; i < count - have; i++) out.push(maker(moduleId, i))
  return out
}

const RW_ORIGINALS: Question[] = [
  {
    id: 'rw1-1',
    skill: 'Craft and Structure — Words in Context',
    passage:
      'In 2019, marine biologist Lena Ortiz began tagging leopard sharks off the coast of La Jolla. Because the sharks frequently returned to the same coves, Ortiz could ______ individuals over several seasons—something earlier spot surveys had made impossible.',
    prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
    options: ['relocate', 'observe', 'trap', 'feed'],
    correct: 'B',
  },
  {
    id: 'rw1-2',
    skill: 'Expression of Ideas — Transitions',
    passage:
      'The city of Greenville converted its streetlights to LED bulbs in 2021, cutting its lighting costs by 58 percent. ______, the utility reported fewer outages, since the new bulbs last roughly four times longer than the ones they replaced.',
    prompt: 'Which choice completes the text with the most logical transition?',
    options: ['Nevertheless,', 'In addition,', 'By contrast,', 'For example,'],
    correct: 'B',
  },
  {
    id: 'rw1-3',
    skill: 'Standard English Conventions — Punctuation',
    passage:
      "The museum's new wing houses three galleries: one for sculpture, one for textiles, ______ one for rotating photography exhibits.",
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: ['and,', 'and;', 'and', 'and:'],
    correct: 'C',
  },
  {
    id: 'rw1-4',
    skill: 'Standard English Conventions — Agreement',
    passage:
      'Each of the violin’s four strings ______ tuned an interval of a fifth away from its neighbors, giving the instrument its wide melodic range.',
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: ['are', 'is', 'were', 'have been'],
    correct: 'B',
  },
  {
    id: 'rw1-5',
    skill: 'Information and Ideas — Central Ideas',
    passage:
      'Ecologist Priya Nair measured air temperatures on two parallel streets in Hyderabad—one shaded by mature rain trees, the other recently planted with saplings. She found that afternoon temperatures on the shaded street averaged 4.2°C lower, and that the difference peaked not at midday, when the sun is highest, but in the late afternoon, after the pavement on the exposed street had absorbed hours of heat.',
    prompt: 'Which choice best states the main idea of the text?',
    options: [
      'Rain trees cool streets mainly by releasing stored moisture at midday.',
      'Mature street trees can meaningfully reduce afternoon heat compared with newly planted ones.',
      'Pavement absorbs more heat in Hyderabad than in other cities.',
      'Late afternoon is the hottest time of day even on shaded streets.',
    ],
    correct: 'B',
  },
  {
    id: 'rw1-6',
    skill: 'Craft and Structure — Text Structure and Purpose',
    passage:
      'Literary critics long dismissed the novelist’s early stories as apprentice work: charming, but slight. The discovery of her notebooks in 2015 complicated that judgment. [[The notebooks show that she drafted and redrafted each story dozens of times, testing structures she would later use in her celebrated novels.]] Far from being slight, the stories were a laboratory.',
    prompt: 'Which choice best describes the function of the underlined sentence in the text as a whole?',
    options: [
      'It explains why critics originally dismissed the stories.',
      'It presents evidence that challenges an earlier view.',
      'It describes the narrative structure of the celebrated novels.',
      'It summarizes how the notebooks were discovered in 2015.',
    ],
    correct: 'B',
  },
  {
    id: 'rw1-7',
    skill: 'Expression of Ideas — Rhetorical Synthesis',
    passageHeading: 'While researching a topic, a student has taken the following notes:',
    passage:
      '• The Svartsengi geothermal plant in Iceland supplies hot water to roughly 30,000 homes.\n• The plant opened in 1976.\n• Geothermal energy harnesses heat from beneath Earth’s surface.\n• The plant also generates about 75 megawatts of electricity.',
    prompt:
      'The student wants to emphasize the plant’s importance to local residents. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
    options: [
      'The Svartsengi plant, which opened in 1976, generates about 75 megawatts of electricity.',
      'Geothermal energy, which harnesses heat from beneath Earth’s surface, is used at plants such as Svartsengi.',
      'Since 1976, the Svartsengi plant has supplied hot water to roughly 30,000 homes—a clear sign of its importance to local residents.',
      'The Svartsengi plant both supplies hot water and generates electricity.',
    ],
    correct: 'C',
  },
  {
    id: 'rw1-8',
    skill: 'Information and Ideas — Inferences',
    passage:
      'In one study, volunteers who learned to juggle showed measurable growth in certain brain regions after three months. When the volunteers stopped practicing, those changes partially reversed. The researchers cautioned, however, that growth was observed only in regions tied to hand-eye coordination—not throughout the brain as a whole.',
    prompt: 'Based on the text, what do the researchers caution against?',
    options: [
      'Assuming that juggling produces brain-wide changes',
      'Believing that practice has no effect on the brain',
      'Concluding that juggling is the best way to strengthen the brain',
      'Expecting brain changes to reverse after practice stops',
    ],
    correct: 'A',
  },
  {
    id: 'rw1-9',
    skill: 'Craft and Structure — Words in Context',
    passage:
      'Because the committee’s report was so ______—full of hedged claims and qualifiers—the board asked for a revised version with firmer recommendations.',
    prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
    options: ['decisive', 'tentative', 'exhaustive', 'lucid'],
    correct: 'B',
  },
  {
    id: 'rw1-10',
    skill: 'Standard English Conventions — Modifiers',
    passage: 'Walking through the market on Saturday morning, ______',
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      'the smell of fresh bread drew us toward the bakery',
      'we were drawn toward the bakery by the smell of fresh bread',
      'our attention was captured by the smell of fresh bread from the bakery',
      'there was a smell of fresh bread drawing us to the bakery',
    ],
    correct: 'B',
  },
]

const MATH_ORIGINALS: Question[] = [
  {
    id: 'math1-1',
    skill: 'Algebra — Linear Equations',
    prompt: 'If 3*x* + 7 = 22, what is the value of *x*?',
    options: ['3', '5', '7', '15'],
    correct: 'B',
  },
  {
    id: 'math1-2',
    skill: 'Algebra — Slope',
    prompt: 'A line in the *xy*-plane passes through the points (2, 5) and (6, 13). What is the slope of the line?',
    options: ['1/2', '1', '2', '4'],
    correct: 'C',
  },
  {
    id: 'math1-3',
    skill: 'Algebra — Systems of Equations',
    prompt:
      'A theater sells adult tickets for $12 and student tickets for $8. On Saturday it sold 150 tickets for a total of $1,520. How many adult tickets were sold?',
    options: ['60', '70', '80', '90'],
    correct: 'C',
  },
  {
    id: 'math1-4',
    skill: 'Problem Solving — Percentages',
    prompt: 'A jacket originally priced at $80 is discounted by 25%. What is the sale price of the jacket?',
    options: ['$55', '$60', '$65', '$75'],
    correct: 'B',
  },
  {
    id: 'math1-5',
    skill: 'Geometry — Triangles',
    prompt:
      'In the figure, triangle *ABC* has angle *A* measuring 35° and angle *B* measuring 65°. What is the measure of angle *C*?',
    diagram: { kind: 'triangle', caption: 'Note: Figure not drawn to scale.' },
    options: ['70°', '80°', '90°', '100°'],
    correct: 'B',
  },
  {
    id: 'math1-6',
    skill: 'Advanced Math — Quadratics',
    prompt: 'The graph of *y* = (*x* − 2)² + 3 in the *xy*-plane is a parabola. What are the coordinates of its vertex?',
    diagram: { kind: 'parabola', caption: 'Note: Figure not drawn to scale.' },
    options: ['(−2, 3)', '(2, −3)', '(−2, −3)', '(2, 3)'],
    correct: 'D',
  },
  {
    id: 'math1-7',
    skill: 'Advanced Math — Functions',
    prompt: 'If *f*(*x*) = *x*² − 4*x* + 1, what is the value of *f*(5)?',
    options: ['6', '11', '16', '26'],
    correct: 'A',
  },
  {
    id: 'math1-8',
    skill: 'Problem Solving — Data Analysis',
    prompt:
      'The bar graph shows the number of bicycles a shop sold in four months: 18 in April, 24 in May, 31 in June, and 22 in July. In which month did the shop sell the most bicycles?',
    diagram: { kind: 'barchart', caption: 'Bicycles sold per month, April–July' },
    options: ['April', 'May', 'June', 'July'],
    correct: 'C',
  },
  {
    id: 'math1-9',
    skill: 'Algebra — Linear Equations',
    prompt: 'If 2(*x* − 3) = 10, what is the value of *x*?',
    correct: '8',
  },
  {
    id: 'math1-10',
    skill: 'Problem Solving — Ratios and Proportions',
    prompt: 'A recipe calls for 3 cups of flour to make 24 muffins. At this rate, how many cups of flour are needed to make 40 muffins?',
    correct: '5',
  },
]

export const TEST: ExamModule[] = [
  {
    id: 'rw1',
    label: 'Section 1, Module 1',
    title: 'Reading and Writing',
    minutes: 32,
    split: true,
    questions: [...RW_ORIGINALS, ...fill(27, RW_ORIGINALS.length, rwPlaceholder, 'rw1')],
  },
  {
    id: 'rw2',
    label: 'Section 1, Module 2',
    title: 'Reading and Writing',
    minutes: 32,
    split: true,
    questions: fill(27, 0, rwPlaceholder, 'rw2'),
  },
  {
    id: 'math1',
    label: 'Section 2, Module 1',
    title: 'Math',
    minutes: 35,
    split: false,
    questions: [...MATH_ORIGINALS, ...fill(22, MATH_ORIGINALS.length, mathPlaceholder, 'math1')],
  },
  {
    id: 'math2',
    label: 'Section 2, Module 2',
    title: 'Math',
    minutes: 35,
    split: false,
    questions: fill(22, 0, mathPlaceholder, 'math2'),
  },
]
