"use client";

import { useUser } from "@clerk/nextjs";

const GRADIENT_CLASSES = [
  "bg-gradient-to-br from-blue-500 to-purple-600",
  "bg-gradient-to-br from-purple-500 to-pink-600",
  "bg-gradient-to-br from-pink-500 to-rose-600",
  "bg-gradient-to-br from-green-500 to-teal-600",
  "bg-gradient-to-br from-teal-500 to-cyan-600",
  "bg-gradient-to-br from-orange-500 to-red-600",
  "bg-gradient-to-br from-indigo-500 to-blue-600",
] as const;

const SIZE_CLASSES = {
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-12 h-12 text-lg",
} as const;

export default function UserAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { user } = useUser();

  const initial =
    user?.firstName?.charAt(0).toUpperCase() ||
    user?.username?.charAt(0).toUpperCase() ||
    "U";

  const colorIndex = (user?.firstName?.charCodeAt(0) ?? user?.username?.charCodeAt(0) ?? 0) % GRADIENT_CLASSES.length;
  const gradientClass = GRADIENT_CLASSES[colorIndex];

  const sizeClass = SIZE_CLASSES[size];
  const title = user?.firstName || user?.username || "Profil";

  if (user?.imageUrl) {
    return (
      <div
        className={`${sizeClass} rounded-full overflow-hidden shadow-lg shrink-0 ring-2 ring-white/30`}
        title={title}
      >
        <img
          src={user.imageUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

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
      `}
      title={title}
    >
      {initial}
    </div>
  );
}
