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
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (defaultTab && tabs.some((tab) => tab.id === defaultTab)) {
      return defaultTab;
    }
    return tabs[0]?.id || "";
  });

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  if (!tabs || tabs.length === 0) return null;

  return (
    <div className={className}>
      {/* Tab bar */}
      <div
        className="flex gap-1 p-1.5 overflow-x-auto overflow-y-hidden scrollbar-hide -mx-4 px-4 md:mx-0 md:px-2"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.2)",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex-shrink-0 min-w-[100px] px-5 py-2 text-sm font-medium rounded-xl transition-all duration-200 z-10 focus:outline-none"
              style={{
                color: isActive ? "#EDECE8" : "rgba(237,236,232,0.4)",
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.color = "rgba(237,236,232,0.7)";
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.color = "rgba(237,236,232,0.4)";
              }}
            >
              <span className="relative z-10">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: "rgba(139,92,246,0.14)",
                    border: "1px solid rgba(139,92,246,0.22)",
                  }}
                  transition={{ type: "spring", bounce: 0.12, duration: 0.45 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div
        className="p-6 md:p-8 min-h-[300px]"
        style={{ background: "#0D0E14" }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {activeTabContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
