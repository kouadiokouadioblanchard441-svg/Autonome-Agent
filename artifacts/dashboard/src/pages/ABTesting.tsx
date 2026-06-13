import { useState } from "react";
import { useListAbTests, useCreateAbTest, useStartAbTest, useDeleteAbTest, getListAbTestsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { FlaskConical, Plus, Play, Trash2, Trophy, BarChart2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_CFG: Record<string, string> = {
  draft: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export default function ABTesting() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: tests = [] } = useListAbTests();
  const createTest = useCreateAbTest();
  const startTest = useStartAbTest();
  const deleteTest = useDeleteAbTest();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", variantA: "", variantB: "", targetCount: "100" });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListAbTestsQueryKey() });

  function handleCreate() {
    if (!form.name || !form.variantA || !form.variantB) return;
    createTest.mutate({
      data: { name: form.name, variantA: form.variantA, variantB: form.variantB, targetCount: Number(form.targetCount) }
    }, { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Test A/B créé ✓" }); } });
  }

  function handleStart(id: number) {
    startTest.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Test démarré ✓" }); } });
  }

  const active = tests.filter(t => t.status === "active").length;
  const completed = tests.filter(t => t.status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><FlaskConical className="w-7 h-7 text-pink-400" />A/B Testing</h1>
          <p className="text-muted-foreground mt-1">Compare 2 variantes de messages · Sélection automatique du gagnant</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nouveau test</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Tests actifs", value: active, color: "text-emerald-400" },
          { label: "Complétés", value: completed, color: "text-blue-400" },
          { label: "Total", value: tests.length, color: "text-primary" },
        ].map(s => (
          <Card key={s.label} className="border-border/40">
            <CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p></CardContent>
          </Card>
        ))}
      </div>

      {/* Tests list */}
      {tests.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>Aucun test A/B. Lance ton premier test pour optimiser tes messages.</p></div>
      ) : (
        <div className="space-y-4">
          {tests.map(test => {
            const totalSent = test.sentA + test.sentB;
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
                      <CardDescription>
                        {totalSent} / {test.targetCount} envois · {progressPct.toFixed(0)}% complété
                      </CardDescription>
                    </div>
                    <Badge className={`border text-xs font-mono ${STATUS_CFG[test.status]}`}>{test.status.toUpperCase()}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={progressPct} className="h-1.5" />
                  {/* Variants comparison */}
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
                          <div><span className="text-muted-foreground">Envoyés </span><span className="font-mono">{v.sent}</span></div>
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
                    <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => deleteTest.mutate({ id: test.id }, { onSuccess: invalidate })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau test A/B</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="text-sm font-medium mb-1.5 block">Nom du test</label><Input value={form.name} placeholder="Test accroche #1" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Variante A</label>
                <Textarea value={form.variantA} placeholder="Salut! J'ai vu que tu faisais du trading..." rows={4} onChange={e => setForm(f => ({ ...f, variantA: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Variante B</label>
                <Textarea value={form.variantB} placeholder="Hey! Tu t'intéresses aux crypto?" rows={4} onChange={e => setForm(f => ({ ...f, variantB: e.target.value }))} />
              </div>
            </div>
            <div><label className="text-sm font-medium mb-1.5 block">Nombre de contacts cibles</label><Input type="number" value={form.targetCount} onChange={e => setForm(f => ({ ...f, targetCount: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createTest.isPending || !form.name || !form.variantA || !form.variantB}>Créer le test</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
