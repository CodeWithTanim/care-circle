import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Create Account | Care Circle",
  description:
    "Start a Care Circle to coordinate elderly medications, appointments, and care alerts.",
};

export default function SignUpPage() {
  return (
    <Card className="w-full border-border/70 bg-card/95 shadow-xl shadow-teal-950/5 rounded-3xl backdrop-blur-xs">
      <CardHeader className="space-y-2 pb-5">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50 px-3 py-1 text-xs font-semibold text-[#0f4c47] w-fit">
          <Sparkles className="size-3.5 text-[#0f4c47]" aria-hidden="true" />
          <span>Start in Under a Minute</span>
        </div>
        <CardTitle>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Create your account
          </h1>
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground leading-relaxed">
          A little less worry. A little more care, together for your loved ones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="sign-up" />
      </CardContent>
    </Card>
  );
}
