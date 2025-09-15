"use client"

import { useState } from 'react'
import { QuestionAssessment } from '@/components/question-assessment'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'

export default function AssessmentDemo() {
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null)

  // Mock questions for demo
  const sampleQuestions = [
    {
      id: "q1",
      text: "Explain the process of photosynthesis and its importance in the ecosystem.",
      maxMarks: 10,
      subject: "Biology"
    },
    {
      id: "q2", 
      text: "Calculate the derivative of f(x) = 3x² + 2x - 5",
      maxMarks: 6,
      subject: "Mathematics"
    },
    {
      id: "q3",
      text: "Discuss the causes and effects of World War I.",
      maxMarks: 15,
      subject: "History"
    }
  ]

  const handleAssessmentComplete = (result: any) => {
    console.log('Assessment completed:', result)
    // You could update a parent state, show a notification, etc.
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Question Assessment Demo</h1>
        <p className="text-muted-foreground">
          Test the AI-powered question assessment system with mark scheme comparison
        </p>
      </div>

      {!selectedQuestion ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sampleQuestions.map((question) => (
            <Card key={question.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{question.subject}</CardTitle>
                <CardDescription className="text-sm">
                  {question.maxMarks} marks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">{question.text}</p>
                <Button 
                  onClick={() => setSelectedQuestion(question)}
                  className="w-full"
                >
                  Start Assessment
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-4">
          <Button 
            variant="outline" 
            onClick={() => setSelectedQuestion(null)}
            className="mb-4"
          >
            ← Back to Questions
          </Button>
          
          <QuestionAssessment
            questionId={selectedQuestion.id}
            questionText={selectedQuestion.text}
            maxMarks={selectedQuestion.maxMarks}
            onAssessmentComplete={handleAssessmentComplete}
          />
        </div>
      )}

      {/* Usage Instructions */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>1. 1-to-1 Reference Match:</strong> The system first tries to find an exact mark scheme match by question number.</p>
          <p><strong>2. Vector Search Fallback:</strong> If no exact match is found, it uses semantic similarity to find the most relevant mark scheme.</p>
          <p><strong>3. Model Answer Generation:</strong> Extracts the model answer from the mark scheme or generates one using AI if not available.</p>
          <p><strong>4. AI Assessment:</strong> Compares your answer against marking criteria, keywords, and acceptable answers.</p>
          <p><strong>5. Mark Calculation:</strong> Awards marks based on the rubric and provides detailed feedback.</p>
        </CardContent>
      </Card>
    </div>
  )
}
