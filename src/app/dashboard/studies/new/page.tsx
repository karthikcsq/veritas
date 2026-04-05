"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type {
  QuestionDependency,
  ScaleConfig,
  DependencyCondition,
} from "@/types";

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
  const [analysisPhase, setAnalysisPhase] = useState<
    "idle" | "creating" | "specificity" | "reverse" | "done"
  >("idle");
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
      reverseConfig: {
        scale?: {
          min: number;
          max: number;
          minLabel?: string;
          maxLabel?: string;
        };
      } | null;
      explanation: string;
      suggestedOrder: number;
    }>;
    message: string;
  } | null>(null);
  const [specificityResult, setSpecificityResult] = useState<{
    suggestions: Array<{
      questionIndex: number;
      originalPrompt: string;
      suggestedPrompt: string;
      reason: string;
      suggestedType?: string;
      suggestedConfig?: {
        scale?: {
          min: number;
          max: number;
          minLabel?: string;
          maxLabel?: string;
        };
      } | null;
    }>;
    message: string;
  } | null>(null);
  const [acceptedSpecificity, setAcceptedSpecificity] = useState<Set<number>>(
    new Set()
  );
  const [createdStudyId, setCreatedStudyId] = useState<string | null>(null);
  const [acceptedRecs, setAcceptedRecs] = useState<Set<string>>(new Set());
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function handleDrop(dropIdx: number) {
    if (dragIdx === null || dragIdx === dropIdx) return;
    const updated = [...questions];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(dropIdx, 0, moved);
    const reordered = updated.map((q, i) => ({ ...q, order: i + 1 }));
    setQuestions(reordered);

    const newIndexByPrompt = new Map<string, number>();
    reordered.forEach((q, i) => newIndexByPrompt.set(q.prompt, i));

    if (specificityResult) {
      setSpecificityResult({
        ...specificityResult,
        suggestions: specificityResult.suggestions.map((s) => {
          const newIdx = newIndexByPrompt.get(s.originalPrompt);
          return newIdx !== undefined ? { ...s, questionIndex: newIdx } : s;
        }),
      });
    }

    if (qualityResult) {
      setQualityResult({
        ...qualityResult,
        recommendations: qualityResult.recommendations.map((r) => {
          const origNewIdx = newIndexByPrompt.get(r.originalPrompt);
          if (origNewIdx === undefined) return r;
          const oldOrigIdx = questions.findIndex(
            (q) => q.prompt === r.originalPrompt
          );
          const distance = r.suggestedOrder - (oldOrigIdx + 1);
          const newSuggestedOrder = Math.max(
            1,
            Math.min(reordered.length, origNewIdx + 1 + distance)
          );
          return { ...r, suggestedOrder: newSuggestedOrder };
        }),
      });
    }

    setDragIdx(null);
    setDragOverIdx(null);
  }

  function acceptRecommendation(
    rec: NonNullable<typeof qualityResult>["recommendations"][number]
  ) {
    if (!createdStudyId) return;
    setAcceptedRecs((prev) => new Set(prev).add(rec.originalPrompt));

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
      {
        order: questions.length + 1,
        type: "LONG_TEXT",
        prompt: "",
        required: true,
      },
    ]);
  }

  function updateQuestion(index: number, field: Partial<QuestionDraft>) {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...field };
    if (field.type) {
      if (field.type === "SCALE" && !updated[index].scaleConfig) {
        updated[index].scaleConfig = { min: 1, max: 10 };
      }
      if (
        (field.type === "MULTIPLE_CHOICE" || field.type === "CHECKBOX") &&
        !updated[index].options
      ) {
        updated[index].options = [""];
      }
      if (field.type !== "SCALE") delete updated[index].scaleConfig;
      if (field.type !== "MULTIPLE_CHOICE" && field.type !== "CHECKBOX")
        delete updated[index].options;
    }
    setQuestions(updated);
  }

  function removeQuestion(index: number) {
    const filtered = questions
      .filter((_, i) => i !== index)
      .map((q, i) => {
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
    updated[qIndex].options = (updated[qIndex].options || []).filter(
      (_, i) => i !== optIndex
    );
    setQuestions(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setAnalysisPhase("creating");
    setAnalysisProgress(0);

    try {
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
        const specRes = await fetch(
          `/api/studies/${studyId}/analyze-specificity`,
          { method: "POST" }
        );
        if (specRes.ok) {
          const specData = await specRes.json();
          if (specData.suggestions?.length > 0) {
            setSpecificityResult(specData);
            clearInterval(specInterval);
            setAnalysisProgress(100);
            const firstIdx = specData.suggestions[0].questionIndex;
            setTimeout(() => {
              document
                .getElementById(`spec-${firstIdx}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 200);
            setAnalysisPhase("done");
            setSubmitting(false);
            return;
          }
        }
      } catch (err) {
        console.error("Specificity check failed (non-fatal):", err);
      }
      clearInterval(specInterval);
      setAnalysisProgress(100);

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
      const revRes = await fetch(
        `/api/studies/${studyId}/analyze-reverse`,
        { method: "POST" }
      );
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
              document
                .getElementById(`rec-${idx}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 200);
          }
        } else {
          setTimeout(() => {
            document
              .getElementById("quality-summary")
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 200);
        }
      }
    } catch (err) {
      clearInterval(revInterval);
      console.error("Reverse analysis failed (non-fatal):", err);
      setAnalysisPhase("done");
    }
  }

  function acceptSpecificity(
    suggestion: NonNullable<typeof specificityResult>["suggestions"][number]
  ) {
    if (!createdStudyId) return;
    setAcceptedSpecificity((prev) =>
      new Set(prev).add(suggestion.questionIndex)
    );

    const updated = [...questions];
    if (updated[suggestion.questionIndex]) {
      const patch: Partial<QuestionDraft> = {
        prompt: suggestion.suggestedPrompt,
      };
      if (suggestion.suggestedType) {
        patch.type = suggestion.suggestedType;
        if (
          suggestion.suggestedType === "SCALE" &&
          suggestion.suggestedConfig?.scale
        ) {
          patch.scaleConfig = suggestion.suggestedConfig.scale;
        } else if (suggestion.suggestedType !== "SCALE") {
          patch.scaleConfig = undefined;
        }
      } else if (suggestion.suggestedConfig?.scale) {
        patch.scaleConfig = suggestion.suggestedConfig.scale;
      }
      updated[suggestion.questionIndex] = {
        ...updated[suggestion.questionIndex],
        ...patch,
      };
      setQuestions(updated);
    }

    const body: Record<string, unknown> = {
      questionOrder: suggestion.questionIndex + 1,
      prompt: suggestion.suggestedPrompt,
    };
    if (suggestion.suggestedType) body.type = suggestion.suggestedType;
    if (suggestion.suggestedConfig) body.config = suggestion.suggestedConfig;
    fetch(`/api/studies/${createdStudyId}/update-question`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(console.error);

    const remaining = specificityResult?.suggestions.filter(
      (s) =>
        !acceptedSpecificity.has(s.questionIndex) &&
        s.questionIndex !== suggestion.questionIndex
    );
    if (remaining && remaining.length > 0) {
      setTimeout(() => {
        document
          .getElementById(`spec-${remaining[0].questionIndex}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } else if (createdStudyId) {
      runReverseAnalysis(createdStudyId);
    }
  }

  function dismissSpecificity(questionIndex: number) {
    setAcceptedSpecificity((prev) => new Set(prev).add(questionIndex));

    const remaining = specificityResult?.suggestions.filter(
      (s) =>
        !acceptedSpecificity.has(s.questionIndex) &&
        s.questionIndex !== questionIndex
    );
    if (remaining && remaining.length > 0) {
      setTimeout(() => {
        document
          .getElementById(`spec-${remaining[0].questionIndex}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } else if (createdStudyId) {
      runReverseAnalysis(createdStudyId);
    }
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="ambient-blob-1 absolute -top-60 -left-60 h-[800px] w-[800px] rounded-full bg-[#1a5276]/20 blur-[150px]" />
        <div className="ambient-blob-2 absolute top-1/4 -right-40 h-[700px] w-[700px] rounded-full bg-[#2874a6]/15 blur-[130px]" />
        <div className="ambient-blob-3 absolute -bottom-60 left-1/4 h-[700px] w-[700px] rounded-full bg-[#1b4f72]/12 blur-[130px]" />
      </div>

      {/* Logo */}
      <div className="absolute top-6 left-6 z-10">
        <Link href="/dashboard">
          <Image
            src="/logo.png"
            alt="Veritas"
            width={40}
            height={40}
            className="rounded-full hover:opacity-80 transition-all cursor-pointer"
            style={{ filter: "brightness(1.4)" }}
          />
        </Link>
      </div>

      <div className="relative z-[1] max-w-2xl mx-auto px-6 pt-20 pb-12">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              &larr; Back
            </Button>
          </Link>
          <h1 className="font-semibold text-lg text-white">
            Create New Study
          </h1>
        </div>

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
                  className="w-full min-h-[100px] rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#3498db]"
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
                const rec = qualityResult?.recommendations.find(
                  (r) =>
                    r.suggestedOrder === q.order &&
                    !acceptedRecs.has(r.originalPrompt)
                );
                return (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => setDragIdx(i)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverIdx(i);
                    }}
                    onDragEnd={() => {
                      setDragIdx(null);
                      setDragOverIdx(null);
                    }}
                    onDrop={() => handleDrop(i)}
                    className={`${dragIdx === i ? "opacity-40" : ""} ${
                      dragOverIdx === i && dragIdx !== i
                        ? "border-t-2 border-t-[#3498db]"
                        : ""
                    }`}
                  >
                    <div className="border border-white/10 rounded-lg p-4 space-y-3 bg-white/[0.02]">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium text-white/70 shrink-0 mt-1 cursor-grab">
                          {q.order}
                        </div>
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Enter your question..."
                            value={q.prompt}
                            onChange={(e) =>
                              updateQuestion(i, { prompt: e.target.value })
                            }
                            required
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
                              value={q.type}
                              onChange={(e) =>
                                updateQuestion(i, { type: e.target.value })
                              }
                            >
                              <option value="LONG_TEXT">Long Text</option>
                              <option value="SHORT_TEXT">Short Text</option>
                              <option value="MULTIPLE_CHOICE">
                                Multiple Choice
                              </option>
                              <option value="CHECKBOX">
                                Checkbox (Multi-select)
                              </option>
                              <option value="SCALE">Number Scale</option>
                            </select>
                            <label className="flex items-center gap-2 text-sm text-white/70">
                              <input
                                type="checkbox"
                                checked={q.required}
                                onChange={(e) =>
                                  updateQuestion(i, {
                                    required: e.target.checked,
                                  })
                                }
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
                            className="mt-1 text-white/50 hover:text-white"
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      {/* Options editor for MCQ / Checkbox */}
                      {(q.type === "MULTIPLE_CHOICE" ||
                        q.type === "CHECKBOX") && (
                        <div className="ml-11 space-y-2">
                          <Label className="text-xs text-white/50">
                            Options
                          </Label>
                          {(q.options || []).map((opt, oi) => (
                            <div key={oi} className="flex gap-2">
                              <Input
                                placeholder={`Option ${oi + 1}`}
                                value={opt}
                                onChange={(e) =>
                                  updateOption(i, oi, e.target.value)
                                }
                                required
                              />
                              {(q.options?.length ?? 0) > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeOption(i, oi)}
                                  className="text-white/50"
                                >
                                  &times;
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addOption(i)}
                            className="border-white/10 text-white/70 hover:bg-white/10"
                          >
                            + Add Option
                          </Button>
                        </div>
                      )}

                      {/* Scale config */}
                      {q.type === "SCALE" && (
                        <div className="ml-11 grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-white/50">Min</Label>
                            <Input
                              type="number"
                              value={q.scaleConfig?.min ?? 1}
                              onChange={(e) =>
                                updateQuestion(i, {
                                  scaleConfig: {
                                    ...q.scaleConfig!,
                                    min: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-white/50">Max</Label>
                            <Input
                              type="number"
                              value={q.scaleConfig?.max ?? 10}
                              onChange={(e) =>
                                updateQuestion(i, {
                                  scaleConfig: {
                                    ...q.scaleConfig!,
                                    max: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-white/50">
                              Min Label
                            </Label>
                            <Input
                              placeholder="e.g. No pain"
                              value={q.scaleConfig?.minLabel ?? ""}
                              onChange={(e) =>
                                updateQuestion(i, {
                                  scaleConfig: {
                                    ...q.scaleConfig!,
                                    minLabel: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-white/50">
                              Max Label
                            </Label>
                            <Input
                              placeholder="e.g. Worst pain"
                              value={q.scaleConfig?.maxLabel ?? ""}
                              onChange={(e) =>
                                updateQuestion(i, {
                                  scaleConfig: {
                                    ...q.scaleConfig!,
                                    maxLabel: e.target.value,
                                  },
                                })
                              }
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
                            <span className="text-white/50">
                              Show conditionally based on another answer
                            </span>
                          </label>
                          {q.dependsOn && (
                            <div className="grid grid-cols-3 gap-2">
                              <select
                                className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
                                value={q.dependsOn.questionId}
                                onChange={(e) =>
                                  updateQuestion(i, {
                                    dependsOn: {
                                      ...q.dependsOn!,
                                      questionId: e.target.value,
                                    },
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
                                className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
                                value={q.dependsOn.condition}
                                onChange={(e) =>
                                  updateQuestion(i, {
                                    dependsOn: {
                                      ...q.dependsOn!,
                                      condition:
                                        e.target.value as DependencyCondition,
                                    },
                                  })
                                }
                              >
                                <option value="equals">equals</option>
                                <option value="not_equals">not equals</option>
                                <option value="includes">includes</option>
                                <option value="not_includes">
                                  not includes
                                </option>
                                <option value="gte">greater or equal</option>
                                <option value="lte">less or equal</option>
                                <option value="between">between</option>
                              </select>
                              <Input
                                placeholder="Value"
                                value={String(q.dependsOn.value)}
                                onChange={(e) =>
                                  updateQuestion(i, {
                                    dependsOn: {
                                      ...q.dependsOn!,
                                      value: e.target.value,
                                    },
                                  })
                                }
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Inline specificity suggestion — merge conflict style */}
                    {(() => {
                      const spec = specificityResult?.suggestions.find(
                        (s) =>
                          s.questionIndex === i &&
                          !acceptedSpecificity.has(s.questionIndex)
                      );
                      if (!spec) return null;

                      const typeLabel = (t: string) =>
                        t === "SCALE" ? "Number Scale" : t === "MULTIPLE_CHOICE" ? "Multiple Choice" : t.replace(/_/g, " ");
                      const hasTypeChange = spec.suggestedType && spec.suggestedType !== q.type;
                      const hasScaleChange = spec.suggestedConfig?.scale;

                      return (
                        <div
                          id={`spec-${i}`}
                          className="rounded-lg overflow-hidden mt-2 border border-white/10"
                        >
                          {/* Header bar */}
                          <div className="flex items-center justify-between px-4 py-2 bg-white/[0.04] border-b border-white/10">
                            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
                              Specificity Improvement
                            </span>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 px-3 text-xs bg-[#2874a6] hover:bg-[#3498db] text-white"
                                onClick={() => acceptSpecificity(spec)}
                              >
                                Accept
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-3 text-xs text-white/40 hover:text-white"
                                onClick={() =>
                                  dismissSpecificity(spec.questionIndex)
                                }
                              >
                                Skip
                              </Button>
                            </div>
                          </div>

                          {/* Side-by-side diff — aligned rows */}
                          {(() => {
                            const suggestedType = spec.suggestedType || q.type;
                            const curScale = q.type === "SCALE" ? q.scaleConfig : null;
                            const sugScale = hasScaleChange ? spec.suggestedConfig!.scale! : (suggestedType === "SCALE" ? curScale : null);
                            const showType = hasTypeChange || q.type !== "LONG_TEXT";
                            const showRange = curScale || sugScale;
                            const showLabels = curScale?.minLabel || sugScale?.minLabel;

                            const redPill = (text: string | null) =>
                              text ? (
                                <span className="inline-flex items-center rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-[11px] text-red-300/70">
                                  {text}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 text-[11px] text-white/20 italic">
                                  &mdash;
                                </span>
                              );

                            const bluePill = (text: string | null) =>
                              text ? (
                                <span className="inline-flex items-center rounded-full bg-[#2874a6]/15 border border-[#3498db]/20 px-2.5 py-1 text-[11px] text-[#85c1e9]/80">
                                  {text}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 text-[11px] text-white/20 italic">
                                  &mdash;
                                </span>
                              );

                            return (
                              <div className="grid grid-cols-2 divide-x divide-white/10">
                                {/* Headers */}
                                <div className="bg-red-500/[0.06] px-4 pt-3 pb-1">
                                  <span className="text-[10px] font-medium text-red-400/80 uppercase tracking-wider">Current</span>
                                </div>
                                <div className="bg-[#2874a6]/[0.06] px-4 pt-3 pb-1">
                                  <span className="text-[10px] font-medium text-[#5dade2]/80 uppercase tracking-wider">Suggested</span>
                                </div>

                                {/* Row 1: Prompt */}
                                <div className="bg-red-500/[0.06] px-4 py-2">
                                  <p className="text-sm text-red-200/90 leading-relaxed bg-red-950/40 rounded-md px-3 py-2 border-l-2 border-red-500/40">
                                    {spec.originalPrompt}
                                  </p>
                                </div>
                                <div className="bg-[#2874a6]/[0.06] px-4 py-2">
                                  <p className="text-sm text-[#aed6f1] leading-relaxed bg-[#1a3d5c]/50 rounded-md px-3 py-2 border-l-2 border-[#3498db]/60">
                                    {spec.suggestedPrompt}
                                  </p>
                                </div>

                                {/* Row 2: Type */}
                                {showType && (
                                  <>
                                    <div className="bg-red-500/[0.06] px-4 py-1.5">
                                      {redPill(typeLabel(q.type))}
                                    </div>
                                    <div className="bg-[#2874a6]/[0.06] px-4 py-1.5">
                                      {bluePill(typeLabel(suggestedType))}
                                    </div>
                                  </>
                                )}

                                {/* Row 3: Scale range */}
                                {showRange && (
                                  <>
                                    <div className="bg-red-500/[0.06] px-4 py-1.5">
                                      {redPill(curScale ? `${curScale.min} \u2013 ${curScale.max}` : null)}
                                    </div>
                                    <div className="bg-[#2874a6]/[0.06] px-4 py-1.5">
                                      {bluePill(sugScale ? `${sugScale.min} \u2013 ${sugScale.max}` : null)}
                                    </div>
                                  </>
                                )}

                                {/* Row 4: Labels */}
                                {showLabels && (
                                  <>
                                    <div className="bg-red-500/[0.06] px-4 pt-1.5 pb-3">
                                      {redPill(curScale?.minLabel ? `${curScale.minLabel} \u2192 ${curScale.maxLabel}` : null)}
                                    </div>
                                    <div className="bg-[#2874a6]/[0.06] px-4 pt-1.5 pb-3">
                                      {bluePill(sugScale?.minLabel ? `${sugScale.minLabel} \u2192 ${sugScale.maxLabel}` : null)}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()}

                          {/* Reason footer */}
                          <div className="px-4 py-2 bg-white/[0.02] border-t border-white/10">
                            <p className="text-xs text-white/40 italic">
                              {spec.reason}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Inline reverse recommendation */}
                    {rec &&
                      (() => {
                        const originalOrder =
                          questions.findIndex(
                            (qq) => qq.prompt === rec.originalPrompt
                          ) + 1;
                        return (
                          <div
                            id={`rec-${i}`}
                            className="border border-[#5dade2]/30 bg-[#1a5276]/20 rounded-lg p-4 space-y-2 ml-6 mt-2"
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-full bg-[#1a5276]/40 text-[#5dade2] flex items-center justify-center text-sm font-medium shrink-0 mt-1">
                                +
                              </div>
                              <div className="flex-1 space-y-1">
                                <span className="text-xs font-medium text-[#5dade2] bg-[#1a5276]/30 px-2 py-0.5 rounded">
                                  Suggested Reverse Question
                                </span>
                                <p className="font-medium text-white">
                                  &ldquo;{rec.reversePrompt}&rdquo;
                                </p>
                                <p className="text-xs text-white/60">
                                  {rec.explanation}
                                </p>
                                <p className="text-xs text-white/40 italic">
                                  This question checks consistency with Q
                                  {originalOrder} (&ldquo;
                                  {rec.originalPrompt}&rdquo;). Placed here
                                  intentionally — reverse questions work best
                                  when separated from the original.
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-11">
                              <Button
                                type="button"
                                size="sm"
                                className="bg-[#2874a6] hover:bg-[#3498db] text-white"
                                onClick={() => {
                                  acceptRecommendation(rec);
                                  const nextRec =
                                    qualityResult?.recommendations.find(
                                      (r) =>
                                        r.originalPrompt !==
                                          rec.originalPrompt &&
                                        !acceptedRecs.has(r.originalPrompt)
                                    );
                                  if (nextRec) {
                                    const nextIdx = questions.findIndex(
                                      (qq) =>
                                        qq.order === nextRec.suggestedOrder
                                    );
                                    if (nextIdx >= 0) {
                                      setTimeout(() => {
                                        document
                                          .getElementById(`rec-${nextIdx}`)
                                          ?.scrollIntoView({
                                            behavior: "smooth",
                                            block: "center",
                                          });
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
                                className="text-[#5dade2] hover:text-white"
                                onClick={() => {
                                  dismissRecommendation(rec.originalPrompt);
                                  const nextRec =
                                    qualityResult?.recommendations.find(
                                      (r) =>
                                        r.originalPrompt !==
                                          rec.originalPrompt &&
                                        !acceptedRecs.has(r.originalPrompt)
                                    );
                                  if (nextRec) {
                                    const nextIdx = questions.findIndex(
                                      (qq) =>
                                        qq.order === nextRec.suggestedOrder
                                    );
                                    if (nextIdx >= 0) {
                                      setTimeout(() => {
                                        document
                                          .getElementById(`rec-${nextIdx}`)
                                          ?.scrollIntoView({
                                            behavior: "smooth",
                                            block: "center",
                                          });
                                      }, 100);
                                    }
                                  }
                                }}
                              >
                                Skip
                              </Button>
                            </div>
                          </div>
                        );
                      })()}
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                onClick={addQuestion}
                className="w-full border-white/10 text-white/70 hover:bg-white/10"
              >
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
                  <span
                    className={`font-medium ${
                      analysisPhase === "specificity"
                        ? "text-[#5dade2]"
                        : analysisPhase === "creating"
                          ? "text-white/50"
                          : "text-emerald-400"
                    }`}
                  >
                    {analysisPhase === "creating"
                      ? "Creating study..."
                      : analysisPhase === "specificity"
                        ? "Checking question specificity..."
                        : "Specificity check complete"}
                  </span>
                  {(analysisPhase === "creating" ||
                    analysisPhase === "specificity") && (
                    <span className="text-white/50">{analysisProgress}%</span>
                  )}
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      analysisPhase === "creating" ||
                      analysisPhase === "specificity"
                        ? "bg-[#3498db]"
                        : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${
                        analysisPhase === "creating" ||
                        analysisPhase === "specificity"
                          ? analysisProgress
                          : 100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Reverse bar */}
              {(analysisPhase === "reverse" ||
                (analysisPhase === "done" && qualityResult)) && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span
                      className={`font-medium ${
                        analysisPhase === "reverse"
                          ? "text-[#5dade2]"
                          : "text-emerald-400"
                      }`}
                    >
                      {analysisPhase === "reverse"
                        ? "Checking for reverse-score recommendations..."
                        : "Reverse-score check complete"}
                    </span>
                    {analysisPhase === "reverse" && (
                      <span className="text-white/50">
                        {analysisProgress}%
                      </span>
                    )}
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        analysisPhase === "reverse"
                          ? "bg-[#3498db]"
                          : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${
                          analysisPhase === "reverse"
                            ? analysisProgress
                            : 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button
              type="submit"
              size="lg"
              className="w-full bg-[#2874a6] hover:bg-[#3498db] text-white"
              disabled={!!qualityResult || !!specificityResult}
            >
              Create Study
            </Button>
          )}
        </form>

        {/* Quality summary + continue */}
        {qualityResult && createdStudyId && (
          <Card id="quality-summary" className="mt-6">
            <CardContent className="py-4">
              <p className="text-sm text-white/60 mb-3">
                {qualityResult.message}
              </p>
              <Button
                onClick={() =>
                  router.push(`/dashboard/studies/${createdStudyId}`)
                }
                className="w-full bg-[#2874a6] hover:bg-[#3498db] text-white"
              >
                Continue to Study
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
