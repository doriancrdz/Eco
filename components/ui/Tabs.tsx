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

  if (!tabs || tabs.length === 0) {
    return null;
  }

  return (
    <div className={`${className}`}>
      {/* Tabs Row - Pill tabs avec glass effect, scroll horizontal sur mobile */}
      <div className="flex gap-2 p-2 bg-white/5 backdrop-blur-sm border-b border-white/10 overflow-x-auto overflow-y-hidden scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative flex-shrink-0 min-w-[120px] px-6 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 z-10
                ${isActive
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 opacity-70 hover:opacity-100"
                }
              `}
            >
              <span className="relative z-10">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gradient-to-br from-white/25 to-white/15 backdrop-blur-sm rounded-xl border border-white/30 shadow-lg"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content - Dans glass card */}
      <div className="p-8 md:p-10 min-h-[300px] bg-white/5 backdrop-blur-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {activeTabContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
