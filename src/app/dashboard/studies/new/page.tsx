"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QuestionDraft {
  order: number;
  type: string;
  prompt: string;
}

export default function NewStudyPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetCount, setTargetCount] = useState("");
  const [compensation, setCompensation] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    { order: 1, type: "LONG_TEXT", prompt: "" },
  ]);

  function addQuestion() {
    setQuestions([
      ...questions,
      { order: questions.length + 1, type: "LONG_TEXT", prompt: "" },
    ]);
  }

  function updateQuestion(index: number, prompt: string) {
    const updated = [...questions];
    updated[index].prompt = prompt;
    setQuestions(updated);
  }

  function removeQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i + 1 })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: POST /api/studies
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              &larr; Back
            </Button>
          </Link>
          <h1 className="font-semibold">Create New Study</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
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
              {questions.map((q, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0 mt-1">
                    {q.order}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Enter your question..."
                      value={q.prompt}
                      onChange={(e) => updateQuestion(i, e.target.value)}
                      required
                    />
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={q.type}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[i].type = e.target.value;
                        setQuestions(updated);
                      }}
                    >
                      <option value="LONG_TEXT">Long Text</option>
                      <option value="SHORT_TEXT">Short Text</option>
                      <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                      <option value="SCALE">Scale (1-10)</option>
                    </select>
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
              ))}
              <Button type="button" variant="outline" onClick={addQuestion} className="w-full">
                + Add Question
              </Button>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full">
            Create Study
          </Button>
        </form>
      </div>
    </div>
  );
}
