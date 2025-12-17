# exam_results.py - Helper functions for exam results and tips
from datetime import datetime, timezone
from typing import Dict, List
from database import exam_results_collection
from gemini_client import call_llm_once

TIP_PROMPT = """
You are an expert exam tutor providing personalized feedback on {exam_type} exam performance.

EXAM PERFORMANCE ANALYSIS:
- Exam Type: {exam_type}
- Total Questions: {total}
- Correct Answers: {correct}
- Wrong Answers: {wrong}
- Not Answered: {not_answered}
- Score Percentage: {score_percent}%
- Difficulty Level: {difficulty}
- Document: {doc_filename}

{exam_specific_context}

Generate 4-6 specific, actionable exam-focused tips. Focus on:
1. Exam-taking strategies specific to {exam_type} questions
2. How to improve accuracy and reduce mistakes
3. Time management and approach techniques
4. Content review recommendations based on performance
5. Practice strategies to strengthen weak areas

Make tips:
- Specific to {exam_type} exam format
- Actionable with clear next steps
- Encouraging and motivating
- Based on the actual performance metrics

Return ONLY a JSON array of tips, no extra text:
[
  "Tip 1 text here",
  "Tip 2 text here",
  "Tip 3 text here"
]
"""


def calculate_score(results: List[Dict]) -> Dict:
    """Calculate score from exam results."""
    total = len(results)
    if total == 0:
        return {
            "total": 0,
            "correct": 0,
            "wrong": 0,
            "not_answered": 0,
            "score_percent": 0,
        }
    
    correct = sum(1 for r in results if r.get("result") == "correct")
    wrong = sum(1 for r in results if r.get("result") == "wrong")
    not_answered = sum(1 for r in results if r.get("result") == "not answered")
    
    score_percent = round((correct / total) * 100, 2) if total > 0 else 0
    
    return {
        "total": total,
        "correct": correct,
        "wrong": wrong,
        "not_answered": not_answered,
        "score_percent": score_percent,
    }


def generate_tips(
    score_data: Dict, 
    difficulty: str, 
    exam_type: str, 
    doc_filename: str,
    questions: List[Dict] = None,
    results: List[Dict] = None
) -> List[str]:
    """Generate personalized exam-focused study tips based on performance."""
    try:
        # Build exam-specific context
        exam_context = ""
        if exam_type.lower() in ["mcq", "multiple choice"]:
            exam_context = """
MCQ EXAM STRATEGIES:
- For MCQ questions, focus on eliminating incorrect options first
- Read all options carefully before selecting an answer
- Pay attention to keywords and qualifiers in questions
- Review explanations for wrong answers to understand concepts better
- Practice identifying common MCQ tricks like "all of the above" or "none of the above"
"""
        elif exam_type.lower() in ["fillups", "fill-ups", "fill in the blank"]:
            exam_context = """
FILL-IN-THE-BLANK EXAM STRATEGIES:
- Focus on understanding context and sentence structure
- Pay attention to grammar, tense, and word forms
- Review key vocabulary and terminology from the document
- Practice identifying the correct word form (noun, verb, adjective, etc.)
- Read the entire sentence to understand the context before filling blanks
"""
        
        # Add performance-specific insights
        if results:
            wrong_count = score_data.get("wrong", 0)
            not_answered_count = score_data.get("not_answered", 0)
            if wrong_count > 0:
                exam_context += f"\n- You missed {wrong_count} questions - review those concepts carefully\n"
            if not_answered_count > 0:
                exam_context += f"\n- You left {not_answered_count} questions unanswered - practice time management\n"
        
        prompt = TIP_PROMPT.format(
            total=score_data["total"],
            correct=score_data["correct"],
            wrong=score_data["wrong"],
            not_answered=score_data["not_answered"],
            score_percent=score_data["score_percent"],
            difficulty=difficulty,
            exam_type=exam_type,
            doc_filename=doc_filename,
            exam_specific_context=exam_context,
        )
        
        raw = call_llm_once(prompt)
        
        # Try to parse JSON array
        import json
        import re
        
        # Try to extract JSON array
        match = re.search(r'\[[\s\S]*\]', raw)
        if match:
            tips = json.loads(match.group(0))
            if isinstance(tips, list):
                return tips
        
        # Fallback: split by lines or return default tips
        tips = [line.strip() for line in raw.split('\n') if line.strip() and line.strip().startswith('"')]
        if tips:
            return [tip.strip('"') for tip in tips[:5]]
        
        # Default tips if parsing fails
        return get_default_tips(score_data, difficulty, exam_type)
        
    except Exception as e:
        print(f"Error generating tips: {e}")
        return get_default_tips(score_data, difficulty, exam_type)


def get_default_tips(score_data: Dict, difficulty: str, exam_type: str = "exam") -> List[str]:
    """Generate default exam-focused tips based on score."""
    score_percent = score_data["score_percent"]
    wrong = score_data.get("wrong", 0)
    not_answered = score_data.get("not_answered", 0)
    total = score_data.get("total", 0)
    tips = []
    
    # Exam-specific tips based on performance
    if score_percent >= 80:
        tips.append("🎯 Excellent exam performance! You've mastered the material at this difficulty level.")
        tips.append("📚 Challenge yourself by attempting the next difficulty level to further strengthen your understanding.")
        tips.append("🔍 Review the explanations for questions you answered correctly to reinforce your knowledge.")
        tips.append("⏱️ Practice time management to maintain accuracy under exam conditions.")
    elif score_percent >= 60:
        tips.append("✅ Good exam performance! You're making solid progress.")
        tips.append("📖 Carefully review the questions you got wrong - focus on understanding why your answer was incorrect.")
        tips.append("💡 Practice more exam questions to improve your accuracy and speed.")
        tips.append("🎯 Pay attention to question patterns and common exam tricks.")
    elif score_percent >= 40:
        tips.append("📝 Keep practicing! Review the document content thoroughly before attempting the exam again.")
        tips.append("🔎 Focus on understanding the concepts behind questions you answered incorrectly.")
        tips.append("📊 Consider starting with easier difficulty to build confidence and foundational knowledge.")
        tips.append("⏰ Take your time reading each question carefully - don't rush through the exam.")
    else:
        tips.append("💪 Don't give up! Review the document content thoroughly before your next attempt.")
        tips.append("📚 Read through the notes and summary sections first to get a solid foundation.")
        tips.append("🎯 Start with easy difficulty questions to build confidence and understanding.")
        tips.append("🔍 Take your time to understand each concept - quality over speed.")
        tips.append("📖 Focus on learning the material first, then practice with exam questions.")
    
    # Specific exam performance feedback
    if wrong > 0 and total > 0:
        wrong_percent = round((wrong / total) * 100, 1)
        tips.append(f"❌ You got {wrong} questions wrong ({wrong_percent}%) - review those specific concepts and explanations.")
    
    if not_answered > 0:
        tips.append(f"⏱️ You left {not_answered} question(s) unanswered - practice time management and make sure to attempt all questions.")
    
    if score_percent < 50 and wrong > 0:
        tips.append("🎓 Consider reviewing the document again and taking notes on key concepts before retaking the exam.")
    
    return tips


def save_exam_result(
    user_id: str,
    doc_id: str,
    doc_filename: str,
    exam_type: str,  # "mcq" or "fillups"
    difficulty: str,
    questions: List[Dict],
    results: List[Dict],
    score_data: Dict,
    tips: List[str],
) -> str:
    """Save exam result to database and return result_id."""
    result_doc = {
        "user_id": user_id,
        "doc_id": doc_id,
        "doc_filename": doc_filename,
        "exam_type": exam_type,
        "difficulty": difficulty,
        "questions": questions,
        "results": results,
        "score": score_data,
        "tips": tips,
        "created_at": datetime.now(timezone.utc),
    }
    
    result = exam_results_collection.insert_one(result_doc)
    return str(result.inserted_id)


def get_user_exam_history(user_id: str, doc_id: str = None, exam_type: str = None):
    """Get exam history for a user, optionally filtered by doc_id and exam_type."""
    query = {"user_id": user_id}
    if doc_id:
        query["doc_id"] = doc_id
    if exam_type:
        query["exam_type"] = exam_type
    
    results = list(
        exam_results_collection.find(query)
        .sort("created_at", -1)
        .limit(100)  # Limit to last 100 results
    )
    
    # Convert ObjectId to string
    for result in results:
        result["_id"] = str(result["_id"])
        if "created_at" in result and isinstance(result["created_at"], datetime):
            # Ensure timezone-aware datetime and include 'Z' suffix for UTC
            if result["created_at"].tzinfo is None:
                # If naive datetime, assume it's UTC
                result["created_at"] = result["created_at"].replace(tzinfo=timezone.utc)
            result["created_at"] = result["created_at"].isoformat().replace('+00:00', 'Z')
    
    return results



