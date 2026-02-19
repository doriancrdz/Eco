"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center aura-gradient">
      <SignIn 
        fallbackRedirectUrl="/"
        signUpUrl="/sign-up"
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
