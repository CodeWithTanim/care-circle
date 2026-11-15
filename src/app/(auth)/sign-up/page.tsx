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
  title: "Create Account | Care Circle",
  description:
    "Start a Care Circle to coordinate elderly medications, appointments, and care alerts.",
};

export default function SignUpPage() {
  return (
    <Card className="w-full border-border/70 bg-card/95 shadow-xl shadow-teal-950/5 rounded-3xl backdrop-blur-xs">
      <CardHeader className="space-y-1.5 pb-4">
        <CardTitle>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Create account
          </h1>
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Join your family circle to coordinate care together.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="sign-up" />
      </CardContent>
    </Card>
  );
}
