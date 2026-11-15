import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <CardTitle>
          <h1 className="text-2xl">Welcome back</h1>
        </CardTitle>
        <CardDescription>Sign in to your Care Circle account.</CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="sign-in" />
      </CardContent>
    </Card>
  );
}
