import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import AuthShell from "@/components/marketing/AuthShell";

export const metadata: Metadata = {
  title: "Connexion — ECO",
  robots: { index: false, follow: true },
};

export default function SignInPage() {
  return (
    <AuthShell mode="sign-in">
      <SignIn />
    </AuthShell>
  );
}
