import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetGlobalDelayConfig,
  useUpdateDelayConfig,
  useCreateDelayConfig,
  usePreviewDelayTiming,
  useGetAccountActivityStatus,
  useListAccounts,
  getGetGlobalDelayConfigQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Clock, Timer, Brain, Moon, Zap, Activity, RefreshCw,
  Eye, Keyboard, Wifi, WifiOff, Coffee, Play, BarChart3,
} from "lucide-react";

const schema = z.object({
  minReplyDelay: z.number().min(1).max(600),
  maxReplyDelay: z.number().min(1).max(3600),
  typingEnabled: z.boolean(),
  typingSpeed: z.enum(["slow", "human", "fast", "variable"]),
  onlineSimulation: z.boolean(),
  nightSlowMode: z.boolean(),
  randomBreaks: z.boolean(),
  readingSimulation: z.boolean(),
  readingSpeedWpm: z.number().min(50).max(500),
  priorityMultiplier: z.number().min(0.1).max(1),
  nightMultiplier: z.number().min(1).max(10),
  nightStartHour: z.number().min(0).max(23),
  nightEndHour: z.number().min(0).max(23),
  breakProbability: z.number().min(0).max(0.5),
  breakMinDuration: z.number().min(30).max(3600),
  breakMaxDuration: z.number().min(60).max(7200),
  activeHoursStart: z.number().min(0).max(23),
  activeHoursEnd: z.number().min(0).max(23),
  contextAdaptation: z.boolean(),
  cooldownMinutes: z.number().min(5).max(240),
  maxContinuousActiveMinutes: z.number().min(15).max(480),
});

type FormValues = z.infer<typeof schema>;

function formatSeconds(s: number): string {
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${(s / 60).toFixed(1)}min`;
}

function StatCard({ icon: Icon, label, value, color = "text-primary" }: {
  icon: React.ElementType; label: string; value: string; color?: string;
}) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-lg bg-muted/30 border border-border/40">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{label}</span>
      </div>
      <span className={`text-2xl font-bold font-mono ${color}`}>{value}</span>
    </div>
  );
}

function ActivityBadge({ state }: { state: string }) {
  const cfg = {
    active: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "ACTIVE" },
    idle: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "IDLE" },
    away: { color: "bg-orange-500/20 text-orange-400 border-orange-500/30", label: "AWAY" },
    sleep: { color: "bg-slate-500/20 text-slate-400 border-slate-500/30", label: "SLEEP" },
  }[state] ?? { color: "bg-muted text-muted-foreground border-border", label: state.toUpperCase() };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export default function HumanDelay() {
  const qc = useQueryClient();
  const [previewResult, setPreviewResult] = useState<Record<string, number | boolean> | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number>(1);

  const { data: globalConfig, isLoading } = useGetGlobalDelayConfig();
  const { data: accounts } = useListAccounts();
  const { data: activityStatus } = useGetAccountActivityStatus(selectedAccountId, {
    query: { queryKey: ["activity", selectedAccountId], refetchInterval: 5000 }
  });
  const updateConfig = useUpdateDelayConfig();
  const createConfig = useCreateDelayConfig();
  const previewTiming = usePreviewDelayTiming();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: globalConfig ? {
      minReplyDelay: globalConfig.minReplyDelay,
      maxReplyDelay: globalConfig.maxReplyDelay,
      typingEnabled: globalConfig.typingEnabled,
      typingSpeed: globalConfig.typingSpeed as "slow" | "human" | "fast" | "variable",
      onlineSimulation: globalConfig.onlineSimulation,
      nightSlowMode: globalConfig.nightSlowMode,
      randomBreaks: globalConfig.randomBreaks,
      readingSimulation: globalConfig.readingSimulation,
      readingSpeedWpm: globalConfig.readingSpeedWpm,
      priorityMultiplier: globalConfig.priorityMultiplier,
      nightMultiplier: globalConfig.nightMultiplier,
      nightStartHour: globalConfig.nightStartHour,
      nightEndHour: globalConfig.nightEndHour,
      breakProbability: globalConfig.breakProbability,
      breakMinDuration: globalConfig.breakMinDuration,
      breakMaxDuration: globalConfig.breakMaxDuration,
      activeHoursStart: globalConfig.activeHoursStart,
      activeHoursEnd: globalConfig.activeHoursEnd,
      contextAdaptation: globalConfig.contextAdaptation,
      cooldownMinutes: globalConfig.cooldownMinutes,
      maxContinuousActiveMinutes: globalConfig.maxContinuousActiveMinutes,
    } : {
      minReplyDelay: 10, maxReplyDelay: 180, typingEnabled: true, typingSpeed: "human",
      onlineSimulation: true, nightSlowMode: true, randomBreaks: true, readingSimulation: true,
      readingSpeedWpm: 220, priorityMultiplier: 0.3, nightMultiplier: 3.0, nightStartHour: 23,
      nightEndHour: 7, breakProbability: 0.05, breakMinDuration: 300, breakMaxDuration: 1800,
      activeHoursStart: 8, activeHoursEnd: 23, contextAdaptation: true, cooldownMinutes: 30,
      maxContinuousActiveMinutes: 120,
    },
  });

  const watchedValues = form.watch();

  const handlePreview = () => {
    previewTiming.mutate(
      { data: { ...watchedValues, sampleMessage: "Hello! Could you tell me more about the project timeline and what deliverables you need?" } },
      { onSuccess: (data) => setPreviewResult(data as unknown as Record<string, number | boolean>) }
    );
  };

  const onSubmit = (values: FormValues) => {
    const payload = { ...values, isGlobal: true, name: "Global Config" };
    if (globalConfig && globalConfig.id > 0) {
      updateConfig.mutate(
        { id: globalConfig.id, data: payload },
        { onSuccess: () => qc.invalidateQueries({ queryKey: getGetGlobalDelayConfigQueryKey() }) }
      );
    } else {
      createConfig.mutate(
        { data: payload },
        { onSuccess: () => qc.invalidateQueries({ queryKey: getGetGlobalDelayConfigQueryKey() }) }
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Human Delay Engine</h1>
          <p className="text-muted-foreground mt-1">
            Configure realistic human interaction timing for all AI accounts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreview} disabled={previewTiming.isPending} data-testid="btn-preview">
            <BarChart3 className="w-4 h-4 mr-2" />
            {previewTiming.isPending ? "Computing..." : "Preview Timing"}
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={updateConfig.isPending || createConfig.isPending} data-testid="btn-save">
            {(updateConfig.isPending || createConfig.isPending) ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>

      {/* Preview Result */}
      {previewResult && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono text-primary uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Timing Preview — Current Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={Eye} label="Reading Delay" value={formatSeconds(previewResult.readingDelaySeconds as number)} />
              <StatCard icon={Brain} label="Think Delay" value={formatSeconds(previewResult.baseResponseDelaySeconds as number)} />
              <StatCard icon={Keyboard} label="Typing Short" value={formatSeconds(previewResult.typingShortMessageSeconds as number)} color="text-violet-400" />
              <StatCard icon={Keyboard} label="Typing Long" value={formatSeconds(previewResult.typingLongMessageSeconds as number)} color="text-violet-400" />
              <StatCard icon={Timer} label="Total Estimate" value={formatSeconds(previewResult.totalEstimatedSeconds as number)} color="text-emerald-400" />
              <StatCard icon={Clock} label="Max w/ Night Mode" value={formatSeconds(previewResult.effectiveMaxDelay as number)} color="text-orange-400" />
              <div className="col-span-2 flex flex-col gap-1 p-4 rounded-lg bg-muted/30 border border-border/40">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Night Mode</span>
                </div>
                <span className={`text-lg font-bold font-mono ${previewResult.nightModeWouldApply ? "text-indigo-400" : "text-muted-foreground"}`}>
                  {previewResult.nightModeWouldApply ? "ACTIVE NOW" : "Not Active"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Activity Monitor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-primary" />
            Account Activity Monitor
          </CardTitle>
          <CardDescription>Real-time activity state per account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Select
              value={String(selectedAccountId)}
              onValueChange={(v) => setSelectedAccountId(Number(v))}
            >
              <SelectTrigger className="w-56" data-testid="select-account">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts?.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.displayName ?? a.username ?? a.phoneNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activityStatus && <ActivityBadge state={activityStatus.state} />}
          </div>
          {activityStatus && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard
                icon={activityStatus.onBreak ? Coffee : Activity}
                label="Status"
                value={activityStatus.state.toUpperCase()}
                color={activityStatus.state === "active" ? "text-emerald-400" : activityStatus.state === "sleep" ? "text-slate-400" : "text-orange-400"}
              />
              <StatCard
                icon={Clock}
                label="Session Active"
                value={`${activityStatus.sessionActiveMinutes.toFixed(0)}min`}
              />
              <StatCard
                icon={Timer}
                label="Last Activity"
                value={formatSeconds(activityStatus.lastActivitySecondsAgo)}
                color="text-muted-foreground"
              />
              {activityStatus.onBreak && (
                <StatCard
                  icon={Coffee}
                  label="Break Remaining"
                  value={formatSeconds(activityStatus.breakRemainingSeconds)}
                  color="text-orange-400"
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Config Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Response Delays */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="w-5 h-5 text-primary" />
                  Response Delays
                </CardTitle>
                <CardDescription>Control when the AI replies to messages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="minReplyDelay" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      <span>Minimum Delay</span>
                      <Badge variant="outline" className="font-mono">{field.value}s</Badge>
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={1} max={300} step={1}
                        value={[field.value]}
                        onValueChange={([v]) => field.onChange(v)}
                        data-testid="slider-min-delay"
                      />
                    </FormControl>
                    <FormDescription>Shortest possible reply time</FormDescription>
                  </FormItem>
                )} />

                <FormField control={form.control} name="maxReplyDelay" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      <span>Maximum Delay</span>
                      <Badge variant="outline" className="font-mono">{formatSeconds(field.value)}</Badge>
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={10} max={1800} step={5}
                        value={[field.value]}
                        onValueChange={([v]) => field.onChange(v)}
                        data-testid="slider-max-delay"
                      />
                    </FormControl>
                    <FormDescription>Longest random wait before replying</FormDescription>
                  </FormItem>
                )} />

                <FormField control={form.control} name="contextAdaptation" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div>
                      <FormLabel>Context Adaptation</FormLabel>
                      <FormDescription>Longer messages trigger longer "thinking" pauses</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-context" />
                    </FormControl>
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Typing Simulation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-violet-400" />
                  Typing Simulation
                </CardTitle>
                <CardDescription>Show realistic typing behavior before sending</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="typingEnabled" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div>
                      <FormLabel>Enable Typing Indicator</FormLabel>
                      <FormDescription>Show "typing..." before sending messages</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-typing" />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="typingSpeed" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Typing Speed</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-typing-speed">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="slow">Slow (80–120 CPM) — elderly / distracted</SelectItem>
                        <SelectItem value="human">Human (150–280 CPM) — natural average</SelectItem>
                        <SelectItem value="fast">Fast (300–450 CPM) — power user</SelectItem>
                        <SelectItem value="variable">Variable — random per session</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Short &lt;2–5s · Medium ~5–15s · Long ~15–45s
                    </FormDescription>
                  </FormItem>
                )} />

                <FormField control={form.control} name="readingSimulation" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div>
                      <FormLabel>Reading Simulation</FormLabel>
                      <FormDescription>Pause to "read" incoming messages first</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-reading" />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="readingSpeedWpm" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      <span>Reading Speed</span>
                      <Badge variant="outline" className="font-mono">{field.value} WPM</Badge>
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={80} max={500} step={10}
                        value={[field.value]}
                        onValueChange={([v]) => field.onChange(v)}
                        data-testid="slider-reading-speed"
                      />
                    </FormControl>
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Online Presence Simulation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Moon className="w-5 h-5 text-indigo-400" />
                  Online Presence Simulation
                </CardTitle>
                <CardDescription>Simulate realistic online/offline patterns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="onlineSimulation" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div>
                      <FormLabel>Online Presence Simulation</FormLabel>
                      <FormDescription>Simulate realistic last-seen and online status</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-online-sim" />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="nightSlowMode" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div>
                      <FormLabel>Night Slow Mode</FormLabel>
                      <FormDescription>Multiply delays during night hours</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-night-mode" />
                    </FormControl>
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="nightStartHour" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Night Starts</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={23} {...field} onChange={e => field.onChange(Number(e.target.value))} data-testid="input-night-start" />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="nightEndHour" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Night Ends</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={23} {...field} onChange={e => field.onChange(Number(e.target.value))} data-testid="input-night-end" />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="nightMultiplier" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      <span>Night Delay Multiplier</span>
                      <Badge variant="outline" className="font-mono">{field.value}×</Badge>
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={1} max={10} step={0.5}
                        value={[field.value]}
                        onValueChange={([v]) => field.onChange(v)}
                        data-testid="slider-night-multiplier"
                      />
                    </FormControl>
                    <FormDescription>Delays are multiplied by this during night hours</FormDescription>
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Activity Rotation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-emerald-400" />
                  Activity Rotation
                </CardTitle>
                <CardDescription>Configure rest periods and activity pacing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="randomBreaks" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div>
                      <FormLabel>Random Breaks</FormLabel>
                      <FormDescription>Randomly go offline for realistic idle periods</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-breaks" />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="breakProbability" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      <span>Break Probability</span>
                      <Badge variant="outline" className="font-mono">{(field.value * 100).toFixed(0)}%</Badge>
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={0} max={0.3} step={0.01}
                        value={[field.value]}
                        onValueChange={([v]) => field.onChange(v)}
                        data-testid="slider-break-prob"
                      />
                    </FormControl>
                    <FormDescription>Chance per interval of triggering a random break</FormDescription>
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="breakMinDuration" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Break Min</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type="number" min={30} max={3600} {...field} onChange={e => field.onChange(Number(e.target.value))} data-testid="input-break-min" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">sec</span>
                        </div>
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="breakMaxDuration" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Break Max</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type="number" min={60} max={7200} {...field} onChange={e => field.onChange(Number(e.target.value))} data-testid="input-break-max" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">sec</span>
                        </div>
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                <Separator />

                <FormField control={form.control} name="maxContinuousActiveMinutes" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      <span>Max Continuous Active</span>
                      <Badge variant="outline" className="font-mono">{field.value}min</Badge>
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={15} max={480} step={15}
                        value={[field.value]}
                        onValueChange={([v]) => field.onChange(v)}
                        data-testid="slider-max-active"
                      />
                    </FormControl>
                    <FormDescription>Force a cooldown after this many minutes of activity</FormDescription>
                  </FormItem>
                )} />

                <FormField control={form.control} name="cooldownMinutes" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      <span>Cooldown Duration</span>
                      <Badge variant="outline" className="font-mono">{field.value}min</Badge>
                    </FormLabel>
                    <FormControl>
                      <Slider
                        min={5} max={240} step={5}
                        value={[field.value]}
                        onValueChange={([v]) => field.onChange(v)}
                        data-testid="slider-cooldown"
                      />
                    </FormControl>
                    <FormDescription>How long to rest between active sessions</FormDescription>
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          </div>

          {/* Priority & Active Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Priority Users & Active Hours
              </CardTitle>
              <CardDescription>
                Priority users get faster replies · Active hours define when the account operates
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="priorityMultiplier" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center justify-between">
                    <span>Priority User Speed</span>
                    <Badge variant="outline" className="font-mono">{(field.value * 100).toFixed(0)}% of normal delay</Badge>
                  </FormLabel>
                  <FormControl>
                    <Slider
                      min={0.1} max={1} step={0.05}
                      value={[field.value]}
                      onValueChange={([v]) => field.onChange(v)}
                      data-testid="slider-priority"
                    />
                  </FormControl>
                  <FormDescription>0.1 = reply 10× faster than normal · 1 = no difference</FormDescription>
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="activeHoursStart" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Active From (h)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={23} {...field} onChange={e => field.onChange(Number(e.target.value))} data-testid="input-active-start" />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="activeHoursEnd" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Active Until (h)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={23} {...field} onChange={e => field.onChange(Number(e.target.value))} data-testid="input-active-end" />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* Summary Bar */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20">
            <div className="flex items-center gap-6 text-sm">
              <span className="text-muted-foreground">
                Reply window: <span className="text-foreground font-mono">{watchedValues.minReplyDelay}s – {formatSeconds(watchedValues.maxReplyDelay)}</span>
              </span>
              <span className="text-muted-foreground">
                Active hours: <span className="text-foreground font-mono">{watchedValues.activeHoursStart}h–{watchedValues.activeHoursEnd}h</span>
              </span>
              <span className="text-muted-foreground">
                Night: <span className="text-foreground font-mono">{watchedValues.nightStartHour}h–{watchedValues.nightEndHour}h ({watchedValues.nightMultiplier}×)</span>
              </span>
            </div>
            <Button type="submit" disabled={updateConfig.isPending || createConfig.isPending} data-testid="btn-save-bottom">
              {(updateConfig.isPending || createConfig.isPending) ? "Saving..." : "Apply Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
