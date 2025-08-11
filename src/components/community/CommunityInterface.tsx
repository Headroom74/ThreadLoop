import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Trophy, 
  Camera, 
  Share2, 
  Heart, 
  MessageCircle, 
  Play,
  Upload,
  TrendingUp,
  Star,
  Award
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommunityPost {
  id: string;
  user: {
    name: string;
    avatar: string;
    level: string;
  };
  content: string;
  video?: string;
  likes: number;
  comments: number;
  timeAgo: string;
  tags: string[];
}

const mockPosts: CommunityPost[] = [
  {
    id: "1",
    user: {
      name: "Alex Johnson",
      avatar: "AJ",
      level: "Intermediate"
    },
    content: "Finally nailed the Classical Gas intro! Been practicing for 2 weeks straight. The loop feature really helped me get the timing down. 🎸✨",
    likes: 42,
    comments: 8,
    timeAgo: "2h ago",
    tags: ["Classical", "Fingerstyle", "Progress"]
  },
  {
    id: "2",
    user: {
      name: "Maria Santos",
      avatar: "MS",
      level: "Advanced"
    },
    content: "Check out my 30-day speed progression on this blues riff! Started at 60% and now hitting 95% accuracy at full speed.",
    likes: 67,
    comments: 15,
    timeAgo: "5h ago",
    tags: ["Blues", "Speed", "30DayChallenge"]
  }
];

const challenges = [
  {
    title: "30-Day Speed Challenge",
    description: "Increase your playing speed by 20% in 30 days",
    participants: 234,
    timeLeft: "12 days left",
    difficulty: "Intermediate",
    prize: "Featured on homepage"
  },
  {
    title: "Fingerstyle Friday",
    description: "Weekly fingerstyle technique showcase",
    participants: 89,
    timeLeft: "3 days left", 
    difficulty: "All Levels",
    prize: "Community badge"
  }
];

export default function CommunityInterface() {
  const [activeTab, setActiveTab] = useState<"feed" | "challenges" | "leaderboard">("feed");

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Intermediate": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "Advanced": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "All Levels": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-primary/20 text-primary border-primary/30";
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Beginner": return "bg-green-500/20 text-green-400";
      case "Intermediate": return "bg-yellow-500/20 text-yellow-400";
      case "Advanced": return "bg-red-500/20 text-red-400";
      default: return "bg-primary/20 text-primary";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold mb-2">Community</h1>
        <p className="text-muted-foreground mb-4">
          Share progress, enter challenges, and connect with fellow guitarists
        </p>

        {/* Tab Navigation */}
        <div className="flex gap-2">
          {[
            { id: "feed", label: "Feed", icon: Users },
            { id: "challenges", label: "Challenges", icon: Trophy },
            { id: "leaderboard", label: "Leaderboard", icon: TrendingUp }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "outline"}
                onClick={() => setActiveTab(tab.id as "feed" | "challenges" | "leaderboard")}
                size="sm"
                className={cn(
                  "gap-2",
                  activeTab === tab.id && "bg-gradient-primary shadow-glow"
                )}
              >
                <Icon size={16} />
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {activeTab === "feed" && (
          <div className="space-y-4">
            {/* Create Post */}
            <Card className="p-4 bg-gradient-card border-border shadow-card">
              <div className="flex gap-3">
                <Avatar className="w-10 h-10 bg-primary/20 text-primary">
                  <span className="text-sm font-bold">YU</span>
                </Avatar>
                <div className="flex-1">
                  <div className="flex gap-2 mb-3">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Camera size={16} className="mr-2" />
                      Record Progress
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Upload size={16} className="mr-2" />
                      Share Video
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Share your practice progress with the community
                  </p>
                </div>
              </div>
            </Card>

            {/* Posts */}
            {mockPosts.map((post) => (
              <Card key={post.id} className="p-4 bg-gradient-card border-border shadow-card">
                <div className="flex gap-3 mb-3">
                  <Avatar className="w-10 h-10 bg-primary/20 text-primary">
                    <span className="text-sm font-bold">{post.user.avatar}</span>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{post.user.name}</span>
                      <Badge className={cn("text-xs", getLevelColor(post.user.level))}>
                        {post.user.level}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">{post.timeAgo}</span>
                  </div>
                </div>

                <p className="mb-3">{post.content}</p>

                {post.video && (
                  <Card className="aspect-video bg-muted mb-3 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Play className="w-12 h-12 text-primary/80" />
                    </div>
                  </Card>
                )}

                <div className="flex flex-wrap gap-1 mb-3">
                  {post.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex gap-4">
                    <Button variant="ghost" size="sm" className="gap-1">
                      <Heart size={16} />
                      {post.likes}
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1">
                      <MessageCircle size={16} />
                      {post.comments}
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Share2 size={16} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {activeTab === "challenges" && (
          <div className="space-y-4">
            {challenges.map((challenge, index) => (
              <Card key={index} className="p-6 bg-gradient-card border-border shadow-card">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">{challenge.title}</h3>
                    <p className="text-muted-foreground mb-3">{challenge.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <Users size={16} />
                        <span>{challenge.participants} participants</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Trophy size={16} />
                        <span>{challenge.timeLeft}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <Badge className={getDifficultyColor(challenge.difficulty)}>
                        {challenge.difficulty}
                      </Badge>
                      <Badge variant="secondary">
                        🏆 {challenge.prize}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Button className="w-full bg-gradient-primary transition-all duration-300 active:brightness-95">
                  <Trophy size={16} className="mr-2" />
                  Join Challenge
                </Button>
              </Card>
            ))}

            <Card className="p-6 bg-gradient-card border-border shadow-card text-center">
              <Award className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Create Your Own Challenge</h3>
              <p className="text-muted-foreground mb-4">
                Share a practice challenge with the community
              </p>
              <Button variant="outline">
                Create Challenge
              </Button>
            </Card>
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div className="space-y-4">
            <Card className="p-6 bg-gradient-card border-border shadow-card">
              <h3 className="text-lg font-semibold mb-4">Weekly Top Performers</h3>
              
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((rank) => (
                  <div key={rank} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                      rank === 1 ? "bg-yellow-500/20 text-yellow-400" :
                      rank === 2 ? "bg-gray-500/20 text-gray-400" :
                      rank === 3 ? "bg-orange-500/20 text-orange-400" :
                      "bg-primary/20 text-primary"
                    )}>
                      {rank}
                    </div>
                    <Avatar className="w-10 h-10 bg-primary/20 text-primary">
                      <span className="text-sm font-bold">U{rank}</span>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">Player {rank}</div>
                      <div className="text-sm text-muted-foreground">
                        {Math.floor(Math.random() * 50) + 20} hours practiced
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star size={16} className="text-yellow-400 fill-current" />
                      <span className="text-sm">{(Math.random() * 2 + 3).toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 bg-gradient-card border-border shadow-card text-center">
              <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Climb the Ranks</h3>
              <p className="text-muted-foreground mb-4">
                Practice consistently to appear on the leaderboard
              </p>
              <Button className="bg-gradient-primary transition-all duration-300 active:brightness-95">
                <Play size={16} className="mr-2" />
                Start Practicing
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}