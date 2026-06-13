import { useGetSecurityStats, useListSecurityLogs, useListSanctions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Shield, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

export default function Security() {
  const { data: stats } = useGetSecurityStats();
  const { data: logs } = useListSecurityLogs({});
  const { data: sanctions } = useListSanctions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-destructive" />
          Security Matrix
        </h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Threats Detected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.threatsDetected || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Spam Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.spamBlocked || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Bans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.usersBanned || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Phishing Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats?.phishingBlocked || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Threat Logs</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px] overflow-y-auto">
            <div className="space-y-3">
              {logs?.map((log) => (
                <div key={log.id} className="flex flex-col gap-1 text-sm border-l-2 pl-3 pb-2 border-destructive">
                  <div className="flex justify-between items-center">
                    <span className="font-bold font-mono text-destructive uppercase">{log.eventType}</span>
                    <span className="text-xs text-muted-foreground font-mono">{format(new Date(log.createdAt), 'MMM dd, HH:mm')}</span>
                  </div>
                  <div className="text-foreground/80">{log.description}</div>
                  <div className="text-xs font-mono text-muted-foreground mt-1">TARGET: {log.targetUsername || 'SYSTEM'} | ACTION: {log.actionTaken || 'NONE'}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Active Sanctions</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px] overflow-y-auto">
            <div className="space-y-3">
              {sanctions?.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded bg-secondary/20 border border-border/50">
                  <div className="flex flex-col">
                    <span className="font-bold font-mono">{s.targetUsername}</span>
                    <span className="text-xs text-muted-foreground">{s.reason}</span>
                  </div>
                  <Badge variant="outline" className={`font-mono uppercase ${s.type === 'ban' ? 'text-destructive border-destructive/50' : 'text-yellow-500 border-yellow-500/50'}`}>
                    {s.type}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
