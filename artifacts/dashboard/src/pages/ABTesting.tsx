import { useState, useEffect } from "react";
import {
  useListAbTests, useCreateAbTest, useStartAbTest,
  useDeleteAbTest, getListAbTestsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  FlaskConical, Plus, Play, Trash2, Trophy, BarChart2,
  Zap, Users, RefreshCw, ChevronRight, Cpu,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useToast } from "@/hooks/use-toast";

const STATUS_CFG: Record<string, { cls: string; label: string }> = {
  draft:     { cls: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",     label: "DRAFT" },
  active:    { cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "ACTIF" },
  completed: { cls: "bg-blue-500/20 text-blue-400 border-blue-500/30",     label: "TERMINÉ" },
};

const COMMUNITY_TYPES = [
  { value: "channel", label: "Canal" },
  { value: "group",   label: "Groupe" },
];

interface CommunityOption {
  tg_id: string;
  title: string;
  type: "channel" | "group";
}

interface AbCommunityTest {
  id: number;
  name: string;
  community_type: string;
  community_id: string;
  prompt_mode: number;
  variant_a: string;
  variant_b: string;
  status: string;
  winner_variant: string | null;
  sent_a: number;
  sent_b: number;
  replies_a: number;
  replies_b: number;
  reactions_a: number;
  reactions_b: number;
  reply_rate_a: number;
  reply_rate_b: number;
  engagement_a: number;
  engagement_b: number;
  leading: "a" | "b" | null;
  target_count: number;
  started_at: string | null;
  completed_at: string | null;
}

function EngagementBar({ test }: { test: AbCommunityTest }) {
  const data = [
    {
      name: "Variante A",
      "Envois":    test.sent_a,
      "Réponses":  test.replies_a,
      "Réactions": test.reactions_a,
    },
    {
      name: "Variante B",
      "Envois":    test.sent_b,
      "Réponses":  test.replies_b,
      "Réactions": test.reactions_b,
    },
  ];
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} barSize={18} barGap={4}>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#aaa" }}
        />
        <Bar dataKey="Envois"    fill="#334155" radius={3} />
        <Bar dataKey="Réponses"  fill="#10b981" radius={3} />
        <Bar dataKey="Réactions" fill="#818cf8" radius={3} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RateBar({ rateA, rateB, winnerVariant }: { rateA: number; rateB: number; winnerVariant: string | null }) {
  const total = rateA + rateB;
  const pctA = total > 0 ? (rateA / total) * 100 : 50;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className={winnerVariant === "a" ? "text-yellow-400 font-semibold" : ""}>A · {(rateA * 100).toFixed(1)}%</span>
        <span className={winnerVariant === "b" ? "text-yellow-400 font-semibold" : ""}>B · {(rateB * 100).toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted/30 overflow-hidden flex">
        <div
          className="h-full rounded-l-full transition-all duration-700"
          style={{ width: `${pctA}%`, background: winnerVariant === "a" ? "#eab308" : "#10b981" }}
        />
        <div
          className="h-full rounded-r-full flex-1 transition-all duration-700"
          style={{ background: winnerVariant === "b" ? "#eab308" : "#818cf8" }}
        />
      </div>
    </div>
  );
}

export default function ABTesting() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Standard A/B tests (from Node.js API)
  const { data: tests = [], isLoading } = useListAbTests();
  const createTest = useCreateAbTest();
  const startTest  = useStartAbTest();
  const deleteTest = useDeleteAbTest();

  // Community A/B tests (from Python engine)
  const [communityTests, setCommunityTests] = useState<AbCommunityTest[]>([]);
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(false);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    variantA: "",
    variantB: "",
    targetCount: "50",
    promptMode: false,          // false = raw text, true = AI prompt instructions
    communityType: "channel",
    communityId: "",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListAbTestsQueryKey() });

  // Fetch communities for the select
  useEffect(() => {
    async function loadCommunities() {
      try {
        const [grRes, chRes] = await Promise.all([
          fetch("/api/groups"),
          fetch("/api/channels"),
        ]);
        const groups   = grRes.ok   ? (await grRes.json()).map((g: any) => ({ tg_id: String(g.telegramId), title: g.title, type: "group" as const }))   : [];
        const channels = chRes.ok   ? (await chRes.json()).map((c: any) => ({ tg_id: String(c.telegramId), title: c.title, type: "channel" as const })) : [];
        setCommunities([...channels, ...groups]);
      } catch (_) {}
    }
    loadCommunities();
  }, []);

  // Fetch community A/B tests from Python engine
  async function loadCommunityTests() {
    setLoadingCommunity(true);
    try {
      const res = await fetch("http://localhost:8090/ab-tests/community");
      if (res.ok) {
        const data = await res.json();
        setCommunityTests(data.tests ?? []);
      }
    } catch (_) {}
    setLoadingCommunity(false);
  }

  useEffect(() => { loadCommunityTests(); }, []);

  // Record manual engagement (for dashboard testing)
  async function recordEngage(testId: number, variant: "a" | "b", kind = "reply") {
    try {
      await fetch(`http://localhost:8090/ab-tests/${testId}/engage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant, kind }),
      });
      await loadCommunityTests();
      toast({ title: `Engagement variant ${variant.toUpperCase()} enregistré ✓` });
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  function handleCreate() {
    if (!form.name || !form.variantA || !form.variantB) return;
    createTest.mutate(
      {
        data: {
          name:          form.name,
          variantA:      form.variantA,
          variantB:      form.variantB,
          targetCount:   Number(form.targetCount),
          promptMode:    form.promptMode ? 1 : 0,
          communityType: form.communityId ? form.communityType : undefined,
          communityId:   form.communityId || undefined,
        } as any,
      },
      {
        onSuccess: () => {
          invalidate();
          loadCommunityTests();
          setOpen(false);
          toast({ title: "Test A/B créé ✓" });
          setForm({ name: "", variantA: "", variantB: "", targetCount: "50", promptMode: false, communityType: "channel", communityId: "" });
        },
      },
    );
  }

  function handleStart(id: number) {
    startTest.mutate({ id }, {
      onSuccess: () => {
        invalidate();
        loadCommunityTests();
        toast({ title: "Test démarré ✓ — Le moteur injecte maintenant les variantes" });
      },
    });
  }

  const communityLinkedTests = tests.filter(t => t.communityId);
  const genericTests          = tests.filter(t => !t.communityId);
  const active    = tests.filter(t => t.status === "active").length;
  const completed = tests.filter(t => t.status === "completed").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-3">
            <FlaskConical className="w-7 h-7 text-pink-400" />A/B Testing Contenu
          </h1>
          <p className="text-muted-foreground mt-1">
            Teste 2 prompts AI en parallèle · Mesure l'engagement · Gagnant automatique
          </p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nouveau test</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Tests actifs",   value: active,        color: "text-emerald-400", icon: <Zap className="w-4 h-4" /> },
          { label: "Complétés",      value: completed,     color: "text-blue-400",    icon: <Trophy className="w-4 h-4" /> },
          { label: "Par communauté", value: communityLinkedTests.length, color: "text-violet-400", icon: <Users className="w-4 h-4" /> },
          { label: "Total",          value: tests.length,  color: "text-primary",     icon: <BarChart2 className="w-4 h-4" /> },
        ].map(s => (
          <Card key={s.label} className="border-border/40">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
              </div>
              <div className={`opacity-40 ${s.color}`}>{s.icon}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Community A/B tests (live from Python engine) ── */}
      {communityLinkedTests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-violet-400 flex items-center gap-2">
              <Cpu className="w-4 h-4" />Tests par communauté — Moteur IA actif
            </h2>
            <Button size="sm" variant="ghost" onClick={loadCommunityTests} disabled={loadingCommunity}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingCommunity ? "animate-spin" : ""}`} />Actualiser
            </Button>
          </div>

          {communityTests.map(ct => (
            <Card key={ct.id} className="border-violet-500/20 bg-violet-500/3">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {ct.winner_variant && <Trophy className="w-4 h-4 text-yellow-400" />}
                    <CardTitle className="text-base">{ct.name}</CardTitle>
                    <Badge className="text-xs bg-violet-500/20 text-violet-300 border-violet-500/30 border">
                      {ct.community_type === "channel" ? "📢" : "👥"} ID {ct.community_id}
                    </Badge>
                    {ct.prompt_mode === 1 && (
                      <Badge className="text-xs bg-cyan-500/20 text-cyan-400 border-cyan-500/30 border">
                        <Cpu className="w-3 h-3 mr-1" />Prompt IA
                      </Badge>
                    )}
                  </div>
                  <Badge className={`border text-xs font-mono ${STATUS_CFG[ct.status]?.cls ?? ""}`}>
                    {STATUS_CFG[ct.status]?.label ?? ct.status.toUpperCase()}
                  </Badge>
                </div>
                <CardDescription>
                  {ct.sent_a + ct.sent_b} / {ct.target_count} envois
                  {ct.leading && (
                    <span className="ml-2 text-emerald-400">
                      · Variante {ct.leading.toUpperCase()} en tête
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={Math.min(((ct.sent_a + ct.sent_b) / (ct.target_count || 1)) * 100, 100)} className="h-1.5" />

                {/* Rate comparison bar */}
                <RateBar rateA={ct.reply_rate_a} rateB={ct.reply_rate_b} winnerVariant={ct.winner_variant} />

                {/* Prompts */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Variante A", text: ct.variant_a, sent: ct.sent_a, eng: ct.engagement_a, rate: ct.reply_rate_a, isWinner: ct.winner_variant === "a", variant: "a" as const },
                    { label: "Variante B", text: ct.variant_b, sent: ct.sent_b, eng: ct.engagement_b, rate: ct.reply_rate_b, isWinner: ct.winner_variant === "b", variant: "b" as const },
                  ].map(v => (
                    <div
                      key={v.label}
                      className={`p-3 rounded-lg border ${v.isWinner ? "border-yellow-500/40 bg-yellow-500/5" : "border-border/40 bg-muted/10"}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-semibold font-mono ${v.isWinner ? "text-yellow-400" : "text-muted-foreground"}`}>
                          {v.label} {v.isWinner && "👑"}
                        </span>
                        <span className={`text-lg font-bold font-mono ${v.rate === Math.max(ct.reply_rate_a, ct.reply_rate_b) && v.rate > 0 ? "text-emerald-400" : "text-foreground"}`}>
                          {(v.rate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 italic mb-2">"{v.text}"</p>
                      <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                        <div><span className="text-muted-foreground">Envois </span><span className="font-mono">{v.sent}</span></div>
                        <div><span className="text-muted-foreground">Engage </span><span className="font-mono text-emerald-400">{v.eng}</span></div>
                      </div>
                      {ct.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-6 text-xs"
                          onClick={() => recordEngage(ct.id, v.variant)}
                        >
                          +1 engagement
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bar chart */}
                <EngagementBar test={ct} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Generic A/B tests (no community) ── */}
      {genericTests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />Tests génériques
          </h2>
          {genericTests.map(test => {
            const totalSent  = test.sentA + test.sentB;
            const progressPct = test.targetCount > 0 ? Math.min((totalSent / test.targetCount) * 100, 100) : 0;
            const rateA = (test.replyRateA * 100).toFixed(1);
            const rateB = (test.replyRateB * 100).toFixed(1);
            return (
              <Card key={test.id} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {test.winnerVariant && <Trophy className="w-4 h-4 text-yellow-400" />}
                        {test.name}
                      </CardTitle>
                      <CardDescription>{totalSent} / {test.targetCount} envois · {progressPct.toFixed(0)}%</CardDescription>
                    </div>
                    <Badge className={`border text-xs font-mono ${STATUS_CFG[test.status]?.cls ?? ""}`}>
                      {STATUS_CFG[test.status]?.label ?? test.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={progressPct} className="h-1.5" />
                  <RateBar rateA={test.replyRateA} rateB={test.replyRateB} winnerVariant={test.winnerVariant ?? null} />
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Variante A", text: test.variantA, sent: test.sentA, replies: test.repliesA, rate: rateA, isWinner: test.winnerVariant === "a" },
                      { label: "Variante B", text: test.variantB, sent: test.sentB, replies: test.repliesB, rate: rateB, isWinner: test.winnerVariant === "b" },
                    ].map(v => (
                      <div key={v.label} className={`p-3 rounded-lg border ${v.isWinner ? "border-yellow-500/40 bg-yellow-500/5" : "border-border/40 bg-muted/10"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-semibold font-mono ${v.isWinner ? "text-yellow-400" : "text-muted-foreground"}`}>{v.label} {v.isWinner && "👑"}</span>
                          <span className={`text-lg font-bold font-mono ${parseFloat(rateA) > parseFloat(rateB) && v.label === "Variante A" ? "text-emerald-400" : parseFloat(rateB) > parseFloat(rateA) && v.label === "Variante B" ? "text-emerald-400" : "text-foreground"}`}>{v.rate}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 italic mb-2">"{v.text}"</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div><span className="text-muted-foreground">Envois </span><span className="font-mono">{v.sent}</span></div>
                          <div><span className="text-muted-foreground">Réponses </span><span className="font-mono text-emerald-400">{v.replies}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {test.status === "draft" && (
                      <Button size="sm" onClick={() => handleStart(test.id)} disabled={startTest.isPending}>
                        <Play className="w-3.5 h-3.5 mr-1.5" />Démarrer
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive ml-auto"
                      onClick={() => deleteTest.mutate({ id: test.id }, { onSuccess: invalidate })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && tests.length === 0 && communityTests.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="mb-4">Aucun test A/B. Lance ton premier test pour optimiser tes messages.</p>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Créer un test</Button>
        </div>
      )}

      {/* ── Create dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-pink-400" />Nouveau test A/B
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nom du test</label>
              <Input value={form.name} placeholder="Ex: Accroche crypto #3" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            {/* Mode toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40">
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />Mode Prompt IA
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {form.promptMode
                    ? "Les variantes sont des instructions IA injectées dans le générateur de contenu"
                    : "Les variantes sont des messages texte envoyés directement"}
                </p>
              </div>
              <Switch
                checked={form.promptMode}
                onCheckedChange={v => setForm(f => ({ ...f, promptMode: v }))}
              />
            </div>

            {/* Variantes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block text-emerald-400">
                  Variante A {form.promptMode ? "(Prompt IA)" : ""}
                </label>
                <Textarea
                  value={form.variantA}
                  placeholder={form.promptMode
                    ? "Ex: Sois enthousiaste et pose une question ouverte sur les cryptos"
                    : "Ex: Salut! J'ai vu que tu faisais du trading..."}
                  rows={5}
                  onChange={e => setForm(f => ({ ...f, variantA: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block text-violet-400">
                  Variante B {form.promptMode ? "(Prompt IA)" : ""}
                </label>
                <Textarea
                  value={form.variantB}
                  placeholder={form.promptMode
                    ? "Ex: Partage une analyse de marché et invite à la discussion"
                    : "Ex: Hey! Tu t'intéresses aux crypto?"}
                  rows={5}
                  onChange={e => setForm(f => ({ ...f, variantB: e.target.value }))}
                />
              </div>
            </div>

            {/* Community link */}
            <div className="p-3 rounded-lg border border-border/40 bg-muted/10 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-400" />Lier à une communauté (optionnel)
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                  <select
                    className="w-full h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
                    value={form.communityType}
                    onChange={e => setForm(f => ({ ...f, communityType: e.target.value, communityId: "" }))}
                  >
                    {COMMUNITY_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Communauté</label>
                  <select
                    className="w-full h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
                    value={form.communityId}
                    onChange={e => setForm(f => ({ ...f, communityId: e.target.value }))}
                  >
                    <option value="">— Aucune (test générique) —</option>
                    {communities
                      .filter(c => c.type === form.communityType)
                      .map(c => (
                        <option key={c.tg_id} value={c.tg_id}>{c.title} ({c.tg_id})</option>
                      ))}
                  </select>
                </div>
              </div>
              {form.communityId && (
                <p className="text-xs text-violet-300 flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" />
                  Le moteur injectera automatiquement la variante lors de chaque autopost vers cette communauté.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Nombre d'envois cibles</label>
              <Input
                type="number"
                value={form.targetCount}
                onChange={e => setForm(f => ({ ...f, targetCount: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              onClick={handleCreate}
              disabled={createTest.isPending || !form.name || !form.variantA || !form.variantB}
            >
              <FlaskConical className="w-4 h-4 mr-2" />Créer le test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
