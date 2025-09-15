// Test script for the question assessment API
// Usage: node test-assessment.js

const API_BASE = 'http://localhost:3000'

// Mock data for testing
const testData = {
  questionId: 'test-question-id', // Replace with actual question ID
  userAnswer: 'This is a test answer that discusses photosynthesis, chlorophyll, and glucose production in plants.'
}

async function testAssessment() {
  try {
    console.log('Testing Question Assessment API...')
    console.log('Test data:', testData)
    
    const response = await fetch(`${API_BASE}/api/assess-question`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    })

    const result = await response.json()
    
    console.log('\n--- API Response ---')
    console.log('Status:', response.status)
    console.log('Response:', JSON.stringify(result, null, 2))

    if (result.success) {
      console.log('\n--- Assessment Summary ---')
      console.log(`Question: ${result.assessment.questionNumber}`)
      console.log(`Marks: ${result.assessment.marksAwarded}/${result.assessment.maxMarks} (${result.assessment.percentage}%)`)
      console.log(`Feedback: ${result.assessment.feedback}`)
      console.log(`Keywords Found: ${result.assessment.keywordMatches?.join(', ') || 'None'}`)
      console.log(`Missing Keywords: ${result.assessment.missingKeywords?.join(', ') || 'None'}`)
    }

  } catch (error) {
    console.error('Test failed:', error.message)
  }
}

async function testGetAssessment() {
  try {
    console.log('\n\nTesting GET Assessment API...')
    
    const response = await fetch(`${API_BASE}/api/assess-question?questionId=${testData.questionId}`)
    const result = await response.json()
    
    console.log('\n--- GET Response ---')
    console.log('Status:', response.status)
    console.log('Response:', JSON.stringify(result, null, 2))

  } catch (error) {
    console.error('GET test failed:', error.message)
  }
}

// Run tests
testAssessment().then(() => testGetAssessment())
