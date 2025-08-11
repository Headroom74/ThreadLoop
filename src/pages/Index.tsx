import { useState } from "react";
import TabNavigation from "@/components/TabNavigation";
import PlayerInterface from "@/components/player/PlayerInterface";
import LibraryInterface from "@/components/library/LibraryInterface";
import JourneyInterface from "@/components/journey/JourneyInterface";
import ToolsInterface from "@/components/tools/ToolsInterface";
import CommunityInterface from "@/components/community/CommunityInterface";

const Index = () => {
  const [activeTab, setActiveTab] = useState("player");

  const renderActiveTab = () => {
    switch (activeTab) {
      case "player":
        return <PlayerInterface />;
      case "library":
        return <LibraryInterface />;
      case "journey":
        return <JourneyInterface />;
      case "tools":
        return <ToolsInterface />;
      case "community":
        return <CommunityInterface />;
      default:
        return <PlayerInterface />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content Area */}
      <div className="flex-1 pb-20 overflow-y-auto">
        {renderActiveTab()}
      </div>
      
      {/* Bottom Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
