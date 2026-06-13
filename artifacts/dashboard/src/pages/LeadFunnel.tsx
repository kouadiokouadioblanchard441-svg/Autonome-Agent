import { useState } from "react";
import { useListLeads, useGetLeadStats, useCreateLead, useUpdateLead, useDeleteLead, useListAccounts, getListLeadsQueryKey, getGetLeadStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Plus, Trash2, ChevronRight, TrendingUp, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Stage = "cold"|"contacted"|"interested"|"negotiating"|"converted"|"lost";

const STAGES: { id: Stage; label: string; emoji: string; color: string; bg: string }[] = [
  { id: "cold", label: "Froid", emoji: "🧊", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  { id: "contacted", label: "Contacté", emoji: "📨", color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
  { id: "interested", label: "Intéressé", emoji: "✨", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  { id: "negotiating", label: "En négo", emoji: "🤝", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  { id: "converted", label: "Converti", emoji: "🎯", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  { id: "lost", label: "Perdu", emoji: "❌", color: "text-zinc-500", bg: "bg-zinc-500/10 border-zinc-500/20" },
];

export default function LeadFunnel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: leads = [] } = useListLeads({});
  const { data: stats } = useGetLeadStats();
  const { data: accounts = [] } = useListAccounts();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ accountId: "", contactName: "", contactUsername: "", contactPhone: "", stage: "cold" as Stage, notes: "" });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListLeadsQueryKey({}) });
    qc.invalidateQueries({ queryKey: getGetLeadStatsQueryKey() });
  };

  function handleCreate() {
    if (!form.accountId || !form.contactName) return;
    createLead.mutate({
      data: { accountId: Number(form.accountId), contactName: form.contactName, contactUsername: form.contactUsername || undefined, contactPhone: form.contactPhone || undefined, stage: form.stage, notes: form.notes || undefined }
    }, { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Lead ajouté ✓" }); } });
  }

  function moveStage(id: number, currentStage: Stage, dir: 1 | -1) {
    const idx = STAGES.findIndex(s => s.id === currentStage);
    const next = STAGES[idx + dir];
    if (!next) return;
    updateLead.mutate({ id, data: { stage: next.id } }, { onSuccess: invalidate });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><Target className="w-7 h-7 text-emerald-400" />Lead Funnel</h1>
          <p className="text-muted-foreground mt-1">Pipeline Kanban · Suivi des contacts de Froid → Converti</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nouveau lead</Button>
      </div>

      {/* Funnel stats */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {STAGES.map(s => {
            const count = (stats as Record<string, number>)[s.id] ?? 0;
            return (
              <div key={s.id} className={`p-3 rounded-lg border text-center ${s.bg}`}>
                <div className="text-lg">{s.emoji}</div>
                <div className={`text-xl font-bold font-mono ${s.color}`}>{count}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            );
          })}
          <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-emerald-400" />
            <div className="text-xl font-bold font-mono text-emerald-400">{stats.conversionRate}%</div>
            <div className="text-xs text-muted-foreground mt-0.5">Conversion</div>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.stage === stage.id);
          return (
            <div key={stage.id} className="space-y-2">
              <div className={`px-3 py-2 rounded-t-lg border-b ${stage.bg} flex items-center justify-between`}>
                <span className={`text-xs font-semibold ${stage.color}`}>{stage.emoji} {stage.label}</span>
                <Badge variant="outline" className="text-xs font-mono">{stageLeads.length}</Badge>
              </div>
              <div className="space-y-2 min-h-24">
                {stageLeads.map(lead => {
                  const stageIdx = STAGES.findIndex(s => s.id === lead.stage as Stage);
                  return (
                    <Card key={lead.id} className={`border ${stage.bg}`}>
                      <CardContent className="p-3 space-y-2">
                        <p className="font-medium text-sm truncate">{lead.contactName}</p>
                        {lead.contactUsername && <p className="text-xs text-muted-foreground">@{lead.contactUsername}</p>}
                        {lead.sourceGroupName && <p className="text-xs text-muted-foreground truncate">📍 {lead.sourceGroupName}</p>}
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" disabled={stageIdx === 0} onClick={() => moveStage(lead.id, lead.stage as Stage, -1)}>←</Button>
                          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" disabled={stageIdx === STAGES.length - 1} onClick={() => moveStage(lead.id, lead.stage as Stage, 1)}><ChevronRight className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-destructive ml-auto" onClick={() => deleteLead.mutate({ id: lead.id }, { onSuccess: invalidate })}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau lead</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Compte AI</label>
              <Select value={form.accountId} onValueChange={v => setForm(f => ({ ...f, accountId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.displayName ?? a.username}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {[["Nom*", "contactName", "Alex Martin"], ["@Username", "contactUsername", "@alex"], ["Téléphone", "contactPhone", "+33..."], ["Groupe source", "contactPhone", "CryptoFR"]].slice(0,3).map(([l, k, p]) => (
              <div key={k}><label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">{l}</label><Input value={(form as Record<string, string>)[k]} placeholder={p} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
            ))}
            <div><label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Stage initial</label>
              <Select value={form.stage} onValueChange={v => setForm(f => ({ ...f, stage: v as Stage }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.emoji} {s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Notes</label><Input value={form.notes} placeholder="Info importantes..." onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createLead.isPending || !form.accountId || !form.contactName}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
