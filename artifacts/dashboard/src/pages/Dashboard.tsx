import { useGetDashboardStats, useGetActivityTimeline, useGetRecentMessages } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainCircuit, MessageSquare, ShieldAlert, Users, Activity, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: isStatsLoading } = useGetDashboardStats();
  const { data: timeline, isLoading: isTimelineLoading } = useGetActivityTimeline();
  const { data: messages, isLoading: isMessagesLoading } = useGetRecentMessages();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight">System Overview</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
          <span className="text-muted-foreground font-mono text-xs sm:text-sm">LIVE TELEMETRY</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Accounts</CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isStatsLoading ? "..." : stats?.activeAccounts || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              out of {stats?.totalAccounts || 0} total
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">AI Messages Today</CardTitle>
            <BrainCircuit className="w-4 h-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isStatsLoading ? "..." : stats?.aiMessagesToday?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.messagesToday ? Math.round((stats.aiMessagesToday / stats.messagesToday) * 100) : 0}% of total volume
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Campaigns</CardTitle>
            <Activity className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isStatsLoading ? "..." : stats?.campaignsActive || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Executing schedules
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Security Threats</CardTitle>
            <ShieldAlert className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isStatsLoading ? "..." : stats?.threatsToday || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Detected in last 24h
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Activity Telemetry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {isTimelineLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">Loading telemetry...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Area type="monotone" dataKey="messages" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorMessages)" />
                    <Area type="monotone" dataKey="aiMessages" stroke="hsl(var(--accent))" fillOpacity={1} fill="url(#colorAI)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50 flex flex-col">
          <CardHeader>
            <CardTitle>Recent Comm Intercepts</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {isMessagesLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Intercepting...</div>
            ) : (
              <div className="space-y-4">
                {messages?.map((msg) => (
                  <div key={msg.id} className="flex gap-3 border-b border-border/50 pb-4 last:border-0">
                    <div className={`mt-1 w-2 h-2 rounded-full ${msg.direction === 'inbound' ? 'bg-primary' : 'bg-accent'}`} />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {msg.senderUsername || 'Unknown User'}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(msg.createdAt), 'HH:mm:ss')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {msg.content}
                      </p>
                      {msg.isAIGenerated && (
                        <div className="flex items-center gap-1 text-[10px] font-mono text-accent">
                          <BrainCircuit className="w-3 h-3" />
                          AI GENERATED
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
