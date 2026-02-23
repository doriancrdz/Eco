"use client";

import { useUser } from "@clerk/nextjs";

interface UserAvatarProps {
  size?: "sm" | "md" | "lg" | "xl";
}

const GRADIENT_CLASSES = [
  "bg-gradient-to-br from-blue-400 to-blue-600",
  "bg-gradient-to-br from-purple-400 to-purple-600",
  "bg-gradient-to-br from-pink-400 to-pink-600",
  "bg-gradient-to-br from-teal-400 to-teal-600",
  "bg-gradient-to-br from-cyan-400 to-cyan-600",
  "bg-gradient-to-br from-indigo-400 to-indigo-600",
] as const;

const SIZE_CLASSES = {
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-12 h-12 text-lg",
  xl: "w-20 h-20 text-2xl",
} as const;

export default function UserAvatar({ size = "md" }: UserAvatarProps) {
  const { user } = useUser();

  const initial =
    user?.firstName?.charAt(0).toUpperCase() ||
    user?.username?.charAt(0).toUpperCase() ||
    "U";

  const colorIndex =
    (user?.firstName?.charCodeAt(0) ?? user?.username?.charCodeAt(0) ?? 0) % GRADIENT_CLASSES.length;
  const gradientClass = GRADIENT_CLASSES[colorIndex];

  const sizeClass = SIZE_CLASSES[size];
  const title = user?.firstName || user?.username || "Profil";

  return (
    <div
      className={`
        ${sizeClass}
        rounded-full
        ${gradientClass}
        flex items-center justify-center
        text-white font-bold
        shadow-lg shrink-0
        hover:scale-105 transition-transform
        select-none
      `}
      title={title}
    >
      {initial}
    </div>
  );
}
