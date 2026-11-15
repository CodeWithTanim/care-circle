import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sign in | Care Circle",
  description:
    "Sign in to your Care Circle family and elder care coordination account.",
};

export default function SignInPage() {
  return (
    <Card className="w-full border-border/70 bg-card/95 shadow-xl shadow-teal-950/5 rounded-3xl backdrop-blur-xs">
      <CardHeader className="space-y-2 pb-5">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50 px-3 py-1 text-xs font-semibold text-[#0f4c47] w-fit">
          <ShieldCheck className="size-3.5 text-[#0f4c47]" aria-hidden="true" />
          <span>Secure Family Portal</span>
        </div>
        <CardTitle>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Welcome back
          </h1>
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground leading-relaxed">
          Sign in to coordinate daily medications, doctor visits, and alerts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="sign-in" />
      </CardContent>
    </Card>
  );
}
