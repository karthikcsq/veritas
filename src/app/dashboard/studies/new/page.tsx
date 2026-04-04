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

    try {
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

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create study");
      }

      const data = await res.json();
      const qa = data.qualityAnalysis;

      // Always show quality results before navigating
      if (qa) {
        setQualityResult(qa);
        setCreatedStudyId(data.study.id);
      } else {
        router.push(`/dashboard/studies/${data.study.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
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

          {submitting ? (
            <div className="w-full space-y-2">
              <div className="text-sm text-center text-muted-foreground font-medium">
                Checking for reverse-score recommendations...
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full animate-pulse" style={{ width: "100%" }} />
              </div>
            </div>
          ) : (
            <Button type="submit" size="lg" className="w-full" disabled={!!qualityResult}>
              Create Study
            </Button>
          )}
        </form>

        {/* Quality summary + continue */}
        {qualityResult && createdStudyId && (
          <Card className="border-2 border-violet-300 bg-violet-50">
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
