import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Target, TrendingUp, Award, Play } from "lucide-react";

export default function JourneyInterface() {
  const stats = [
    { label: "Success Rate", value: "94%", color: "text-green-400" },
    { label: "Learning Speed", value: "2.3x", color: "text-blue-400" },
    { label: "Active Students", value: "15.2k", color: "text-purple-400" },
    { label: "Lessons", value: "850+", color: "text-primary" },
  ];

  const practiceStats = [
    { 
      icon: Clock, 
      label: "Total Practice", 
      value: "0s", 
      subtitle: "Across 0 sessions",
      color: "bg-yellow-500/20 text-yellow-400"
    },
    { 
      icon: Target, 
      label: "Current Streak", 
      value: "0 days", 
      subtitle: "Longest: 0 days",
      color: "bg-red-500/20 text-red-400"
    },
    { 
      icon: TrendingUp, 
      label: "Avg Speed", 
      value: "100%", 
      subtitle: "Practice tempo",
      color: "bg-green-500/20 text-green-400"
    },
    { 
      icon: Award, 
      label: "Avg Session", 
      value: "0s", 
      subtitle: "Per practice session",
      color: "bg-blue-500/20 text-blue-400"
    },
  ];

  const recommendations = [
    "Practice at slower speeds for better accuracy",
    "Use A-B loops to master difficult sections",
    "Aim for 15-30 minute focused sessions",
    "Track your progress with session recording"
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold mb-2">Learning Progress</h1>
        <p className="text-muted-foreground">
          Track your progress and maintain consistency with detailed practice insights
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-6">
        {/* Top Stats */}
        <Card className="p-6 bg-gradient-card border-border shadow-card">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className={`text-3xl font-bold mb-1 ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Practice Analytics Header */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp size={16} />
          <span>Practice Analytics</span>
        </div>

        <h2 className="text-2xl font-bold mb-4">Your Practice Journey</h2>

        {/* Practice Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {practiceStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="p-4 bg-gradient-card border-border shadow-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                    <div className="text-2xl font-bold text-primary">{stat.value}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{stat.subtitle}</div>
              </Card>
            );
          })}
        </div>

        {/* Recent Practice Sessions */}
        <Card className="p-6 bg-gradient-card border-border shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={20} />
            <h3 className="text-lg font-semibold">Recent Practice Sessions</h3>
          </div>
          
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
              <Play className="w-8 h-8 text-primary" />
            </div>
            <h4 className="text-lg font-semibold mb-2">No practice sessions yet</h4>
            <p className="text-muted-foreground mb-4">
              Start practicing to see your progress here
            </p>
          </div>
        </Card>

        {/* Practice Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Keep Your Streak Going */}
          <Card className="p-6 bg-gradient-card border-border shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Target size={20} />
              <h3 className="text-lg font-semibold">Practice Insights</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Keep Your Streak Going!</h4>
                <p className="text-sm text-muted-foreground">
                  Start a practice session today to begin your streak.
                </p>
              </div>
            </div>
          </Card>

          {/* Practice Recommendations */}
          <Card className="p-6 bg-gradient-card border-border shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Award size={20} />
              <h3 className="text-lg font-semibold">Practice Recommendations</h3>
            </div>
            
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-muted-foreground">{rec}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Call to Action */}
        <Card className="p-6 bg-gradient-card border-border shadow-card text-center">
          <h3 className="text-lg font-semibold mb-2">Ready to Practice?</h3>
          <p className="text-muted-foreground mb-4">
            Start your first practice session and begin tracking your guitar journey
          </p>
          <Button className="bg-gradient-primary transition-all duration-300 active:brightness-95">
            <Play className="w-4 h-4 mr-2" />
            Start Practice Session
          </Button>
        </Card>
      </div>
    </div>
  );
}
