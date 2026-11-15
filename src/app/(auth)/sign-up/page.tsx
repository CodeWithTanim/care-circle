import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <CardTitle>
          <h1 className="text-2xl">Start with your account</h1>
        </CardTitle>
        <CardDescription>
          A little less worry. A little more care, together.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="sign-up" />
      </CardContent>
    </Card>
  );
}
