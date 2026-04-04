export type StudyStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type QuestionType = "SHORT_TEXT" | "LONG_TEXT" | "MULTIPLE_CHOICE" | "CHECKBOX" | "SCALE";
export type EnrollmentStatus = "VERIFIED" | "IN_PROGRESS" | "COMPLETED" | "FLAGGED";

// ---- Dependencies ----
export type DependencyCondition = "equals" | "not_equals" | "includes" | "not_includes" | "gte" | "lte" | "between";

export interface QuestionDependency {
  questionId: string;
  condition: DependencyCondition;
  value: string | string[] | number | [number, number];
}

// ---- Question Config ----
export interface ScaleConfig {
  min: number;
  max: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface QuestionConfig {
  scale?: ScaleConfig;
}

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
  publiclyListed?: boolean;
  questions: Array<{
    order: number;
    type: QuestionType;
    prompt: string;
    options?: string[];
    required?: boolean;
    config?: QuestionConfig;
    dependsOn?: QuestionDependency;
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
    required: boolean;
    config: QuestionConfig | null;
    dependsOn: QuestionDependency | null;
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
  missedParts: string[];
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

// ---- Analytics ----
export interface AnalyticsEnrollment {
  id: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
  avgOverall: number | null;
  avgCoherence: number | null;
  avgEffort: number | null;
  avgConsistency: number | null;
  hasFlaggedResponse: boolean;
  flagReasons: string | null;
}

export interface AnalyticsQuestion {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  responseCount: number;
  responseRate: number;
  avgQuality: number | null;
  stat: string;
}

export interface AnalyticsResponseDetail {
  question: string;
  answer: string;
  score: number | null;
  flagged: boolean;
}

export interface AnalyticsData {
  enrollments: AnalyticsEnrollment[];
  dimensions: {
    coherence: number;
    effort: number;
    consistency: number;
    overall: number;
  };
  qualityDistribution: {
    high: number;
    moderate: number;
    flagged: number;
  };
  trend: Array<{
    date: string;
    enrolled: number;
    completed: number;
    flagged: number;
  }>;
  questions: AnalyticsQuestion[];
  responsesByEnrollment: Record<string, AnalyticsResponseDetail[]>;
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
