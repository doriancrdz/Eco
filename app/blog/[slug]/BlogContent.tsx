"use client";

import ReactMarkdown from "react-markdown";

interface BlogContentProps {
  content: string;
}

export default function BlogContent({ content }: BlogContentProps) {
  return (
    <ReactMarkdown
      components={{
        h2: ({ children }) => (
          <h2 className="text-xl font-bold mt-10 mb-3" style={{ color: "#EDECE8" }}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-semibold mt-7 mb-2" style={{ color: "#EDECE8" }}>
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="leading-relaxed mb-5 text-base" style={{ color: "#a1a0a0" }}>
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="mb-5 space-y-2 ml-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-5 space-y-2 ml-4 list-decimal">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="flex gap-2.5 text-base" style={{ color: "#a1a0a0" }}>
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
            <span>{children}</span>
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold" style={{ color: "#EDECE8" }}>
            {children}
          </strong>
        ),
        em: ({ children }) => (
          <em className="italic" style={{ color: "#EDECE8" }}>
            {children}
          </em>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-teal-400 hover:text-teal-300 transition-colors underline underline-offset-2"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote
            className="border-l-2 border-violet-500 pl-4 my-5 italic"
            style={{ color: "#8b8884" }}
          >
            {children}
          </blockquote>
        ),
        hr: () => (
          <hr className="my-8 border-white/10" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
