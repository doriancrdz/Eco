"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center aura-gradient">
      <SignUp 
        fallbackRedirectUrl="/"
        signInUrl="/sign-in"
        appearance={{
          elements: {
            formButtonPrimary: 'bg-gray-900 hover:bg-gray-800 text-white',
            card: 'bg-white/90 backdrop-blur-md shadow-xl',
          },
        }}
      />
    </div>
  );
}
