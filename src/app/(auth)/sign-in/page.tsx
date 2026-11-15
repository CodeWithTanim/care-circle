import type { Metadata } from "next";
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
      <CardHeader className="space-y-1.5 pb-4">
        <CardTitle>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Welcome back
          </h1>
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Sign in to your Care Circle account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="sign-in" />
      </CardContent>
    </Card>
  );
}
