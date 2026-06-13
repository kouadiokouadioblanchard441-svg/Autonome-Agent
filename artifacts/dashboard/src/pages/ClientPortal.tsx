import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot, MessageSquare, Megaphone, Activity, LogOut, Shield,
  TrendingUp, Clock, CheckCircle2, AlertTriangle, RefreshCw,
} from "lucide-react";
import nexusLogo from "@/assets/nexus-logo.svg";

interface Overview {
  account: {
    id: number; username: string; displayName: string | null;
    healthScore: number | null; status: string; phoneNumber: string;
  } | null;
  stats: { totalMessages: number; activeCampaigns: number };
  activeCampaigns: { id: number; name: string; status: string }[];
  recentMessages: {
    id: number; content: string; direction: string;
    isAiGenerated: boolean | null; createdAt: string;
  }[];
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`font-bold font-mono text-sm ${score >= 70 ? "text-emerald-400" : score >= 40 ? "text-yellow-400" : "text-red-400"}`}>{score}/100</span>
    </div>
  );
}

export default function ClientPortal() {
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/client-portal/overview", { credentials: "include" });
      if (!r.ok) throw new Error("Impossible de charger les données");
      setOverview(await r.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const acc = overview?.account;
  const health = acc?.healthScore ?? 0;
  const statusColor: Record<string, string> = {
    connected: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    disconnected: "bg-red-500/20 text-red-400 border-red-500/30",
    cooldown: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    banned: "bg-red-700/20 text-red-500 border-red-700/30",
  };

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* Top bar */}
      <header className="border-b border-white/5 bg-[#0a1628]/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <img src={nexusLogo} alt="Nexus AI" className="w-8 h-8" />
          <div>
            <span className="font-black tracking-widest text-sm uppercase text-white">NEXUS<span className="text-cyan-400"> AI</span></span>
            <p className="text-[9px] text-cyan-400/50 font-mono tracking-widest uppercase -mt-0.5">Mon Bot Telegram</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={logout} className="text-zinc-400 hover:text-red-400 gap-2">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Page title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="w-6 h-6 text-cyan-400" />
              Tableau de bord — Mon Bot
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Vue en temps réel de votre assistant Telegram</p>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        {error && (
          <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {loading && !overview && (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        )}

        {overview && (
          <>
            {/* Account status card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="md:col-span-2 border-border/40 bg-[#0d1b2a]/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="w-4 h-4 text-cyan-400" />
                    Compte Telegram
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {acc ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-lg">{acc.displayName ?? acc.username}</p>
                          <p className="text-sm text-muted-foreground font-mono">@{acc.username} · {acc.phoneNumber}</p>
                        </div>
                        <Badge className={`border text-xs font-mono ${statusColor[acc.status] ?? "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"}`}>
                          {acc.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-muted-foreground flex items-center gap-1"><Shield className="w-3.5 h-3.5" />Score de santé</span>
                          {health >= 70 ? <span className="text-emerald-400 text-xs">✓ Excellent</span> : health >= 40 ? <span className="text-yellow-400 text-xs">⚠ Moyen</span> : <span className="text-red-400 text-xs">✗ Critique</span>}
                        </div>
                        <HealthBar score={health} />
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">Compte non connecté ou introuvable.</p>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-border/40 bg-[#0d1b2a]/60">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold font-mono">{overview.stats.totalMessages.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Messages envoyés</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/40 bg-[#0d1b2a]/60">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                        <Megaphone className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold font-mono">{overview.stats.activeCampaigns}</p>
                        <p className="text-xs text-muted-foreground">Campagnes actives</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Active campaigns */}
            {overview.activeCampaigns.length > 0 && (
              <Card className="border-border/40 bg-[#0d1b2a]/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4 text-violet-400" />
                    Campagnes en cours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {overview.activeCampaigns.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <span className="font-medium text-sm">{c.name}</span>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs border">ACTIF</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent messages */}
            <Card className="border-border/40 bg-[#0d1b2a]/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  Messages récents
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overview.recentMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Aucun message pour l'instant.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {overview.recentMessages.map((m) => (
                      <div key={m.id} className={`p-3 rounded-lg flex gap-3 ${m.direction === "outbound" ? "bg-cyan-500/5 border border-cyan-500/10" : "bg-white/5"}`}>
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${m.direction === "outbound" ? "bg-cyan-400" : "bg-zinc-500"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground/80 leading-relaxed truncate">{m.content}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {new Date(m.createdAt).toLocaleString("fr-FR")}
                            </span>
                            {m.direction === "outbound" && <span className="text-xs text-cyan-400/70">Envoyé</span>}
                            {m.isAiGenerated && <Badge variant="outline" className="text-[10px] px-1 py-0 border-violet-500/40 text-violet-400">IA</Badge>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info footer */}
            <div className="p-4 rounded-lg border border-white/5 bg-white/[0.02] flex items-start gap-3 text-xs text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-foreground/60 font-medium mb-0.5">Votre assistant fonctionne de manière autonome</p>
                <p>Toute la configuration, les campagnes et les optimisations sont gérées par votre opérateur. Vous pouvez suivre l'activité ici en temps réel.</p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
