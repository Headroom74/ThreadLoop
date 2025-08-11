import { useState } from "react";
import { Search, Filter, Star, Clock, Users, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Lesson {
  id: string;
  title: string;
  instructor: string;
  duration: string;
  rating: number;
  students: number;
  level: "Beginner" | "Intermediate" | "Advanced";
  tags: string[];
  thumbnail: string;
}

const mockLessons: Lesson[] = [
  {
    id: "1",
    title: "Classical Gas - Introduction",
    instructor: "Mason Williams",
    duration: "3:45",
    rating: 4.8,
    students: 1200,
    level: "Intermediate",
    tags: ["Fingerstyle", "Arpeggios"],
    thumbnail: "classical-gas"
  },
  {
    id: "2",
    title: "Travis Picking Basics",
    instructor: "Traditional",
    duration: "5:22",
    rating: 4.9,
    students: 2150,
    level: "Beginner",
    tags: ["Travis Picking", "Basics"],
    thumbnail: "travis-picking"
  },
  {
    id: "3",
    title: "Blues Shuffle in E",
    instructor: "Traditional Blues",
    duration: "4:18",
    rating: 4.7,
    students: 890,
    level: "Advanced",
    tags: ["Shuffle", "Blues", "Electric"],
    thumbnail: "blues-shuffle"
  }
];

export default function LibraryInterface() {
  const [activeTab, setActiveTab] = useState<"lessons" | "my-videos">("lessons");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");

  const filteredLessons = mockLessons.filter(lesson => {
    const matchesSearch = lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         lesson.instructor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = selectedLevel === "all" || lesson.level.toLowerCase() === selectedLevel;
    return matchesSearch && matchesLevel;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Beginner": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Intermediate": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "Advanced": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-primary/20 text-primary border-primary/30";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Practice Library</h1>
          <Button variant="outline" size="sm">
            <Filter size={16} className="mr-2" />
            Filter
          </Button>
        </div>
        
        <p className="text-muted-foreground mb-4">
          Access lessons and your uploaded videos for focused practice sessions
        </p>

        {/* Tab Buttons */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={activeTab === "lessons" ? "default" : "outline"}
            onClick={() => setActiveTab("lessons")}
            className={cn(
              activeTab === "lessons" && "bg-gradient-primary shadow-glow"
            )}
          >
            Lessons
          </Button>
          <Button
            variant={activeTab === "my-videos" ? "default" : "outline"}
            onClick={() => setActiveTab("my-videos")}
            className={cn(
              activeTab === "my-videos" && "bg-gradient-primary shadow-glow"
            )}
          >
            My Videos (0)
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
          <Input
            placeholder="Search lessons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {activeTab === "lessons" ? (
          <div className="space-y-4">
            {/* Level Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {["all", "beginner", "intermediate", "advanced"].map((level) => (
                <Button
                  key={level}
                  variant={selectedLevel === level ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedLevel(level)}
                  className={cn(
                    "whitespace-nowrap",
                    selectedLevel === level && "bg-primary/20 border-primary"
                  )}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Button>
              ))}
            </div>

            {/* Lessons Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLessons.map((lesson) => (
                <Card key={lesson.id} className="bg-gradient-card border-border shadow-card transition-all duration-300 overflow-hidden">
                  {/* Thumbnail */}
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Play className="w-12 h-12 text-primary/80" />
                    </div>
                    <div className="absolute top-2 left-2">
                      <Badge className={getLevelColor(lesson.level)}>
                        {lesson.level}
                      </Badge>
                    </div>
                    <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
                      {lesson.duration}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-2 line-clamp-2">{lesson.title}</h3>
                    <p className="text-muted-foreground text-sm mb-3">{lesson.instructor}</p>
                    
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span>{lesson.rating}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{lesson.duration}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{lesson.students.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {lesson.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1 bg-gradient-primary transition-all duration-300 active:brightness-95"
                        size="sm"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Practice
                      </Button>
                      <Button variant="outline" size="sm">
                        Music
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Card className="h-full bg-gradient-card border-border shadow-card">
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                <Play className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-4">No practice sessions yet</h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                Start practicing to see your progress here
              </p>
              <Button className="bg-gradient-primary transition-all duration-300 active:brightness-95">
                Start Your First Session
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}