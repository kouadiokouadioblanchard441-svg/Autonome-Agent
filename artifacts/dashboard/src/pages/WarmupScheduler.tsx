import { useState } from "react";
import { useListWarmupPlans, useCreateWarmupPlan, useUpdateWarmupPlan, useDeleteWarmupPlan, useAdvanceWarmupDay, useListAccounts, getListWarmupPlansQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Flame, Plus, Play, Pause, Trash2, ChevronRight, TrendingUp, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export default function WarmupScheduler() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: plans = [] } = useListWarmupPlans();
  const { data: accounts = [] } = useListAccounts();
  const createPlan = useCreateWarmupPlan();
  const updatePlan = useUpdateWarmupPlan();
  const deletePlan = useDeleteWarmupPlan();
  const advanceDay = useAdvanceWarmupDay();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ accountId: "", totalDays: "14", dailyLimitStart: "2", dailyLimitEnd: "40", growthType: "linear" as "linear" | "exponential" });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListWarmupPlansQueryKey() });

  function handleCreate() {
    if (!form.accountId) return;
    createPlan.mutate({
      data: { accountId: Number(form.accountId), totalDays: Number(form.totalDays), dailyLimitStart: Number(form.dailyLimitStart), dailyLimitEnd: Number(form.dailyLimitEnd), growthType: form.growthType }
    }, { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Plan créé ✓" }); } });
  }

  function toggleStatus(id: number, current: string) {
    const next = current === "active" ? "paused" : "active";
    updatePlan.mutate({ id, data: { status: next } }, { onSuccess: invalidate });
  }

  function handleAdvance(id: number) {
    advanceDay.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Jour avancé ✓" }); } });
  }

  function handleDelete(id: number) {
    deletePlan.mutate({ id }, { onSuccess: invalidate });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><Flame className="w-7 h-7 text-orange-400" /> Warm-Up Scheduler</h1>
          <p className="text-muted-foreground mt-1">Augmentation progressive de l'activité pour les nouveaux comptes — évite les bans instantanés</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nouveau plan</Button>
      </div>

      {/* Info banner */}
      <div className="p-4 rounded-lg border border-orange-500/30 bg-orange-500/5 text-sm text-orange-200/80">
        <p className="font-semibold text-orange-400 mb-1">⚡ Pourquoi le warm-up est critique</p>
        Un compte Telegram qui envoie 50 messages dès le premier jour se fait bannir instantanément. Le warm-up commence à <strong>2 msgs/jour</strong> et monte progressivement sur <strong>14–30 jours</strong>, imitant un humain qui découvre la plateforme.
      </div>

      {/* Plans grid */}
      {plans.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Flame className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Aucun plan de warm-up. Crée-en un pour un nouveau compte.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const account = accounts.find(a => a.id === plan.accountId);
            const progress = plan.totalDays > 0 ? (plan.currentDay / plan.totalDays) * 100 : 0;
            const todayProgress = plan.todayLimit > 0 ? (plan.todayCount / plan.todayLimit) * 100 : 0;
            return (
              <Card key={plan.id} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{account?.displayName ?? account?.username ?? `Account #${plan.accountId}`}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {plan.dailyLimitStart} → {plan.dailyLimitEnd} msgs/jour · {plan.growthType}
                      </p>
                    </div>
                    <Badge className={`border text-xs font-mono ${STATUS_COLORS[plan.status]}`}>{plan.status.toUpperCase()}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Overall progress */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Jour {plan.currentDay} / {plan.totalDays}</span>
                      <span className="font-mono text-primary">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  {/* Today */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Aujourd'hui : {plan.todayCount} / {plan.todayLimit} msgs</span>
                      <span className="font-mono">{Math.round(todayProgress)}%</span>
                    </div>
                    <Progress value={todayProgress} className="h-1.5 bg-muted" />
                  </div>
                  {/* Actions */}
                  <div className="flex gap-2">
                    {plan.status !== "completed" && (
                      <Button size="sm" variant="outline" onClick={() => toggleStatus(plan.id, plan.status)}>
                        {plan.status === "active" ? <><Pause className="w-3.5 h-3.5 mr-1.5" />Pause</> : <><Play className="w-3.5 h-3.5 mr-1.5" />Start</>}
                      </Button>
                    )}
                    {plan.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => handleAdvance(plan.id)} disabled={advanceDay.isPending}>
                        <ChevronRight className="w-3.5 h-3.5 mr-1" />Avancer jour
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => handleDelete(plan.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Plans actifs", value: plans.filter(p => p.status === "active").length, color: "text-emerald-400", icon: Play },
          { label: "Complétés", value: plans.filter(p => p.status === "completed").length, color: "text-blue-400", icon: TrendingUp },
          { label: "Total plans", value: plans.length, color: "text-primary", icon: Calendar },
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

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau plan de warm-up</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Compte Telegram</label>
              <Select value={form.accountId} onValueChange={v => setForm(f => ({ ...f, accountId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un compte" /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.displayName ?? a.username ?? a.phoneNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium mb-1.5 block">Durée (jours)</label><Input type="number" value={form.totalDays} onChange={e => setForm(f => ({ ...f, totalDays: e.target.value }))} /></div>
              <div><label className="text-sm font-medium mb-1.5 block">Msgs/jour start</label><Input type="number" value={form.dailyLimitStart} onChange={e => setForm(f => ({ ...f, dailyLimitStart: e.target.value }))} /></div>
              <div><label className="text-sm font-medium mb-1.5 block">Msgs/jour final</label><Input type="number" value={form.dailyLimitEnd} onChange={e => setForm(f => ({ ...f, dailyLimitEnd: e.target.value }))} /></div>
              <div><label className="text-sm font-medium mb-1.5 block">Croissance</label>
                <Select value={form.growthType} onValueChange={v => setForm(f => ({ ...f, growthType: v as "linear" | "exponential" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="linear">Linéaire</SelectItem><SelectItem value="exponential">Exponentielle</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createPlan.isPending || !form.accountId}>Créer le plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
