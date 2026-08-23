import React from "react";
import { Button } from "./ui/button";
const tabs = [
  { id: "home", label: "Home" },
  { id: "videos", label: "Videos" },
  { id: "shorts", label: "Shorts" },
  { id: "playlists", label: "Playlists" },
  { id: "community", label: "Community" },
  { id: "upload", label: "Upload" },
  { id: "about", label: "About" },
];
interface ChanneltabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}
const Channeltabs = ({ activeTab, onTabChange }: ChanneltabsProps) => {
  return (
    <div className="border-b px-4">
      <div className="flex gap-8 overflow-x-auto">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            className={`px-0 py-4 border-b-2 rounded-none ${
              activeTab === tab.id
                ? "border-black text-black"
                : "border-transparent text-gray-600 hover:text-black"
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default Channeltabs;
