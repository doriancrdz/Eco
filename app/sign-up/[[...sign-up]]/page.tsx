import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import AuthShell from "@/components/marketing/AuthShell";

export const metadata: Metadata = {
  title: "Créer un compte — ECO",
  robots: { index: false, follow: true },
};

export default function SignUpPage() {
  return (
    <AuthShell mode="sign-up">
      <SignUp />
    </AuthShell>
  );
}
