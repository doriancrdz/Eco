"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center aura-gradient">
      <SignIn 
        routing="path"
        path="/sign-in"
        appearance={{
          elements: {
            formButtonPrimary: 'bg-gray-900 hover:bg-gray-800 text-white',
            card: 'bg-white/90 backdrop-blur-md shadow-xl',
          },
        }}
        redirectUrl="/"
        signUpUrl="/sign-up"
      />
    </div>
  );
}
