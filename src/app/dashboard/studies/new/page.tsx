"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { QuestionDependency, ScaleConfig, DependencyCondition } from "@/types";

interface QuestionDraft {
  order: number;
  type: string;
  prompt: string;
  options?: string[];
  required: boolean;
  scaleConfig?: ScaleConfig;
  dependsOn?: QuestionDependency;
}

export default function NewStudyPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetCount, setTargetCount] = useState("");
  const [compensation, setCompensation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<"idle" | "creating" | "specificity" | "reverse" | "done">("idle");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [qualityResult, setQualityResult] = useState<{
    reversePairsDetected: number;
    reversePairs: Array<{ construct: string; relationship: string }>;
    recommendations: Array<{
      originalQuestionId: string;
      originalPrompt: string;
      reversePrompt: string;
      reverseType: string;
      reverseConfig: { scale?: { min: number; max: number; minLabel?: string; maxLabel?: string } } | null;
      explanation: string;
      suggestedOrder: number;
    }>;
    message: string;
  } | null>(null);
  const [specificityResult, setSpecificityResult] = useState<{
    suggestions: Array<{ questionIndex: number; originalPrompt: string; suggestedPrompt: string; reason: string }>;
    message: string;
  } | null>(null);
  const [acceptedSpecificity, setAcceptedSpecificity] = useState<Set<number>>(new Set());
  const [createdStudyId, setCreatedStudyId] = useState<string | null>(null);
  const [acceptedRecs, setAcceptedRecs] = useState<Set<string>>(new Set());

  function acceptRecommendation(rec: NonNullable<typeof qualityResult>["recommendations"][number]) {
    if (!createdStudyId) return;
    setAcceptedRecs((prev) => new Set(prev).add(rec.originalPrompt));

    // Add the reverse question to the study via API
    fetch(`/api/studies/${createdStudyId}/add-question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: rec.reverseType || "SCALE",
        prompt: rec.reversePrompt,
        order: rec.suggestedOrder,
        required: true,
        config: rec.reverseConfig,
      }),
    }).catch(console.error);
  }

  function dismissRecommendation(originalPrompt: string) {
    setAcceptedRecs((prev) => new Set(prev).add(originalPrompt));
  }
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    { order: 1, type: "LONG_TEXT", prompt: "", required: true },
  ]);

  function addQuestion() {
    setQuestions([
      ...questions,
      { order: questions.length + 1, type: "LONG_TEXT", prompt: "", required: true },
    ]);
  }

  function updateQuestion(index: number, field: Partial<QuestionDraft>) {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...field };
    if (field.type) {
      if (field.type === "SCALE" && !updated[index].scaleConfig) {
        updated[index].scaleConfig = { min: 1, max: 10 };
      }
      if ((field.type === "MULTIPLE_CHOICE" || field.type === "CHECKBOX") && !updated[index].options) {
        updated[index].options = [""];
      }
      if (field.type !== "SCALE") delete updated[index].scaleConfig;
      if (field.type !== "MULTIPLE_CHOICE" && field.type !== "CHECKBOX") delete updated[index].options;
    }
    setQuestions(updated);
  }

  function removeQuestion(index: number) {
    const removed = questions[index];
    const filtered = questions.filter((_, i) => i !== index).map((q, i) => {
      const updated = { ...q, order: i + 1 };
      if (updated.dependsOn?.questionId === `idx_${index}`) {
        delete updated.dependsOn;
      }
      return updated;
    });
    setQuestions(filtered);
  }

  function addOption(qIndex: number) {
    const updated = [...questions];
    updated[qIndex].options = [...(updated[qIndex].options || []), ""];
    setQuestions(updated);
  }

  function updateOption(qIndex: number, optIndex: number, value: string) {
    const updated = [...questions];
    const opts = [...(updated[qIndex].options || [])];
    opts[optIndex] = value;
    updated[qIndex].options = opts;
    setQuestions(updated);
  }

  function removeOption(qIndex: number, optIndex: number) {
    const updated = [...questions];
    updated[qIndex].options = (updated[qIndex].options || []).filter((_, i) => i !== optIndex);
    setQuestions(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setAnalysisPhase("creating");
    setAnalysisProgress(0);

    try {
      // Phase 1: Create the study
      const progressInterval = setInterval(() => {
        setAnalysisProgress((p) => Math.min(p + 2, 90));
      }, 200);

      const res = await fetch("/api/studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          targetCount: parseInt(targetCount, 10),
          compensationUsd: parseFloat(compensation),
          questions: questions.map((q) => ({
            order: q.order,
            type: q.type,
            prompt: q.prompt,
            required: q.required,
            options: q.options,
            config: q.scaleConfig ? { scale: q.scaleConfig } : undefined,
            dependsOn: q.dependsOn,
          })),
        }),
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create study");
      }

      const data = await res.json();
      const studyId = data.study.id;
      setCreatedStudyId(studyId);
      setAnalysisProgress(100);

      // Phase 2: Specificity analysis
      setAnalysisPhase("specificity");
      setAnalysisProgress(0);
      const specInterval = setInterval(() => {
        setAnalysisProgress((p) => Math.min(p + 3, 90));
      }, 200);

      try {
        const specRes = await fetch(`/api/studies/${studyId}/analyze-specificity`, { method: "POST" });
        if (specRes.ok) {
          const specData = await specRes.json();
          if (specData.suggestions?.length > 0) {
            setSpecificityResult(specData);
            clearInterval(specInterval);
            setAnalysisProgress(100);
            // Scroll to first specificity suggestion
            const firstIdx = specData.suggestions[0].questionIndex;
            setTimeout(() => {
              document.getElementById(`spec-${firstIdx}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 200);
            setAnalysisPhase("done");
            setSubmitting(false);
            return; // Stop here — reverse runs after specificity is resolved
          }
        }
      } catch (err) {
        console.error("Specificity check failed (non-fatal):", err);
      }
      clearInterval(specInterval);
      setAnalysisProgress(100);

      // Phase 3: Reverse-score analysis (only if no specificity issues)
      await runReverseAnalysis(studyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setAnalysisPhase("idle");
    } finally {
      setSubmitting(false);
    }
  }

  async function runReverseAnalysis(studyId: string) {
    setAnalysisPhase("reverse");
    setAnalysisProgress(0);
    const revInterval = setInterval(() => {
      setAnalysisProgress((p) => Math.min(p + 3, 90));
    }, 200);

    try {
      const revRes = await fetch(`/api/studies/${studyId}/analyze-reverse`, { method: "POST" });
      clearInterval(revInterval);
      setAnalysisProgress(100);

      if (revRes.ok) {
        const revData = await revRes.json();
        setQualityResult(revData);
        setAnalysisPhase("done");

        if (revData.recommendations?.length > 0) {
          const firstOriginal = revData.recommendations[0].originalPrompt;
          const idx = questions.findIndex((q) => q.prompt === firstOriginal);
          if (idx >= 0) {
            setTimeout(() => {
              document.getElementById(`rec-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 200);
          }
        } else {
          setTimeout(() => {
            document.getElementById("quality-summary")?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 200);
        }
      }
    } catch (err) {
      clearInterval(revInterval);
      console.error("Reverse analysis failed (non-fatal):", err);
      setAnalysisPhase("done");
    }
  }

  function acceptSpecificity(suggestion: NonNullable<typeof specificityResult>["suggestions"][number]) {
    if (!createdStudyId) return;
    setAcceptedSpecificity((prev) => new Set(prev).add(suggestion.questionIndex));

    // Update the question in DB
    fetch(`/api/studies/${createdStudyId}/add-question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: questions[suggestion.questionIndex]?.type ?? "SCALE",
        prompt: suggestion.suggestedPrompt,
        order: suggestion.questionIndex + 1,
        required: true,
      }),
    }).catch(console.error);

    // Check if all specificity suggestions handled
    const remaining = specificityResult?.suggestions.filter(
      (s) => !acceptedSpecificity.has(s.questionIndex) && s.questionIndex !== suggestion.questionIndex
    );
    if (remaining && remaining.length > 0) {
      setTimeout(() => {
        document.getElementById(`spec-${remaining[0].questionIndex}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } else if (createdStudyId) {
      // All specificity handled — run reverse analysis
      runReverseAnalysis(createdStudyId);
    }
  }

  function dismissSpecificity(questionIndex: number) {
    setAcceptedSpecificity((prev) => new Set(prev).add(questionIndex));

    const remaining = specificityResult?.suggestions.filter(
      (s) => !acceptedSpecificity.has(s.questionIndex) && s.questionIndex !== questionIndex
    );
    if (remaining && remaining.length > 0) {
      setTimeout(() => {
        document.getElementById(`spec-${remaining[0].questionIndex}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } else if (createdStudyId) {
      runReverseAnalysis(createdStudyId);
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            &larr; Back
          </Button>
        </Link>
        <h1 className="font-semibold text-lg">Create New Study</h1>
      </div>

      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Study info */}
          <Card>
            <CardHeader>
              <CardTitle>Study Details</CardTitle>
              <CardDescription>
                Basic information about your research study
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Study Title</Label>
                <Input
                  id="title"
                  placeholder="Pain Management in Adults Over 50"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="A survey study examining..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="target">Target Participants</Label>
                  <Input
                    id="target"
                    type="number"
                    placeholder="200"
                    value={targetCount}
                    onChange={(e) => setTargetCount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compensation">Compensation (USD)</Label>
                  <Input
                    id="compensation"
                    type="number"
                    step="0.01"
                    placeholder="25.00"
                    value={compensation}
                    onChange={(e) => setCompensation(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Questions */}
          <Card>
            <CardHeader>
              <CardTitle>Questions</CardTitle>
              <CardDescription>
                Add questions for participants to answer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((q, i) => {
                // Find recommendation that targets this question
                const rec = qualityResult?.recommendations.find(
                  (r) => r.originalPrompt === q.prompt && !acceptedRecs.has(r.originalPrompt)
                );
                return (
                <div key={i}>
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0 mt-1">
                      {q.order}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Enter your question..."
                        value={q.prompt}
                        onChange={(e) => updateQuestion(i, { prompt: e.target.value })}
                        required
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={q.type}
                          onChange={(e) => updateQuestion(i, { type: e.target.value })}
                        >
                          <option value="LONG_TEXT">Long Text</option>
                          <option value="SHORT_TEXT">Short Text</option>
                          <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                          <option value="CHECKBOX">Checkbox (Multi-select)</option>
                          <option value="SCALE">Number Scale</option>
                        </select>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={(e) => updateQuestion(i, { required: e.target.checked })}
                          />
                          Required
                        </label>
                      </div>
                    </div>
                    {questions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(i)}
                        className="mt-1"
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  {/* Options editor for MCQ / Checkbox */}
                  {(q.type === "MULTIPLE_CHOICE" || q.type === "CHECKBOX") && (
                    <div className="ml-11 space-y-2">
                      <Label className="text-xs text-muted-foreground">Options</Label>
                      {(q.options || []).map((opt, oi) => (
                        <div key={oi} className="flex gap-2">
                          <Input
                            placeholder={`Option ${oi + 1}`}
                            value={opt}
                            onChange={(e) => updateOption(i, oi, e.target.value)}
                            required
                          />
                          {(q.options?.length ?? 0) > 1 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(i, oi)}>
                              &times;
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => addOption(i)}>
                        + Add Option
                      </Button>
                    </div>
                  )}

                  {/* Scale config */}
                  {q.type === "SCALE" && (
                    <div className="ml-11 grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Min</Label>
                        <Input
                          type="number"
                          value={q.scaleConfig?.min ?? 1}
                          onChange={(e) => updateQuestion(i, { scaleConfig: { ...q.scaleConfig!, min: Number(e.target.value) } })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max</Label>
                        <Input
                          type="number"
                          value={q.scaleConfig?.max ?? 10}
                          onChange={(e) => updateQuestion(i, { scaleConfig: { ...q.scaleConfig!, max: Number(e.target.value) } })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Min Label</Label>
                        <Input
                          placeholder="e.g. No pain"
                          value={q.scaleConfig?.minLabel ?? ""}
                          onChange={(e) => updateQuestion(i, { scaleConfig: { ...q.scaleConfig!, minLabel: e.target.value } })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max Label</Label>
                        <Input
                          placeholder="e.g. Worst pain"
                          value={q.scaleConfig?.maxLabel ?? ""}
                          onChange={(e) => updateQuestion(i, { scaleConfig: { ...q.scaleConfig!, maxLabel: e.target.value } })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Dependency config */}
                  {i > 0 && (
                    <div className="ml-11 space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!q.dependsOn}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const prevQ = questions[i - 1];
                              updateQuestion(i, {
                                dependsOn: {
                                  questionId: `order_${prevQ.order}`,
                                  condition: "equals",
                                  value: "",
                                },
                              });
                            } else {
                              const updated = [...questions];
                              delete updated[i].dependsOn;
                              setQuestions(updated);
                            }
                          }}
                        />
                        <span className="text-muted-foreground">Show conditionally based on another answer</span>
                      </label>
                      {q.dependsOn && (
                        <div className="grid grid-cols-3 gap-2">
                          <select
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={q.dependsOn.questionId}
                            onChange={(e) =>
                              updateQuestion(i, {
                                dependsOn: { ...q.dependsOn!, questionId: e.target.value },
                              })
                            }
                          >
                            {questions.slice(0, i).map((pq, pi) => (
                              <option key={pi} value={`order_${pq.order}`}>
                                Q{pq.order}
                              </option>
                            ))}
                          </select>
                          <select
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={q.dependsOn.condition}
                            onChange={(e) =>
                              updateQuestion(i, {
                                dependsOn: { ...q.dependsOn!, condition: e.target.value as DependencyCondition },
                              })
                            }
                          >
                            <option value="equals">equals</option>
                            <option value="not_equals">not equals</option>
                            <option value="includes">includes</option>
                            <option value="not_includes">not includes</option>
                            <option value="gte">greater or equal</option>
                            <option value="lte">less or equal</option>
                            <option value="between">between</option>
                          </select>
                          <Input
                            placeholder="Value"
                            value={String(q.dependsOn.value)}
                            onChange={(e) =>
                              updateQuestion(i, {
                                dependsOn: { ...q.dependsOn!, value: e.target.value },
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline specificity suggestion */}
                {(() => {
                  const spec = specificityResult?.suggestions.find(
                    (s) => s.questionIndex === i && !acceptedSpecificity.has(s.questionIndex)
                  );
                  if (!spec) return null;
                  return (
                    <div
                      id={`spec-${i}`}
                      className="border-2 border-blue-400 bg-blue-50 rounded-lg p-4 space-y-2 ml-6"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-sm font-medium shrink-0 mt-1">
                          !
                        </div>
                        <div className="flex-1 space-y-1">
                          <span className="text-xs font-medium text-blue-700 bg-blue-200 px-2 py-0.5 rounded">
                            Specificity Improvement
                          </span>
                          <p className="font-medium text-blue-900">&ldquo;{spec.suggestedPrompt}&rdquo;</p>
                          <p className="text-xs text-blue-600">{spec.reason}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-11">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-500 text-white"
                          onClick={() => acceptSpecificity(spec)}
                        >
                          Accept
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-blue-600"
                          onClick={() => dismissSpecificity(spec.questionIndex)}
                        >
                          Skip
                        </Button>
                      </div>
                    </div>
                  );
                })()}

                {/* Inline recommendation card */}
                {rec && (
                  <div
                    id={`rec-${i}`}
                    className="border-2 border-violet-400 bg-violet-50 rounded-lg p-4 space-y-2 ml-6 animate-in fade-in slide-in-from-top-2"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-violet-200 text-violet-700 flex items-center justify-center text-sm font-medium shrink-0 mt-1">
                        +
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-violet-700 bg-violet-200 px-2 py-0.5 rounded">
                            Suggested Reverse Question
                          </span>
                        </div>
                        <p className="font-medium text-violet-900">&ldquo;{rec.reversePrompt}&rdquo;</p>
                        <p className="text-xs text-violet-600">{rec.explanation}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-11">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-violet-600 hover:bg-violet-500 text-white"
                        onClick={() => {
                          acceptRecommendation(rec);
                          // Scroll to next recommendation
                          const nextRec = qualityResult?.recommendations.find(
                            (r) => r.originalPrompt !== rec.originalPrompt && !acceptedRecs.has(r.originalPrompt)
                          );
                          if (nextRec) {
                            const nextIdx = questions.findIndex((qq) => qq.prompt === nextRec.originalPrompt);
                            if (nextIdx >= 0) {
                              setTimeout(() => {
                                document.getElementById(`rec-${nextIdx}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                              }, 100);
                            }
                          }
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-violet-600"
                        onClick={() => {
                          dismissRecommendation(rec.originalPrompt);
                          // Scroll to next recommendation
                          const nextRec = qualityResult?.recommendations.find(
                            (r) => r.originalPrompt !== rec.originalPrompt && !acceptedRecs.has(r.originalPrompt)
                          );
                          if (nextRec) {
                            const nextIdx = questions.findIndex((qq) => qq.prompt === nextRec.originalPrompt);
                            if (nextIdx >= 0) {
                              setTimeout(() => {
                                document.getElementById(`rec-${nextIdx}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                              }, 100);
                            }
                          }
                        }}
                      >
                        Skip
                      </Button>
                    </div>
                  </div>
                )}
                </div>
                );
              })}
              <Button type="button" variant="outline" onClick={addQuestion} className="w-full">
                + Add Question
              </Button>
            </CardContent>
          </Card>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {submitting || analysisPhase !== "idle" ? (
            <div className="w-full space-y-3">
              {/* Specificity bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className={`font-medium ${analysisPhase === "specificity" ? "text-blue-700" : analysisPhase === "creating" ? "text-muted-foreground" : "text-green-700"}`}>
                    {analysisPhase === "creating" ? "Creating study..." : analysisPhase === "specificity" ? "Checking question specificity..." : "Specificity check complete"}
                  </span>
                  {(analysisPhase === "creating" || analysisPhase === "specificity") && (
                    <span className="text-muted-foreground">{analysisProgress}%</span>
                  )}
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      analysisPhase === "creating" || analysisPhase === "specificity" ? "bg-blue-500" : "bg-green-500"
                    }`}
                    style={{ width: `${analysisPhase === "creating" || analysisPhase === "specificity" ? analysisProgress : 100}%` }}
                  />
                </div>
              </div>

              {/* Reverse bar — only visible after specificity */}
              {(analysisPhase === "reverse" || (analysisPhase === "done" && qualityResult)) && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={`font-medium ${analysisPhase === "reverse" ? "text-violet-700" : "text-green-700"}`}>
                      {analysisPhase === "reverse" ? "Checking for reverse-score recommendations..." : "Reverse-score check complete"}
                    </span>
                    {analysisPhase === "reverse" && (
                      <span className="text-muted-foreground">{analysisProgress}%</span>
                    )}
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        analysisPhase === "reverse" ? "bg-violet-500" : "bg-green-500"
                      }`}
                      style={{ width: `${analysisPhase === "reverse" ? analysisProgress : 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button type="submit" size="lg" className="w-full" disabled={!!qualityResult || !!specificityResult}>
              Create Study
            </Button>
          )}
        </form>

        {/* Quality summary + continue */}
        {qualityResult && createdStudyId && (
          <Card id="quality-summary" className="border-2 border-violet-300 bg-violet-50">
            <CardContent className="py-4 space-y-3">
              <p className="text-sm font-medium text-violet-900">{qualityResult.message}</p>
              {qualityResult.reversePairsDetected > 0 && (
                <div className="space-y-1">
                  {qualityResult.reversePairs.map((p, i) => (
                    <p key={i} className="text-xs text-violet-700">
                      Detected pair: <span className="font-medium">{p.construct}</span> — {p.relationship}
                    </p>
                  ))}
                </div>
              )}
              <Button onClick={() => router.push(`/dashboard/studies/${createdStudyId}`)} className="w-full">
                Continue to Study
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
