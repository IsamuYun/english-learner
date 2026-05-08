export interface VocabWord {
  id: string
  word: string
  ipa: string
  pos: string // part of speech, e.g. 'n.', 'v.', 'adj.'
  zh: string // Chinese gloss
  example: { en: string; zh: string }
  level: 1 | 2 | 3 // 1 basic, 2 intermediate, 3 advanced
  tags?: string[]
}

export interface FlashcardProgress {
  wordId: string
  seen: number
  known: number // marked known count
  lastReviewed: number // ms epoch
  due: number // ms epoch (simple SRS)
  bucket: 0 | 1 | 2 | 3 | 4 // Leitner-ish
}

export interface ReadingPassage {
  id: string
  title: string
  level: 1 | 2 | 3
  body: string
  questions: ReadingQuestion[]
}

export interface ReadingQuestion {
  id: string
  prompt: string
  choices: string[] // 4 options
  answerIndex: number
  explanation: string
}

export interface ConversationScenario {
  id: string
  week: number
  title: string
  zhContext: string // Chinese situational description
  turns: ConversationTurn[]
}

export interface ConversationTurn {
  zhPrompt: string // Chinese sentence the user must say in English
  hintEn: string // model answer in English
  notes?: string // grammar / vocabulary tip
}

export interface EssayPrompt {
  week: number
  title: string
  zhBrief: string
  enBrief: string
  minWords: number
  maxWords: number
  rubric: string[]
}

export interface EssayDraft {
  week: number
  text: string
  updatedAt: number
  feedback?: EssayFeedback
}

export interface EssayFeedback {
  scoreOverall: number // 0-100
  scoreContent: number
  scoreLanguage: number
  scoreStructure: number
  strengths: string[]
  improvements: string[]
  revised?: string
}

export interface SentenceEvaluation {
  score: number // 0-100
  verdict: 'excellent' | 'good' | 'okay' | 'needs-work'
  comments: string[]
  corrections?: string
  natural?: string
}

export interface ReadingResult {
  passageId: string
  takenAt: number
  correct: number
  total: number
  answers: number[]
}

export interface AppSettings {
  voice: string // preferred voice URI
  rate: number // TTS rate
}
