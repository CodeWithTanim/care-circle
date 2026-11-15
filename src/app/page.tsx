import Link from "next/link";
import {
  ArrowRight,
  HeartHandshake,
  Pill,
  CalendarDays,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Pill,
    title: "One clear daily routine",
    description: "A shared place for medication schedules and dose check-ins.",
  },
  {
    icon: CalendarDays,
    title: "Keep appointments close",
    description:
      "Help the people around you stay in the loop about upcoming visits.",
  },
  {
    icon: Users,
    title: "Care is a team effort",
    description: "Bring family members and caregivers into the same circle.",
  },
];

export default function Home() {
  return (
    <main
      id="main-content"
      className="mx-auto w-full max-w-6xl px-6 py-6 md:px-10"
    >
      <header className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-semibold"
        >
          <HeartHandshake className="size-8 text-primary" aria-hidden="true" />
          Care Circle
        </Link>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </header>
      <section className="max-w-3xl py-20 md:py-28">
        <p className="mb-5 text-sm font-medium uppercase tracking-widest text-primary">
          A little care, shared.
        </p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Everyday care.
          <br />
          Closer, together.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
          A calmer way to coordinate medicines, appointments, and the people who
          matter. Built around the person receiving care.
        </p>
        <Button asChild className="mt-8 min-h-12 px-6 text-base">
          <Link href="/sign-up">
            Get started
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </section>
      <section aria-label="Our plans for Care Circle" className="pb-12">
        <p className="mb-4 text-sm text-muted-foreground">
          What we&apos;re building
        </p>
        <div className="grid gap-5 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="shadow-none">
              <CardHeader>
                <Icon className="mb-4 size-6 text-primary" aria-hidden="true" />
                <CardTitle>
                  <h2>{title}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="leading-7 text-muted-foreground">
                {description}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <footer className="border-t py-6 text-sm text-muted-foreground">
        Care Circle · Built for everyday peace of mind.
      </footer>
    </main>
  );
}
