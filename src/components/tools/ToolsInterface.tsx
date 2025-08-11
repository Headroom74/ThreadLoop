import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Target, 
  TrendingUp, 
  FileText, 
  Timer, 
  Settings,
  Play,
  RotateCcw,
  Trophy
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ToolsInterface() {
  const [currentSpeed, setCurrentSpeed] = useState(50);
  const [targetSpeed, setTargetSpeed] = useState(100);
  const [sessionTime, setSessionTime] = useState(8);
  const [accuracy, setAccuracy] = useState(92);
  const [loopsCompleted, setLoopsCompleted] = useState(12);
  const [isProgressiveMode, setIsProgressiveMode] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("50% Speed");

  const practicePresets = [
    { name: "Slow Practice", speed: "50% BPM", icon: Clock, color: "bg-blue-500/20 text-blue-400" },
    { name: "Medium Tempo", speed: "75% BPM", icon: Target, color: "bg-yellow-500/20 text-yellow-400" },
    { name: "Performance", speed: "90% BPM", icon: TrendingUp, color: "bg-green-500/20 text-green-400" },
    { name: "Full Speed", speed: "100% BPM", icon: Trophy, color: "bg-purple-500/20 text-purple-400" }
  ];

  const practiceTools = [
    {
      title: "Personal Notes",
      description: "Add notes to specific bars and sections to remember practice points",
      icon: FileText,
      action: "Add Note",
      color: "bg-blue-500/20 text-blue-400"
    },
    {
      title: "Practice Timer",
      description: "Track your practice sessions and build consistent habits",
      icon: Timer,
      action: "Start Timer",
      color: "bg-red-500/20 text-red-400"
    },
    {
      title: "Progress Tracking",
      description: "Monitor your improvement across all lessons and techniques",
      icon: TrendingUp,
      action: "View Progress",
      color: "bg-green-500/20 text-green-400"
    }
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Settings size={20} />
          <span className="text-sm text-muted-foreground">Practice Tools</span>
        </div>
        <h1 className="text-xl font-bold mb-2">Smart Practice System</h1>
        <p className="text-muted-foreground">
          Progressive practice modes that automatically adapt to your skill level and help you build muscle memory
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-6">
        {/* Progressive Practice Mode */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 bg-gradient-card border-border shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Progressive Practice Mode</h3>
              <Button
                variant={isProgressiveMode ? "default" : "outline"}
                onClick={() => setIsProgressiveMode(!isProgressiveMode)}
                className={cn(
                  isProgressiveMode && "bg-gradient-primary shadow-glow"
                )}
              >
                {isProgressiveMode ? "Stop" : "Start"}
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Current Speed</span>
                  <span className="text-primary font-bold">{currentSpeed}% BPM</span>
                </div>
                <Progress value={currentSpeed} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Target Speed</span>
                  <span className="text-primary font-bold">{targetSpeed}% BPM</span>
                </div>
                <Progress value={targetSpeed} className="h-1 opacity-50" />
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{loopsCompleted}</div>
                  <div className="text-xs text-muted-foreground">Loops Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{sessionTime}m</div>
                  <div className="text-xs text-muted-foreground">Session Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{accuracy}%</div>
                  <div className="text-xs text-muted-foreground">Accuracy</div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="flex-1">
                  <RotateCcw size={16} className="mr-2" />
                  Reset Progress
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <TrendingUp size={16} className="mr-2" />
                  View Stats
                </Button>
              </div>
            </div>
          </Card>

          {/* Practice Presets */}
          <Card className="p-6 bg-gradient-card border-border shadow-card">
            <h3 className="text-lg font-semibold mb-4">Practice Presets</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              {practicePresets.map((preset, index) => {
                const Icon = preset.icon;
                const isSelected = selectedPreset === preset.name;
                
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedPreset(preset.name)}
                    className={cn(
                      "p-3 rounded-lg border transition-all duration-200 text-left active:brightness-95",
                      isSelected 
                        ? "border-primary bg-primary/10 shadow-glow" 
                        : "border-border bg-secondary/50"
                    )}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${preset.color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="text-sm font-medium">{preset.name}</div>
                    <div className="text-xs text-muted-foreground">{preset.speed}</div>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Current Preset</span>
                <Badge variant="secondary" className="bg-primary/20 text-primary">
                  {selectedPreset}
                </Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* Practice Tools */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {practiceTools.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <Card key={index} className="p-6 bg-gradient-card border-border shadow-card transition-all duration-300">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${tool.color}`}>
                  <Icon size={24} />
                </div>
                <h3 className="font-semibold mb-2">{tool.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {tool.description}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full transition-all duration-200 active:brightness-95"
                >
                  {tool.action}
                </Button>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Card className="p-6 bg-gradient-card border-border shadow-card">
          <h3 className="text-lg font-semibold mb-4">Quick Practice Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="h-12">
              <Play size={16} className="mr-2" />
              Quick Session
            </Button>
            <Button variant="outline" className="h-12">
              <Target size={16} className="mr-2" />
              Set Goals
            </Button>
            <Button variant="outline" className="h-12">
              <Timer size={16} className="mr-2" />
              Pomodoro
            </Button>
            <Button variant="outline" className="h-12">
              <FileText size={16} className="mr-2" />
              Add Notes
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}