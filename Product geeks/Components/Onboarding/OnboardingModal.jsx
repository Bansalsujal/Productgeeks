import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "@/entities/User";
import { UserStats } from "@/entities/UserStats";
import { Sparkles, Users, Building2 } from "lucide-react";

const careerStages = [
  { value: 'student', label: 'Student' },
  { value: 'apm', label: 'Associate Product Manager' },
  { value: 'spm', label: 'Senior Product Manager' },
  { value: 'senior_pm', label: 'Principal Product Manager' },
  { value: 'director', label: 'Director of Product' },
  { value: 'vp', label: 'VP of Product' },
  { value: 'other', label: 'Other' }
];

export default function OnboardingModal({ open, user, onComplete }) {
  const [careerStage, setCareerStage] = useState('');
  const [industry, setIndustry] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!careerStage || !industry) return;

    setIsLoading(true);
    try {
      await User.updateMyUserData({
        career_stage: careerStage,
        industry: industry,
        onboarded: true
      });

      // Initialize user stats
      await UserStats.create({
        user_id: user.id,
        current_streak: 0,
        longest_streak: 0,
        total_solved: 0,
        activity_calendar: {}
      });

      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <DialogTitle className="text-2xl font-bold">Welcome to PM Practice!</DialogTitle>
            <p className="text-gray-500 mt-2">Let's personalize your interview prep experience</p>
          </div>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="career_stage" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Career Stage
            </Label>
            <Select value={careerStage} onValueChange={setCareerStage} required>
              <SelectTrigger>
                <SelectValue placeholder="Select your current role level" />
              </SelectTrigger>
              <SelectContent>
                {careerStages.map(stage => (
                  <SelectItem key={stage.value} value={stage.value}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Industry
            </Label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g., Tech, Healthcare, Finance, E-commerce"
              required
            />
          </div>

          <div className="bg-indigo-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              This information helps us provide better feedback and personalized question recommendations.
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            disabled={isLoading || !careerStage || !industry}
          >
            {isLoading ? 'Setting up...' : 'Start Practicing'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}