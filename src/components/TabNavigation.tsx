import { useState } from "react";
import { Play, Music, TrendingUp, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "player", label: "Player", icon: Play },
  { id: "library", label: "Library", icon: Music },
  { id: "journey", label: "Journey", icon: TrendingUp },
  { id: "tools", label: "Tools", icon: Settings },
  { id: "community", label: "Community", icon: Users },
];

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex justify-around items-center py-2 px-4 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 cursor-default active:brightness-95",
                "min-w-[60px] min-h-[60px]",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-glow" 
                  : "text-muted-foreground"
              )}
            >
              <Icon 
                size={20} 
                className={cn(
                  "mb-1 transition-transform duration-200",
                  isActive && "scale-110"
                )}
              />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}