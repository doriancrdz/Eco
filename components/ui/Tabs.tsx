"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
}

export default function Tabs({ tabs, defaultTab, className = "" }: TabsProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab || tabs[0]?.id || "");

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className={`rounded-2xl backdrop-blur-xl bg-white/10 ring-1 ring-white/20 shadow-xl overflow-hidden ${className}`}>
      {/* Tabs Row */}
      <div className="flex gap-1.5 p-1.5 border-b border-white/10 bg-white/5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 z-10
                ${isActive
                  ? "text-gray-900"
                  : "text-gray-600 hover:text-gray-800"
                }
              `}
            >
              <span className="relative z-10">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white/30 rounded-lg shadow-sm"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-6 min-h-[200px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {activeTabContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
