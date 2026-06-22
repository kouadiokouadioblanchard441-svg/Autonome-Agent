import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity, Bot, Database, Wifi, Users, MessageSquare, BrainCircuit,
  Hash, MessageCircle, TrendingUp, Clock, RefreshCw, CheckCircle2,
  XCircle, AlertTriangle, BarChart3,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

async function fetchMonitoring() {
  const res = await fetch("/api/monitoring/status");
  if (!res.ok) throw new Error("Erreur monitoring");
  return res.json();
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
  );
}

function ServiceCard({ label, icon: Icon, ok, detail }: { label: string; icon: any; ok: boolean; detail?: string }) {
  return (
    <Card className={`bg-card/50 border ${ok ? "border-emerald-500/20" : "border-red-500/20"}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${ok ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
          <Icon className={`w-5 h-5 ${ok ? "text-emerald-400" : "text-red-400"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {detail && <p className="text-xs text-muted-foreground truncate">{detail}</p>}
        </div>
        <StatusDot ok={ok} />
      </CardContent>
    </Card>
  );
}

export default function Monitoring() {
  const { toast } = useToast();
  const [triggering, setTriggering] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["monitoring-status"],
    queryFn: fetchMonitoring,
    refetchInterval: 15_000,
  });

  const handleTriggerReport = async (type: "daily" | "weekly") => {
    setTriggering(true);
    try {
      const res = await fetch("/api/monitoring/reports/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const result = await res.json();
      toast({
        title: result.ok !== false ? "Rapport envoyé ✓" : "Attention",
        description: result.ok !== false
          ? `Rapport ${type} envoyé à l'admin Telegram`
          : result.message || "Vérifiez le bot Telegram",
      });
    } catch {
      toast({ title: "Erreur", description: "Impossible de déclencher le rapport", variant: "destructive" });
    } finally {
      setTriggering(false);
    }
  };

  const services = data?.services ?? {};
  const dbStats = data?.db ?? {};
  const engineInfo = data?.engine ?? {};
  const reports = data?.reports ?? {};
  const recentLogs = data?.recent_ai_logs ?? [];
  const dailyActivity = data?.daily_activity ?? [];
  const daily = reports?.daily ?? {};
  const weekly = reports?.weekly ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Monitoring Temps Réel</h1>
          <p className="text-sm text-muted-foreground mt-1">État des services et activité du moteur IA</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Rafraîchir
          </Button>
        </div>
      </div>

      {/* Services status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ServiceCard
          label="Python Engine"
          icon={Bot}
          ok={services.python_engine ?? false}
          detail={`${services.active_clients ?? 0} clients actifs`}
        />
        <ServiceCard
          label="Bot Telegram"
          icon={MessageSquare}
          ok={services.bot_running ?? false}
          detail="Polling actif"
        />
        <ServiceCard
          label="Base de données"
          icon={Database}
          ok={services.db_connected ?? false}
          detail="PostgreSQL"
        />
        <ServiceCard
          label="API Server"
          icon={Wifi}
          ok={true}
          detail="Node.js Express"
        />
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Comptes total", value: dbStats.total_accounts ?? 0, sub: `${dbStats.connected_accounts ?? 0} connectés`, icon: Users },
          { label: "Groupes", value: dbStats.total_groups ?? 0, sub: `${dbStats.active_groups ?? 0} surveillés`, icon: MessageCircle },
          { label: "Canaux", value: dbStats.total_channels ?? 0, sub: `${dbStats.auto_post_channels ?? 0} auto-post`, icon: Hash },
          { label: "Messages hoje", value: dbStats.messages_today ?? 0, sub: "aujourd'hui", icon: MessageSquare },
          { label: "Posts IA", value: dbStats.ai_messages_today ?? 0, sub: "aujourd'hui", icon: BrainCircuit },
          { label: "Tâches actives", value: engineInfo.total_tasks ?? 0, sub: "asyncio tasks", icon: Activity },
        ].map(({ label, value, sub, icon: Icon }) => (
          <Card key={label} className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className="w-3.5 h-3.5 text-primary/60" />
              </div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity chart */}
        <div className="lg:col-span-2">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Activité 7 derniers jours
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyActivity.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={dailyActivity} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gMsg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gAI" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                      labelStyle={{ color: "#94a3b8" }}
                    />
                    <Area type="monotone" dataKey="messages" name="Messages" stroke="#06b6d4" fill="url(#gMsg)" strokeWidth={2} />
                    <Area type="monotone" dataKey="aiMessages" name="IA" stroke="#8b5cf6" fill="url(#gAI)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                  Chargement des données...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reports panel */}
        <div className="space-y-3">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Rapports automatiques
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Daily summary */}
              <div className="p-3 rounded-lg bg-muted/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quotidien</span>
                  <Badge variant="outline" className="text-[10px] py-0">08:00 UTC</Badge>
                </div>
                {daily.total_messages != null ? (
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-muted-foreground">Messages :</span>
                    <span className="font-medium">{daily.total_messages}</span>
                    <span className="text-muted-foreground">Posts IA :</span>
                    <span className="font-medium text-primary">{daily.ai_posts ?? 0}</span>
                    <span className="text-muted-foreground">Menaces :</span>
                    <span className={`font-medium ${(daily.threats ?? 0) > 0 ? "text-orange-400" : "text-emerald-400"}`}>
                      {daily.threats ?? 0}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucune donnée encore</p>
                )}
              </div>

              {/* Weekly summary */}
              <div className="p-3 rounded-lg bg-muted/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hebdo</span>
                  <Badge variant="outline" className="text-[10px] py-0">Lundi 08:00</Badge>
                </div>
                {weekly.this_week_messages != null ? (
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-muted-foreground">Cette sem. :</span>
                    <span className="font-medium">{weekly.this_week_messages}</span>
                    <span className="text-muted-foreground">Variation :</span>
                    <span className={`font-medium ${(weekly.growth_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {(weekly.growth_pct ?? 0) >= 0 ? "+" : ""}{weekly.growth_pct ?? 0}%
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucune donnée encore</p>
                )}
              </div>

              {/* Trigger buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => handleTriggerReport("daily")}
                  disabled={triggering}
                >
                  Envoyer quotidien
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => handleTriggerReport("weekly")}
                  disabled={triggering}
                >
                  Envoyer hebdo
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active engines */}
          {(engineInfo.accounts?.length ?? 0) > 0 && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Moteurs actifs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {engineInfo.accounts.map((acc: any) => (
                  <div key={acc.account_id} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-muted-foreground">Compte #{acc.account_id}</span>
                    <span className="ml-auto font-mono text-primary">{acc.channels_managed} canaux</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Recent AI logs */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-primary" />
            Journal IA — Dernières actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Aucune action IA enregistrée
            </div>
          ) : (
            <div className="space-y-2">
              {recentLogs.slice(0, 12).map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors">
                  {log.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] py-0 font-mono">{log.action}</Badge>
                      <Badge variant="secondary" className="text-[10px] py-0">{log.model}</Badge>
                      <span className="text-xs text-muted-foreground">Compte #{log.account_id}</span>
                    </div>
                    {log.response_preview && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{log.response_preview}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
