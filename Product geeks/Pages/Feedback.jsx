import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Trophy, 
  Target, 
  TrendingUp, 
  MessageSquare,
  Star,
  CheckCircle,
  AlertCircle,
  RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "../layout";

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
    'Metrics for Success',
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

export default function FeedbackPage() {
  const navigate = useNavigate();
  const { user, sessions, isAuthenticated, isLoadingData } = useAuth();
  
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');

  // Find session from the centralized sessions data
  const session = useMemo(() => {
    if (!sessions || !sessionId) return null;
    return sessions.find(s => s.id === sessionId);
  }, [sessions, sessionId]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(createPageUrl("Home"));
      return;
    }
    
    // If sessions are loaded but session not found, redirect
    if (!isLoadingData && sessions && !session) {
      navigate(createPageUrl("Home"));
    }
  }, [isAuthenticated, session, sessions, isLoadingData, navigate]);

  // If not authenticated, return null to prevent rendering
  if (!isAuthenticated) {
    return null; 
  }

  // Show loading spinner while session data is being fetched
  if (isLoadingData || !sessions) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // If session is still null after loading, it means it wasn't found
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Session not found.</p>
          <Button onClick={() => navigate(createPageUrl("Home"))}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const rubric = RUBRICS[session.question_type] || RUBRICS.design;
  const ScoreIcon = getScoreIcon(session.composite_score);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Home"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Interview Feedback</h1>
            <p className="text-gray-500">
              {session.question_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} • 
              {format(new Date(session.created_date), 'MMM d, yyyy')}
            </p>
          </div>
        </div>

        {/* Overall Score */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center">
                <Trophy className="w-10 h-10 text-white" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Overall Performance</h2>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${getScoreColor(session.composite_score)}`}>
                  <ScoreIcon className="w-5 h-5" />
                  <span className="text-2xl font-bold">{session.composite_score?.toFixed(1) || '0'}/10</span>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="font-medium text-blue-900">Duration</div>
                  <div className="text-blue-600">{session.duration_minutes?.toFixed(1) || '0'} minutes</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="font-medium text-purple-900">Question Type</div>
                  <div className="text-purple-600 capitalize">{session.question_type.replace(/_/g, ' ')}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="font-medium text-green-900">Status</div>
                  <div className="text-green-600">Completed</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Scores */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              Detailed Assessment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rubric.map((criterion) => {
              const score = session.dimension_scores?.[criterion] || 0;
              const percentage = (score / 10) * 100;
              
              return (
                <div key={criterion} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{criterion}</span>
                    <Badge variant="outline" className={getScoreColor(score)}>
                      {score.toFixed(1)}
                    </Badge>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Feedback */}
        <div className="space-y-6">
          {/* What Worked Well */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                What Worked Well
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed">
                {session.feedback?.what_worked_well || "No feedback provided yet."}
              </p>
            </CardContent>
          </Card>

          {/* Areas to Improve */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700">
                <TrendingUp className="w-5 h-5" />
                Areas to Improve
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed">
                {session.feedback?.areas_to_improve || "No feedback provided yet."}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => navigate(createPageUrl(`Interview?type=${session.question_type}`))}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 flex-1 sm:flex-none"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Practice Same Type
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("Interview?type=random"))}
            className="flex-1 sm:flex-none"
          >
            <Star className="w-4 h-4 mr-2" />
            Try Random Question
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("Home"))}
            className="flex-1 sm:flex-none"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );

  function getScoreColor(score) {
    if (score >= 8) return 'text-green-600 bg-green-100';
    if (score >= 6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  }

  function getScoreIcon(score) {
    if (score >= 8) return CheckCircle;
    if (score >= 6) return AlertCircle;
    return AlertCircle;
  }
}