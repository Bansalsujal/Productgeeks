import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Clock, Play } from "lucide-react";
import { api } from "@/lib/api";
import ChatInterface from "../components/interview/ChatInterface";
import { useAuth } from "../hooks/useAuth";

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
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, refreshUserData } = useAuth();
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(TIMER_DURATION);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const questionType = searchParams.get('type') || 'random';

  const loadQuestion = useCallback(async () => {
    try {
      const questions = await api.getQuestions(questionType === 'random' ? null : questionType);
      
      if (questions.length > 0) {
        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
        setCurrentQuestion(randomQuestion);
      }
    } catch (error) {
      console.error('Error loading question:', error);
    }
  }, [questionType]);

  const handleEndSession = useCallback(async () => {
    if (!sessionId || !user || !currentQuestion) return;
    
    const hasUserMessages = conversation.some(msg => msg.role === 'user');
    if (!hasUserMessages) {
      alert('Session too short or no user input to generate meaningful feedback.');
      navigate('/');
      return;
    }

    setIsLoading(true);

    try {
      const sessionDuration = (TIMER_DURATION - timeRemaining) / 60;
      const rubric = RUBRICS[currentQuestion.type_label] || RUBRICS.design;

      const evaluationPrompt = `# AI Product Interviewer – Evaluation Mode

You are an extremely strict evaluator. Most candidates will score poorly. A score above 6 should be rare and only for genuinely good performance. DEFAULT TO LOW SCORES.

Analyze the candidate's entire conversation transcript for the just-finished interview.

## Interview Analysis
**Question Type:** ${currentQuestion.type_label}
**Question:** ${currentQuestion.question_text}

**Interview Conversation:**
${conversation.map(msg => `${msg.role}: ${msg.message}`).join('\n')}

**Evaluation Criteria:** ${rubric.join(', ')}

Score each criterion from 1-10 based on evidence in the conversation. If no evidence found, score = 1.

Provide detailed evaluation with composite score as average of all dimension scores.`;

      const evaluation = await api.generateAIResponse(evaluationPrompt, {
        type: "object",
        properties: {
          composite_score: { type: "number", minimum: 1, maximum: 10 },
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
      });

      const today = new Date().toISOString().split('T')[0];

      await api.updateSession(sessionId, {
        conversation,
        duration_minutes: sessionDuration,
        composite_score: evaluation.composite_score,
        dimension_scores: evaluation.dimension_scores,
        feedback: {
          what_worked_well: evaluation.what_worked_well,
          areas_to_improve: evaluation.areas_to_improve
        },
        completed: true,
        date: today
      });

      setSessionStarted(false);
      
      setTimeout(() => {
        if (refreshUserData) {
          refreshUserData();
        }
      }, 1000);
      
      navigate(`/feedback?session=${sessionId}`);
    } catch (error) {
      console.error('Error ending session:', error);
      alert(`Error ending session: ${error.message}`);
      setIsLoading(false);
    }
  }, [sessionId, conversation, timeRemaining, currentQuestion, navigate, user, refreshUserData]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
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
      const session = await api.createSession({
        question_id: currentQuestion.id,
        question_type: currentQuestion.type_label,
        conversation: [],
        completed: false
      });

      setSessionId(session.id);
      setSessionStarted(true);

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
      const prompt = `# AI Product Interviewer – Interview Mode

You are a Senior Product Manager interviewer conducting a realistic product interview.

## Rules
1. Keep it real - act exactly like a real interviewer
2. Stay professional, conversational, and concise
3. Answer clarifications in short, direct sentences
4. Push back on vague answers with short nudges
5. Do not reveal rubric, scores, or feedback during interview

## Current Interview Context
**Question Type**: ${currentQuestion.type_label}
**Question**: "${currentQuestion.question_text}"

**Previous conversation**:
${updatedConversation.map(msg => `${msg.role}: ${msg.message}`).join('\n')}

**Instructions**: Respond as a real interviewer would. Keep responses under 50 words. Be direct and conversational.`;

      const aiResponse = await api.generateAIResponse(prompt);

      const assistantMessage = {
        role: 'Product Case Interviewer',
        message: aiResponse,
        timestamp: new Date().toISOString()
      };

      const finalConversation = [...updatedConversation, assistantMessage];
      setConversation(finalConversation);

      if (sessionId) {
        await api.updateSession(sessionId, {
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
    return null;
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
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/')}
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