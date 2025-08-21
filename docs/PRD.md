
---

# 📘 Product Requirement Plan (PRP)

**Project Name:** Exam Paper Parser & Solver
**Owner:** Raya Prayuda
**Date:** 2025-08-16

---

## 1. Purpose

The system enables automated processing of exam papers (e.g., Edexcel Physics/Maths) by combining **Google Document AI OCR** with a **math/physics-tuned LLM**.
It extracts structured text, converts it into **JSON/Markdown**, and provides **step-by-step reasoning** through an API.

---

## 2. Objectives

* Extract exam content from PDFs/images into **structured JSON**.
* Provide **step-by-step solutions** using a specialized LLM.
* Deliver results through a **REST API**.
* Optimize for **speed, accuracy, and GPU cost efficiency**.

---

## 3. Scope

* ✅ Parse printed exam questions (also handwritten).
* ✅ Structure content into **questions, subparts, marks, and diagrams**.
* ✅ Solve math/physics questions via reasoning LLM.
* ✅ Provide developer-friendly API endpoints.

---

## 4. User Stories

* **Student**: Upload exam → get structured digital questions for practice and get corrections from ai tutor.
* **Tutor**: Retrieve parsed questions + solutions to prepare lessons faster.


---

## 5. System Architecture

### Pipeline

1. **Input**: Upload exam (PDF/image).
2. **OCR (Google Document AI)**: Extracts text + diagrams into structured JSON.
3. **Parsing (LLM)**:

   * Cleans OCR output.
   * Identifies question numbers, subparts, marks.
   * Produces normalized JSON.
4. **Reasoning (LLM)**:

   * Solves math/physics problems.
   * Returns **step-by-step reasoning** + final answer.
5. **API Layer**:

   * `POST /upload` → upload exam.
   * `GET /questions` → fetch structured JSON.
   * `GET /solve/:id` → fetch solution for a question.

---

## 6. Data Format (JSON Example) [DEPRECATED DONT USE] 

```json
{
  "exam": "Edexcel Physics Paper 2",
  "year": 2022,
  "questions": [
    {
      "id": "Q1a",
      "text": "A ball is thrown vertically upwards with a speed of 12 m/s...",
      "marks": 3,
      "diagrams": ["img_001.png"],
      "solution": {
        "steps": [
          "Use v = u + at",
          "At max height, v = 0",
          "0 = 12 - 9.8t → t = 1.22 s"
        ],
        "final_answer": "1.22 s"
      }
    }
  ]
}
```

---

## 7. Model Strategy

* **OCR:** Google Document AI (high accuracy, supports tables/diagrams).
* **LLM (Math/Physics-focused):**

  * Default: **DeepSeek-Math-1.3B** (fast & cheap).
  * Balanced: **Mistral-7B** or **DeepSeek-Math-7B** (quantized).
  * Fine-tuning: Train on exam-style datasets for improved parsing/solving.

---

## 8. Performance Requirements

* OCR: < 5 sec/page.
* Parsing: < 2 sec/question.
* API response (upload → structured JSON): < 10 sec/page.


---

## 9. Cost Efficiency

* Use **small quantized models** for inference (1.3B–7B).
* Cache parsed results to avoid redundant LLM calls.


---

## 10. Risks & Mitigations

* **OCR errors in equations** → fallback with Mathpix API if needed.
* **LLM hallucinations** → constrain to math-specialized models.
* **GPU costs** → default to 1.3B model, allow scaling for accuracy when required.

---

## 11. Deliverables

* **Backend Next.js**: Handles OCR → parsing → solving.
* **LLM deployment** on Hugging Face (quantized for GPU).
* **Frontend (Next.js)**: Upload exams, display structured questions/solutions.


---

