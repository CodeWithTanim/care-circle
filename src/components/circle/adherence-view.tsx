"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Circle, DoseOccurrence } from "@/lib/models";
import { getTodayLocalDate } from "@/lib/timezone";

export function AdherenceView({ circle }: { circle: Circle }) {
  const [occurrences, setOccurrences] = useState<DoseOccurrence[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    taken: 0,
    unconfirmedMissed: 0,
    pending: 0,
    adherenceRatePercent: 100,
  });

  const [daysRange, setDaysRange] = useState<number>(7);

  useEffect(() => {
    let ignore = false;
    async function fetchAdherence() {
      try {
        const today = getTodayLocalDate(circle.timezone);
        const start = new Date(Date.now() - daysRange * 24 * 3600 * 1000)
          .toISOString()
          .slice(0, 10);

        const res = await fetch(
          `/api/circles/${circle._id}/adherence?startDate=${start}&endDate=${today}`,
        );
        if (res.ok && !ignore) {
          const data = await res.json();
          setOccurrences(data.occurrences || []);
          if (data.stats) setStats(data.stats);
        }
      } catch {
        if (!ignore) toast.error("Failed to load adherence records");
      }
    }

    fetchAdherence();
    return () => {
      ignore = true;
    };
  }, [circle._id, circle.timezone, daysRange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Adherence Tracking & History
          </h2>
          <p className="text-base text-muted-foreground mt-1">
            Historical medication routine confirmation for{" "}
            {circle.recipientName}.
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
          <div className="inline-flex rounded-md shadow-sm border bg-background p-1">
            {[7, 14, 30].map((days) => (
              <Button
                key={days}
                variant={daysRange === days ? "default" : "ghost"}
                size="sm"
                onClick={() => setDaysRange(days)}
                className="min-h-[36px] text-xs font-medium px-3"
              >
                Last {days} days
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-sm font-medium">
              Adherence Rate
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-primary">
              {stats.adherenceRatePercent}%
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Taken vs unconfirmed doses
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-sm font-medium">
              Confirmed Taken
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-green-600">
              {stats.taken}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Recorded with actor and timestamp
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-sm font-medium">
              Unconfirmed Missed
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-amber-600">
              {stats.unconfirmedMissed}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Past grace period without record
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-sm font-medium">
              Total Scheduled Doses
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-foreground">
              {stats.total}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Across active prescriptions
          </CardContent>
        </Card>
      </div>

      {/* Occurrence Timeline */}
      <section aria-labelledby="history-heading" className="space-y-4">
        <h3
          id="history-heading"
          className="text-xl font-semibold flex items-center gap-2"
        >
          <Activity className="size-5 text-primary" aria-hidden="true" />
          Dose History Log
        </h3>

        {occurrences.length === 0 ? (
          <Card className="border-dashed py-8 text-center">
            <CardContent>
              <p className="text-base text-muted-foreground">
                No recorded dose occurrences in this time range.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {occurrences.map((occ) => {
              const isTaken = occ.status === "taken";
              const isMissed = occ.status === "unconfirmed_missed";
              return (
                <Card
                  key={occ._id}
                  className={`border shadow-none ${
                    isTaken
                      ? "border-green-200 bg-green-50/20"
                      : isMissed
                        ? "border-amber-200 bg-amber-50/20"
                        : ""
                  }`}
                >
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-semibold text-base text-foreground">
                          {occ.medicationName}
                        </span>
                        <span className="text-sm text-muted-foreground font-medium">
                          ({occ.dosage})
                        </span>
                        {isTaken ? (
                          <Badge className="bg-green-600 gap-1 text-xs">
                            <CheckCircle2
                              className="size-3"
                              aria-hidden="true"
                            />
                            Confirmed Taken
                          </Badge>
                        ) : isMissed ? (
                          <Badge
                            variant="destructive"
                            className="gap-1 text-xs"
                          >
                            <AlertCircle
                              className="size-3"
                              aria-hidden="true"
                            />
                            Unconfirmed Missed
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-xs capitalize"
                          >
                            {occ.status}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar
                            className="size-3.5 text-primary"
                            aria-hidden="true"
                          />
                          <span>{occ.scheduledDate}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock
                            className="size-3.5 text-primary"
                            aria-hidden="true"
                          />
                          <span>Scheduled: {occ.scheduledTime}</span>
                        </div>
                        {isTaken && occ.takenAt && (
                          <span>
                            • Confirmed{" "}
                            {new Date(occ.takenAt).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            {occ.takenBy ? ` by ${occ.takenBy.name}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
