export type StudyStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type QuestionType = "SHORT_TEXT" | "LONG_TEXT" | "MULTIPLE_CHOICE" | "SCALE";
export type EnrollmentStatus = "VERIFIED" | "IN_PROGRESS" | "COMPLETED" | "FLAGGED";

// ---- Auth ----
export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  researcher: {
    id: string;
    email: string;
    name: string;
  };
}

// ---- Studies ----
export interface CreateStudyRequest {
  title: string;
  description: string;
  targetCount: number;
  compensationUsd: number;
  questions: Array<{
    order: number;
    type: QuestionType;
    prompt: string;
    options?: string[];
  }>;
}

export interface StudyListItem {
  id: string;
  title: string;
  status: StudyStatus;
  targetCount: number;
  enrollmentCount: number;
  completedCount: number;
  flaggedCount: number;
}

export interface StudyDetail {
  id: string;
  title: string;
  description: string;
  status: StudyStatus;
  targetCount: number;
  compensationUsd: number;
  questions: Array<{
    id: string;
    order: number;
    type: QuestionType;
    prompt: string;
    options: unknown;
  }>;
  enrollments: Array<{
    id: string;
    status: EnrollmentStatus;
    enrolledAt: string;
    averageQualityScore: number | null;
    flagged: boolean;
  }>;
}

// ---- Enrollment ----
export interface EnrollRequest {
  idkitResponse: unknown;
}

// ---- Responses ----
export interface SubmitResponsesRequest {
  responses: Array<{
    questionId: string;
    value: string;
    timeSpentMs: number;
    validityScore?: number;
  }>;
}

// ---- Validity ----
export interface ValidateResponseRequest {
  question: string;
  answer: string;
  questionType: QuestionType;
}

export interface ValidateResponseResponse {
  score: number;
  explanation: string;
}

// ---- Contradictions ----
export interface CheckContradictionsRequest {
  responses: Array<{
    question: string;
    answer: string;
  }>;
}

export interface CheckContradictionsResponse {
  score: number;
  contradictions: Array<{
    questionA: string;
    answerA: string;
    questionB: string;
    answerB: string;
    explanation: string;
  }>;
  summary: string;
}

// ---- Dashboard ----
export interface DashboardStats {
  totalEnrollments: number;
  completed: number;
  inProgress: number;
  flagged: number;
  averageQualityScore: number;
  qualityDistribution: {
    high: number;
    medium: number;
    low: number;
  };
}
