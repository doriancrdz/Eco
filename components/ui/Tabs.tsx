"use client";

import { useState, type ReactNode } from "react";

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
  const [activeTab, setActiveTab] = useState<string>(() =>
    defaultTab && tabs.some((t) => t.id === defaultTab) ? defaultTab : tabs[0]?.id ?? ""
  );

  if (tabs.length === 0) return null;
  const active = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div className={className}>
      <div
        role="tablist"
        className="scrollbar-hide sticky top-0 z-10 -mx-5 flex gap-6 overflow-x-auto border-b px-5 md:mx-0 md:px-0"
        style={{ borderColor: "var(--mk-line)", background: "var(--mk-bg)" }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className="-mb-px shrink-0 border-b-2 py-3 text-[14px] transition-colors hover:text-[var(--mk-text)]"
              style={{
                borderColor: isActive ? "var(--mk-text)" : "transparent",
                color: isActive ? "var(--mk-text)" : "var(--mk-muted)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="min-h-[300px] pt-8" key={active.id}>
        {active.content}
      </div>
    </div>
  );
}
