"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center aura-gradient">
      <SignUp 
        routing="path"
        path="/sign-up"
        appearance={{
          elements: {
            formButtonPrimary: 'bg-gray-900 hover:bg-gray-800 text-white',
            card: 'bg-white/90 backdrop-blur-md shadow-xl',
          },
        }}
        redirectUrl="/"
        signInUrl="/sign-in"
      />
    </div>
  );
}
