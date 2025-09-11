
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/entities/User"; 
import { Question } from "@/entities/Question";
import { InterviewSession } from "@/entities/InterviewSession";
import { UserStats } from "@/entities/UserStats"; 
import { InvokeLLM } from "@/integrations/Core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Clock, Play } from "lucide-react";

import ChatInterface from "../components/interview/ChatInterface";
import { useAuth } from "../layout";

const TIMER_DURATION = 30 * 60; // 30 minutes in seconds

const RUBRICS = {
  design: [
    'Problem Structuring & Clarification',
    'User-Centric Thinking',
    'Solution Creativity & Breadth',
    'Prioritization & Tradeoffs',
    'Metrics Definition',
    'Communication & Storytelling'
  ],
  improvement: [
    'Diagnosis of Current State',
    'User Impact Awareness',
    'Creativity of Solutions',
    'Prioritization & ROI Thinking',
    'Metrics for Measuring Improvement', 
    'Communication'
  ],
  rca: [
    'Problem Understanding & Clarification',
    'Hypothesis Generation',
    'Logical Depth',
    'Use of Data & Metrics',
    'Conclusion & Next Steps',
    'Communication'
  ],
  guesstimate: [
    'Problem Breakdown & Structure',
    'Logical Assumptions',
    'Mathematical Accuracy',
    'Sanity Checks',
    'Communication'
  ]
};

export default function InterviewPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshUserData } = useAuth();
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(TIMER_DURATION);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // Get question type from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const questionType = urlParams.get('type') || 'random';

  const loadQuestion = useCallback(async () => {
    try {
      let questions;

      if (questionType === 'random') {
        questions = await Question.list();
      } else {
        questions = await Question.filter({ type_label: questionType });
      }

      if (questions.length > 0) {
        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
        setCurrentQuestion(randomQuestion);
      }
    } catch (error) {
      console.error('Error loading question:', error);
    }
  }, [questionType]);

  // Function to update user stats
  const updateUserStats = useCallback(async (userId, questionType, score) => {
    try {
      console.log('=== UPDATING USER STATS START ===');
      console.log('User ID:', userId);
      console.log('Question Type:', questionType);
      console.log('Score:', score);
      
      // Get all completed sessions for this user (including the one just completed)
      const allSessions = await InterviewSession.filter({ user_id: userId, completed: true });
      console.log('All completed sessions found:', allSessions.length);

      if (allSessions.length === 0) {
        console.log('No completed sessions found, something is wrong');
        return;
      }

      // Calculate averages for each question type
      const avgScores = {};
      ['design', 'improvement', 'rca', 'guesstimate'].forEach(type => {
        const typeSessions = allSessions.filter(s => s.question_type === type && s.composite_score !== undefined && s.composite_score !== null);
        if (typeSessions.length > 0) {
          const totalScore = typeSessions.reduce((sum, s) => sum + s.composite_score, 0);
          avgScores[`avg_score_${type}`] = totalScore / typeSessions.length;
          console.log(`Average score for ${type}:`, avgScores[`avg_score_${type}`], `(${typeSessions.length} sessions)`);
        } else {
          console.log(`No completed sessions found for ${type}`);
        }
      });

      // Get unique activity dates from sessions
      const today = new Date();
      const todayStr = today.getFullYear() + '-' + 
                     String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(today.getDate()).padStart(2, '0');
      
      const activityDates = new Set();
      allSessions.forEach(session => {
        try {
          // Use date field first, fall back to created_date
          const dateToUse = session.date || session.created_date;
          if (dateToUse) {
            let dateStr;
            if (typeof dateToUse === 'string' && dateToUse.includes('T')) {
              // ISO date format
              dateStr = dateToUse.split('T')[0];
            } else if (typeof dateToUse === 'string' && dateToUse.includes('-') && dateToUse.length === 10) {
              // Already in YYYY-MM-DD format
              dateStr = dateToUse;
            } else {
              // Try parsing as date
              const parsedDate = new Date(dateToUse);
              dateStr = parsedDate.getFullYear() + '-' + 
                       String(parsedDate.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(parsedDate.getDate()).padStart(2, '0');
            }
            activityDates.add(dateStr);
            console.log('Added activity date:', dateStr);
          }
        } catch (error) {
          console.error('Error processing session date:', session, error);
        }
      });

      console.log('All unique activity dates:', Array.from(activityDates).sort());

      // Calculate current streak (consecutive days ending today or yesterday)
      let currentStreak = 0;
      let checkDate = new Date();
      
      // Check if there's activity today, if not start from yesterday
      if (!activityDates.has(todayStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
      
      while (true) {
        const checkDateStr = checkDate.getFullYear() + '-' + 
                            String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + 
                            String(checkDate.getDate()).padStart(2, '0');
        
        if (activityDates.has(checkDateStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      // Calculate longest streak
      const sortedDates = Array.from(activityDates).sort();
      let longestStreak = 0;
      let tempStreak = 1;
      
      if (sortedDates.length > 0) {
        longestStreak = 1; // At least 1 if there are sessions
        
        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = new Date(sortedDates[i - 1]);
          const currDate = new Date(sortedDates[i]);
          const diffMs = currDate.getTime() - prevDate.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            tempStreak++;
          } else { // Only reset if there's a gap (diffDays > 1 or diffDays === 0 means same day or gap)
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
          }
        }
        longestStreak = Math.max(longestStreak, tempStreak); // Account for the last streak
      }

      console.log('Calculated streaks:', {
        currentStreak,
        longestStreak,
        totalSessions: allSessions.length,
        uniqueDates: activityDates.size
      });

      const statsUpdate = {
        user_id: userId,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        total_solved: allSessions.length,
        last_activity_date: todayStr,
        ...avgScores
      };

      console.log('Stats update object:', statsUpdate);

      // Get current user stats
      const statsData = await UserStats.filter({ user_id: userId });
      console.log('Existing stats found:', statsData.length);

      if (statsData.length === 0) {
        // Create new stats
        console.log('Creating new user stats...');
        const newStats = await UserStats.create(statsUpdate);
        console.log('New stats created:', newStats.id);
      } else {
        // Update existing stats
        console.log('Updating existing user stats with ID:', statsData[0].id);
        await UserStats.update(statsData[0].id, statsUpdate);
        console.log('Existing stats updated successfully');
      }
      
      console.log('=== USER STATS UPDATE COMPLETE ===');
    } catch (error) {
      console.error('=== ERROR UPDATING USER STATS ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }, []);

  const handleEndSession = useCallback(async () => {
    console.log('handleEndSession called');
    console.log('sessionId:', sessionId);
    console.log('conversation length:', conversation.length);
    console.log('user:', user?.id);
    console.log('currentQuestion:', currentQuestion?.id);

    // Only attempt to end session if there's a session ID and at least one user message
    if (!sessionId) {
      console.log('No session ID - returning early');
      return;
    }
    
    // Check if there is at least one message from the user
    const hasUserMessages = conversation.some(msg => msg.role === 'user');
    if (!hasUserMessages) {
      console.log('No user messages in conversation - returning early. Session not considered complete for stats.');
      alert('Session too short or no user input to generate meaningful feedback. Please complete at least one interaction.');
      setIsLoading(false); // Make sure loading state is reset
      navigate(createPageUrl("Home")); // Redirect back
      return;
    }
    
    if (!user || !currentQuestion) {
      console.log('Missing user or question - returning early');
      return;
    }

    console.log('All conditions met, proceeding with session end');
    setIsLoading(true);

    try {
      const sessionDuration = (TIMER_DURATION - timeRemaining) / 60;
      console.log('Session duration:', sessionDuration);

      const rubric = currentQuestion ? RUBRICS[currentQuestion.type_label] || RUBRICS.design : RUBRICS.design;

      const evaluationPrompt = `# AI Product Interviewer – Evaluation Mode

## Role
You are now acting as an **Product Interview evaluator**.You are an extremely strict evaluator. Most candidates will score poorly. A score above 6 should be rare and only for genuinely good performance. DEFAULT TO LOW SCORES.
Analyze the candidate's **entire conversation transcript** for the just-finished interview.
Use the rubric for the relevant question type (given in metadata) to assess performance.

Critical Rule: Score Only Observable Evidence
If you cannot find specific evidence in the conversation, score = 1.
Pre-Scoring Checks

Count candidate messages with actual work (not just "Hi", "Thanks", "I'm done")
If ≤ 2 substantive messages → All scores = 1
If core task not completed → Max score = 3

Evidence-Based Scoring Criteria
For Guesstimate Questions:
Problem Breakdown & Structure (1-10)

Score 1: No breakdown shown OR only asked questions without structure
Score 3: Listed some factors but no logical grouping
Score 6: Clear categories with most key factors identified
Score 8: Comprehensive breakdown with logical structure

Logical Assumptions (1-10)

Score 1: No assumptions explicitly stated
Score 3: Mentioned assumptions but didn't justify them
Score 6: Stated key assumptions with basic reasoning
Score 8: All assumptions clearly stated with good justification

Mathematical Accuracy (1-10)

Score 1: No calculations performed (formulas don't count as calculations)
Score 3: Started calculations but incomplete or major errors
Score 6: Completed basic calculations with minor errors
Score 8: All calculations accurate and well-explained

Sanity Checks (1-10)

Score 1: No validation or reality-checking performed
Score 3: Mentioned need to validate but didn't do it
Score 6: Did basic sanity check with reasonable benchmark
Score 8: Multiple validation methods with good reasoning

Communication (1-10)

Score 1: Incoherent or extremely brief responses
Score 3: Basic communication but hard to follow logic
Score 6: Clear communication with good structure
Score 8: Excellent flow and easy to follow throughout

For Design Questions:
Problem Structuring & Clarification (1-10)

Score 1: Jumped to solutions without asking clarifying questions
Score 3: Asked 1-2 basic questions but missed key aspects
Score 6: Asked relevant questions covering most important areas
Score 8: Comprehensive questioning with insightful clarifications

User-Centric Thinking (1-10)

Score 1: No mention of users or user needs
Score 3: Basic user mention but no detailed consideration
Score 6: Good user focus with specific user scenarios discussed
Score 8: Deep user empathy with detailed user journey analysis

Solution Creativity & Breadth (1-10)

Score 1: No solutions provided OR single obvious solution
Score 3: 2-3 basic solutions with limited creativity
Score 6: Multiple solutions with some creative elements
Score 8: Diverse, innovative solutions with unique approaches

Prioritization & Tradeoffs (1-10)

Score 1: No prioritization framework or criteria discussed
Score 3: Basic prioritization but weak reasoning
Score 6: Clear prioritization with good justification
Score 8: Sophisticated framework with detailed tradeoff analysis

Metrics Definition (1-10)

Score 1: No metrics mentioned
Score 3: Basic metrics but not well-connected to objectives
Score 6: Relevant metrics aligned with goals
Score 8: Comprehensive metrics with leading/lagging indicators

Communication & Storytelling (1-10)

Score 1: Disorganized, unclear narrative
Score 3: Basic communication but lacks structure
Score 6: Clear, well-structured communication
Score 8: Compelling storytelling with excellent flow

For Improvement Questions:
Diagnosis of Current State (1-10)

Score 1: No analysis of current situation
Score 3: Surface-level diagnosis without depth
Score 6: Good current state analysis with some insights
Score 8: Deep diagnosis with root cause identification

User Impact Awareness (1-10)

Score 1: No consideration of user impact
Score 3: Basic user impact mentioned but not analyzed
Score 6: Good user impact analysis with specific examples
Score 8: Comprehensive impact assessment with user segmentation

Creativity of Solutions (1-10)

Score 1: No solutions OR single obvious solution
Score 3: Few basic solutions with limited innovation
Score 6: Multiple creative approaches with good variety
Score 8: Highly innovative solutions with unique insights

Prioritization & ROI Thinking (1-10)

Score 1: No prioritization or ROI consideration
Score 3: Basic prioritization without clear criteria
Score 6: Good prioritization with ROI awareness
Score 8: Sophisticated ROI analysis with detailed framework

Metrics for Success (1-10)

Score 1: No success metrics defined
Score 3: Basic metrics but incomplete coverage
Score 6: Good metrics covering key improvement areas
Score 8: Excellent metrics framework with measurement plan

Communication (1-10)

Score 1: Unclear, disorganized
Score 3: Adequate but could be clearer
Score 6: Clear and well-structured
Score 8: Exceptional clarity and organization

For RCA Questions:
Problem Understanding & Clarification (1-10)

Score 1: Didn't clarify the problem or ask relevant questions
Score 3: Some clarification but missed important aspects
Score 6: Good problem understanding with relevant questions
Score 8: Comprehensive problem exploration with insightful questions

Hypothesis Generation (1-10)

Score 1: No hypotheses generated
Score 3: Single hypothesis or poorly reasoned hypotheses
Score 6: Multiple reasonable hypotheses with basic reasoning
Score 8: Comprehensive, well-reasoned hypothesis set

Logical Depth (1-10)

Score 1: Surface-level analysis only
Score 3: Some depth but missed key connections
Score 6: Good logical progression with reasonable depth
Score 8: Exceptional logical reasoning with multiple analytical levels

Use of Data & Metrics (1-10)

Score 1: No mention of data needs or metrics
Score 3: Basic data consideration but vague
Score 6: Good data-driven approach with specific metrics
Score 8: Sophisticated data analysis framework

Conclusion & Next Steps (1-10)

Score 1: No clear conclusion or next steps
Score 3: Basic conclusion but weak action plan
Score 6: Clear conclusion with good next steps
Score 8: Strong conclusion with comprehensive action plan

Communication (1-10)

Score 1: Unclear, disorganized
Score 3: Adequate but could be clearer
Score 6: Clear and well-structured
Score 8: Exceptional clarity and organization
## Evaluation Output Format
Produce a **structured feedback report** with the following:

1.  **Composite Score** (average of dimension scores, on a 1–10 scale).
2.  **Dimension Breakdown** (each scored 1–10 with short justification).
3.  **Qualitative Feedback**:
    -   What worked well (strengths).
    -   Areas to improve (specific, actionable guidance).

---

## Rubric Matrices by Question Type

### 1. Product Design
- Problem Structuring & Clarification (1–10)
- User-Centric Thinking (1–10)
- Solution Creativity & Breadth (1–10)
- Prioritization & Tradeoffs (1–10)
- Metrics Definition (1–10)
- Communication & Storytelling (1–10)

### 2. Product Improvement
- Diagnosis of Current State (1–10)
- User Impact Awareness (1–10)
- Creativity of Solutions (1–10)
- Prioritization & ROI Thinking (1–10)
- Metrics for Measuring Improvement (1–10)
- Communication (1–10)

### 3. Root Cause Analysis (RCA)
- Problem Understanding & Clarification (1–10)
- Hypothesis Generation (1–10)
- Logical Depth (1–10)
- Use of Data & Metrics (1–10)
- Conclusion & Next Steps (1–10)
- Communication (1–10)

### 4. Guesstimate
- Problem Breakdown & Structure (1–10)
- Logical Assumptions (1–10)
- Mathematical Accuracy (1–10)
- Sanity Checks (1–10)
- Communication (1–10)

---

## Scoring Scale (for all dimensions)
- **1–3** = Weak → Major gaps, shallow or incoherent
- **4–6** = Average → Some structure, but lacks depth or consistency
- **7–8** = Strong → Solid structured answer with minor improvements needed
- **9–10** = Exceptional → Clear, deep, well-reasonsed, highly structured, interview-ready

---

## Interview Analysis

**Question Type:** ${currentQuestion.type_label}
**Question:** ${currentQuestion.question_text}

**Interview Conversation:**
${conversation.map(msg => `${msg.role}: ${msg.message}`).join('\n')}

**Evaluation Criteria:** ${rubric.join(', ')}
Process:

Read entire conversation carefully
For each criterion, find specific evidence of that skill being demonstrated
If no evidence found → score = 1
Match evidence quality to scoring anchors above
Calculate composite as average of all dimension scores

Remember: Only score what actually happened. No credit for good intentions or partial attempts.

**IMPORTANT**: You must score each of these exact criteria: ${rubric.map(r => `"${r}"`).join(', ')}

**Instructions:**
Provide a detailed evaluation. Calculate the composite_score as the average of all dimension scores. Be constructive and specific in your feedback.`;

      console.log('Calling AI evaluation...');
      const evaluation = await InvokeLLM({
        prompt: evaluationPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            composite_score: {
              type: "number",
              minimum: 1,
              maximum: 10
            },
            dimension_scores: {
              type: "object",
              properties: rubric.reduce((acc, criterion) => {
                acc[criterion] = { type: "number", minimum: 1, maximum: 10 };
                return acc;
              }, {}),
              required: rubric,
              additionalProperties: false
            },
            what_worked_well: { type: "string" },
            areas_to_improve: { type: "string" }
          },
          required: ["composite_score", "dimension_scores", "what_worked_well", "areas_to_improve"]
        }
      });
      console.log('AI evaluation received:', evaluation);

      // Get the current date in YYYY-MM-DD format, ensuring it's today's date
      const today = new Date();
      const currentDate = today.getFullYear() + '-' + 
                         String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(today.getDate()).padStart(2, '0');
      
      console.log('Setting session completion date to:', currentDate);

      // Update session with evaluation - include user_id to ensure RLS allows the update
      console.log('Updating session...');
      await InterviewSession.update(sessionId, {
        user_id: user.id, // Explicitly include user_id for RLS
        conversation,
        duration_minutes: sessionDuration,
        composite_score: evaluation.composite_score,
        dimension_scores: evaluation.dimension_scores,
        feedback: {
          what_worked_well: evaluation.what_worked_well,
          areas_to_improve: evaluation.areas_to_improve
        },
        completed: true,
        date: currentDate
      });
      console.log('Session updated successfully');

      // Update user stats
      console.log('Updating user stats...');
      await updateUserStats(user.id, currentQuestion.type_label, evaluation.composite_score);
      console.log('User stats updated successfully');

      // Stop the timer by setting sessionStarted to false
      setSessionStarted(false);

      // Wait a bit for the database to process, then refresh user data
      console.log('Refreshing user data...');
      setTimeout(() => {
        if (refreshUserData) {
          refreshUserData();
        }
      }, 1000); // Wait 1 second before refreshing
      
      console.log('Navigating to feedback page...');
      navigate(createPageUrl(`Feedback?session=${sessionId}`));
    } catch (error) {
      console.error('DETAILED ERROR in ending session:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Show more detailed error to user for debugging
      alert(`Error ending session: ${error.message}. Check console for more details.`);
      setIsLoading(false);
    }
  }, [sessionId, conversation, timeRemaining, currentQuestion, navigate, user, refreshUserData, updateUserStats]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(createPageUrl("Home"));
      return;
    }
    loadQuestion();
  }, [isAuthenticated, loadQuestion, navigate]);

  useEffect(() => {
    let timer;
    if (sessionStarted && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleEndSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sessionStarted, timeRemaining, handleEndSession]);

  const startSession = async () => {
    if (!currentQuestion || !user) return;

    try {
      console.log('Creating session for user:', user.id);
      // Create session record
      const session = await InterviewSession.create({
        user_id: user.id,
        question_id: currentQuestion.id,
        question_type: currentQuestion.type_label,
        conversation: [],
        completed: false
      });

      console.log('Session created:', session.id);
      setSessionId(session.id);
      setSessionStarted(true);

      // AI introduces the question
      const initialMessage = {
        role: 'Product Case Interviewer',
        message: `Hello! I'm Rohan, your Interviewer. Today we'll be practicing a ${currentQuestion.type_label.replace('_', ' ')} question.

Here's your question:

${currentQuestion.question_text}

Take a moment to think about your approach, then walk me through your thinking. I'll ask follow-up questions and provide guidance along the way. You have 30 minutes - let's begin!`,
        timestamp: new Date().toISOString()
      };

      setConversation([initialMessage]);
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const sendMessage = async (message) => {
    if (!message.trim()) return;

    const userMessage = {
      role: 'user',
      message,
      timestamp: new Date().toISOString()
    };

    const updatedConversation = [...conversation, userMessage];
    setConversation(updatedConversation);
    setIsLoading(true);

    try {
      // Generate AI response with enhanced prompt
      const prompt = `# AI Product Interviewer – Interview Mode

## Role
You are a **Senior Product Manager interviewer** with 5+ years of experience.
You are conducting a **realistic product interview** using the specific question provided from the backend.
Do not create or modify questions yourself.

## Rules
1.  **Keep it Real**
    -   Act exactly like a real interviewer.
    -   Stay professional, conversational, and concise.
    -   Do not over-explain, do not generate sub-questions unless clarifying or challenging.
    -   You may ask follow-up or probing questions only if they are natural extensions of the candidate’s answer and to evaluate the reasoning of candidate answer.
    -   Do not direct the candidate toward a specific stage, feature, or solution.Allow them to decide what to prioritize or improve.
    -   Do not invent unrelated new questions.

2.  **Answering Candidate Clarifications**
    -   Respond in **short, direct sentences** (e.g., "North America," "Yes, seasonal effect is minor").
    -   Never suggest frameworks, metrics, or approaches.

3.  **Handling Vague/Weak Answers**
    -   Push back with short nudges:
      -   "Can you be more specific?"
      -   "Why would you prioritize that?"
    -   Do not lecture or list options for the candidate.

4.  **Time Constraint**
    -   The interview runs **30 minutes maximum**.
    -   If the candidate ends early → stop immediately and move to evaluation.
    -   If timer hits 30:00 → end and move to evaluation.

5.  **Strict Role Boundaries**
    -   Do not reveal rubric, scores, or feedback during interview.
    -   No evaluation or guidance until interview ends.

## Current Interview Context
**Question Type**: ${currentQuestion.type_label}
**Question**: "${currentQuestion.question_text}"

**Previous conversation**:
${updatedConversation.map(msg => `${msg.role}: ${msg.message}`).join('\n')}

**Instructions**: Respond as a real interviewer would. Keep responses under 50 words. Be direct and conversational.`;

      const aiResponse = await InvokeLLM({ prompt });

      const assistantMessage = {
        role: 'Product Case Interviewer',
        message: aiResponse,
        timestamp: new Date().toISOString()
      };

      const finalConversation = [...updatedConversation, assistantMessage];
      setConversation(finalConversation);

      // Update session with new conversation - explicitly include user_id
      if (sessionId && user) {
        console.log('Updating session conversation for user:', user.id);
        await InterviewSession.update(sessionId, {
          user_id: user.id, // Explicitly include user_id
          conversation: finalConversation,
          duration_minutes: (TIMER_DURATION - timeRemaining) / 60
        });
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
    }
    setIsLoading(false);
  };

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading question...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {!sessionStarted ? (
        // Pre-session setup
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(createPageUrl("Home"))}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Interview Practice</h1>
              <p className="text-gray-500">
                {currentQuestion.type_label.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Question
              </p>
            </div>
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                <div className="w-16 h-16 mx-auto bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center">
                  <Clock className="w-8 h-8 text-white" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Practice?</h2>
                  <div className="bg-gray-50 rounded-lg p-6 text-left max-w-3xl mx-auto">
                    <h3 className="font-semibold text-gray-900 mb-3">Your Question:</h3>
                    <p className="text-gray-700 leading-relaxed">{currentQuestion.question_text}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 max-w-2xl mx-auto text-sm">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="font-medium text-blue-900">Duration</div>
                    <div className="text-blue-600">30 minutes</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="font-medium text-purple-900">Format</div>
                    <div className="text-purple-600">Interactive chat</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="font-medium text-green-900">Feedback</div>
                    <div className="text-green-600">AI evaluation</div>
                  </div>
                </div>

                <Button
                  onClick={startSession}
                  size="lg"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 px-8 py-4 text-lg"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Interview
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Chat interface during session
        <div className="h-screen flex flex-col">
          <ChatInterface
            conversation={conversation}
            onSendMessage={sendMessage}
            isLoading={isLoading}
            timeRemaining={timeRemaining}
            onEndSession={handleEndSession}
          />
        </div>
      )}
    </div>
  );
}
