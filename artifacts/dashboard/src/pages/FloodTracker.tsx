import { useListFloodEvents, useGetFloodStats, useCreateFloodEvent, useResolveFloodEvent, useListAccounts, getListFloodEventsQueryKey, getGetFloodStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Zap, CheckCircle2, Clock, TrendingUp, ShieldAlert } from "lucide-react";

const RISK_CFG: Record<string, { color: string; bg: string; label: string }> = {
  safe: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", label: "SÛUR" },
  caution: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", label: "ATTENTION" },
  danger: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", label: "DANGER" },
  critical: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", label: "CRITIQUE" },
};

const SEV_CFG: Record<string, string> = {
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function FloodTracker() {
  const qc = useQueryClient();
  const { data: events = [] } = useListFloodEvents({});
  const { data: stats = [] } = useGetFloodStats();
  const { data: accounts = [] } = useListAccounts();
  const resolveEvent = useResolveFloodEvent();

  function accountName(id: number) {
    const a = accounts.find(a => a.id === id);
    return a?.displayName ?? a?.username ?? `#${id}`;
  }

  function handleResolve(id: number) {
    resolveEvent.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListFloodEventsQueryKey({}) });
        qc.invalidateQueries({ queryKey: getGetFloodStatsQueryKey() });
      }
    });
  }

  const pending = events.filter(e => !e.resolved).length;
  const totalWait = events.reduce((s, e) => s + e.waitSeconds, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3"><Zap className="w-7 h-7 text-yellow-400" /> FloodWait Tracker</h1>
        <p className="text-muted-foreground mt-1">Prédit les FloodWait avant qu'ils arrivent · Protège la santé des comptes</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Événements totaux", value: events.length, icon: Zap, color: "text-yellow-400" },
          { label: "Non résolus", value: pending, icon: AlertTriangle, color: "text-red-400" },
          { label: "Temps d'attente total", value: `${Math.round(totalWait / 60)}min`, icon: Clock, color: "text-orange-400" },
          { label: "Comptes surveillés", value: stats.length, icon: ShieldAlert, color: "text-primary" },
        ].map(s => (
          <Card key={s.label} className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-account risk */}
      {stats.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Risque par compte</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.map((s) => {
              const risk = RISK_CFG[s.riskLevel] ?? RISK_CFG.safe;
              return (
                <div key={s.accountId} className={`p-4 rounded-lg border ${risk.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{accountName(s.accountId)}</span>
                    <Badge className={`border text-xs font-mono ${risk.bg} ${risk.color}`}>{risk.label}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><p className="text-muted-foreground">Événements</p><p className={`font-mono font-bold ${risk.color}`}>{s.totalEvents}</p></div>
                    <div><p className="text-muted-foreground">Attente moy.</p><p className="font-mono font-bold">{Math.round(s.avgWaitSeconds)}s</p></div>
                  </div>
                  {s.predictedNextFlood && (
                    <div className="mt-2 pt-2 border-t border-current/10 text-xs text-red-400">
                      ⚠ Prochain flood prévu dans ~30min
                    </div>
                  )}
                  {s.lastEventAt && (
                    <p className="text-xs text-muted-foreground mt-1">Dernier : {new Date(s.lastEventAt).toLocaleString("fr-FR")}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Events table */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" /> Historique des événements</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/50">
                <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                  {["Compte", "Date", "Attente", "Msgs avant", "Contexte", "Sévérité", "Statut", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Aucun événement FloodWait enregistré</td></tr>}
                {events.map(ev => (
                  <tr key={ev.id} className={`border-b border-border/20 hover:bg-muted/10 ${ev.resolved ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 font-medium">{accountName(ev.accountId)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(ev.triggeredAt).toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3 font-mono font-bold text-orange-400">{ev.waitSeconds}s</td>
                    <td className="px-4 py-3 font-mono">{ev.messagesSentBefore}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-24">{ev.context ?? "—"}</td>
                    <td className="px-4 py-3"><Badge className={`border text-xs font-mono ${SEV_CFG[ev.severity]}`}>{ev.severity.toUpperCase()}</Badge></td>
                    <td className="px-4 py-3">
                      {ev.resolved
                        ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Résolu</span>
                        : <span className="text-xs text-red-400">En attente</span>}
                    </td>
                    <td className="px-4 py-3">
                      {!ev.resolved && (
                        <Button size="sm" variant="ghost" onClick={() => handleResolve(ev.id)} disabled={resolveEvent.isPending}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
