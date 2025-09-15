"use client"

import { useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Textarea } from '@workspace/ui/components/textarea'
import { Badge } from '@workspace/ui/components/badge'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

interface AssessmentResult {
  marksAwarded: number
  maxMarks: number
  feedback: string
  modelAnswer: string
  marked: boolean
}

interface QuestionAssessmentProps {
  questionId: string
  questionText: string
  maxMarks: number
  onAssessmentComplete?: (result: AssessmentResult) => void
}

export function QuestionAssessment({ 
  questionId, 
  questionText, 
  maxMarks,
  onAssessmentComplete 
}: QuestionAssessmentProps) {
  const [userAnswer, setUserAnswer] = useState('')
  const [isAssessing, setIsAssessing] = useState(false)
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmitAssessment = async () => {
    if (!userAnswer.trim()) {
      setError('Please provide an answer before submitting')
      return
    }

    setIsAssessing(true)
    setError(null)

    try {
      const response = await fetch('/api/assess-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId,
          userAnswer: userAnswer.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error(`Assessment failed: ${response.statusText}`)
      }

      const result = await response.json()
      setAssessment(result)
      onAssessmentComplete?.(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assessment failed')
    } finally {
      setIsAssessing(false)
    }
  }

  const getScoreColor = (score: number, max: number) => {
    const percentage = (score / max) * 100
    if (percentage >= 80) return 'bg-green-500'
    if (percentage >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Question Assessment
          <Badge variant="outline">{maxMarks} marks</Badge>
        </CardTitle>
        <CardDescription>{questionText}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Answer Input */}
        <div className="space-y-2">
          <label htmlFor="user-answer" className="text-sm font-medium">
            Your Answer:
          </label>
          <Textarea
            id="user-answer"
            placeholder="Enter your answer here..."
            value={userAnswer}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setUserAnswer(e.target.value)}
            disabled={isAssessing || assessment !== null}
            rows={6}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Submit Button */}
        {!assessment && (
          <Button 
            onClick={handleSubmitAssessment}
            disabled={isAssessing || !userAnswer.trim()}
            className="w-full"
          >
            {isAssessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assessing Answer...
              </>
            ) : (
              'Submit for Assessment'
            )}
          </Button>
        )}

        {/* Assessment Results */}
        {assessment && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Assessment Complete
              </h3>
              <Badge 
                className={`${getScoreColor(assessment.marksAwarded, assessment.maxMarks)} text-white`}
              >
                {assessment.marksAwarded}/{assessment.maxMarks} marks
              </Badge>
            </div>

            {/* Feedback */}
            <div className="space-y-2">
              <h4 className="font-medium">Feedback:</h4>
              <div className="bg-muted p-3 rounded-md text-sm">
                {assessment.feedback}
              </div>
            </div>

            {/* Model Answer */}
            <div className="space-y-2">
              <h4 className="font-medium">Model Answer:</h4>
              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md text-sm border border-blue-200 dark:border-blue-800">
                {assessment.modelAnswer}
              </div>
            </div>

            {/* Reset Option */}
            <Button 
              variant="outline" 
              onClick={() => {
                setAssessment(null)
                setUserAnswer('')
                setError(null)
              }}
              className="w-full"
            >
              Reset and Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
