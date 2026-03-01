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

  // Initiales : Prénom + Nom si disponibles, sinon prénom seul, sinon username
  let initials = "U";
  if (user?.firstName && user?.lastName) {
    initials = user.firstName.charAt(0).toUpperCase() + user.lastName.charAt(0).toUpperCase();
  } else if (user?.firstName) {
    initials = user.firstName.charAt(0).toUpperCase();
  } else if (user?.username) {
    initials = user.username.charAt(0).toUpperCase();
  }

  const colorIndex =
    (user?.firstName?.charCodeAt(0) ?? user?.username?.charCodeAt(0) ?? 0) % GRADIENT_CLASSES.length;
  const gradientClass = GRADIENT_CLASSES[colorIndex];

  const sizeClass = SIZE_CLASSES[size];
  const title =
    user?.firstName
      ? `${user.firstName}${user?.lastName ? " " + user.lastName : ""}`
      : user?.username || "Profil";

  // Taille du texte réduite si 2 initiales
  const textSize =
    initials.length === 2
      ? size === "sm"
        ? "text-[10px]"
        : size === "md"
        ? "text-xs"
        : size === "lg"
        ? "text-sm"
        : "text-xl"
      : size === "sm"
      ? "text-sm"
      : size === "md"
      ? "text-base"
      : size === "lg"
      ? "text-lg"
      : "text-2xl";

  return (
    <div
      className={`
        ${sizeClass.split(" ").slice(0, 2).join(" ")}
        rounded-full
        ${gradientClass}
        flex items-center justify-center
        text-white font-bold
        ${textSize}
        shadow-lg shrink-0
        hover:scale-105 transition-transform
        select-none
      `}
      title={title}
    >
      {initials}
    </div>
  );
}
