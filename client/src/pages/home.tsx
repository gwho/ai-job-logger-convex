import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  Activity,
  Cpu,
  BarChart3,
  Sparkles,
} from "lucide-react";

type JobLog = {
  _id: string;
  _creationTime: number;
  prompt: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  model: string;
  duration?: string;
};

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="default" className="bg-emerald-600 dark:bg-emerald-500" data-testid={`badge-status-${status}`}>
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Completed
        </Badge>
      );
    case "running":
      return (
        <Badge variant="default" className="bg-amber-500 dark:bg-amber-400" data-testid={`badge-status-${status}`}>
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" data-testid={`badge-status-${status}`}>
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" data-testid={`badge-status-${status}`}>
          <Clock className="w-3 h-3 mr-1" />
          {status}
        </Badge>
      );
  }
}

function JobCard({ job }: { job: JobLog }) {
  const [expanded, setExpanded] = useState(false);
  const timeAgo = getTimeAgo(new Date(job._creationTime));

  return (
    <div
      className="group p-4 rounded-md bg-card border border-card-border transition-all duration-200 hover-elevate cursor-pointer"
      onClick={() => setExpanded(!expanded)}
      data-testid={`card-job-${job._id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" data-testid={`text-prompt-${job._id}`}>
            {job.prompt}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Cpu className="w-3 h-3" />
              {job.model}
            </span>
            {job.duration && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {job.duration}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {expanded && job.result && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed" data-testid={`text-result-${job._id}`}>
            {job.result}
          </p>
        </div>
      )}
    </div>
  );
}

function StatsBar({ jobs }: { jobs: JobLog[] }) {
  const total = jobs.length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const running = jobs.filter((j) => j.status === "running").length;
  const failed = jobs.filter((j) => j.status === "failed").length;

  return (
    <div className="grid grid-cols-4 gap-3">
      <div className="flex items-center gap-2 p-3 rounded-md bg-card border border-card-border" data-testid="stat-total">
        <BarChart3 className="w-4 h-4 text-primary" />
        <div>
          <p className="text-lg font-semibold leading-none">{total}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total</p>
        </div>
      </div>
      <div className="flex items-center gap-2 p-3 rounded-md bg-card border border-card-border" data-testid="stat-completed">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        <div>
          <p className="text-lg font-semibold leading-none">{completed}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Done</p>
        </div>
      </div>
      <div className="flex items-center gap-2 p-3 rounded-md bg-card border border-card-border" data-testid="stat-running">
        <Loader2 className={`w-4 h-4 text-amber-500 ${running > 0 ? "animate-spin" : ""}`} />
        <div>
          <p className="text-lg font-semibold leading-none">{running}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Active</p>
        </div>
      </div>
      <div className="flex items-center gap-2 p-3 rounded-md bg-card border border-card-border" data-testid="stat-failed">
        <XCircle className="w-4 h-4 text-destructive" />
        <div>
          <p className="text-lg font-semibold leading-none">{failed}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Failed</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No jobs yet</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Submit a prompt below to trigger your first AI job and see real-time updates.
      </p>
    </div>
  );
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const jobs = useQuery(api.logs.list) as JobLog[] | undefined;
  const runJob = useAction(api.ai.runJob);
  const seedDb = useMutation(api.logs.seed);

  const handleSubmit = async () => {
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await runJob({ prompt: prompt.trim() });
      setPrompt("");
      toast({
        title: "Job triggered",
        description: "Your AI job is now running. The list will update automatically.",
      });
    } catch (error) {
      toast({
        title: "Failed to submit",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeed = async () => {
    try {
      await seedDb();
      toast({ title: "Sample data loaded" });
    } catch {
      toast({ title: "Data already exists", variant: "destructive" });
    }
  };

  const isLoading = jobs === undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-title">
                  AI Job Logger
                </h1>
                <p className="text-sm text-muted-foreground">
                  Real-time AI job execution via Convex
                </p>
              </div>
            </div>
            {jobs && jobs.length === 0 && (
              <Button variant="secondary" size="sm" onClick={handleSeed} data-testid="button-seed">
                Load Samples
              </Button>
            )}
          </div>
        </div>

        <StatsBar jobs={jobs ?? []} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              New Job
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Enter a prompt to send to the AI model..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSubmit();
                }
              }}
              data-testid="input-prompt"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Cmd+Enter to submit | Model: meta-llama/llama-3.3-70b-instruct
              </span>
              <Button
                onClick={handleSubmit}
                disabled={!prompt.trim() || isSubmitting}
                size="sm"
                data-testid="button-submit"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-1.5" />
                )}
                Run Job
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2" data-testid="text-jobs-header">
            <Activity className="w-4 h-4 text-muted-foreground" />
            Job Runs
            <span className="text-xs font-normal text-muted-foreground">(auto-synced)</span>
          </h2>
          <Separator />

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <EmptyState />
          ) : (
            <ScrollArea className="max-h-[calc(100vh-480px)]">
              <div className="space-y-2">
                {jobs.map((job) => (
                  <JobCard key={job._id} job={job} />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
