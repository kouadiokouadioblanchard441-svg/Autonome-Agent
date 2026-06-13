import { useState } from "react";
import { useListAutoJoinTargets, useCreateAutoJoinTarget, useUpdateAutoJoinTarget, useDeleteAutoJoinTarget, useListAccounts, getListAutoJoinTargetsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, Trash2, Play, Pause, Users, Hash, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_CFG: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export default function AutoJoin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: targets = [] } = useListAutoJoinTargets();
  const { data: accounts = [] } = useListAccounts();
  const createTarget = useCreateAutoJoinTarget();
  const updateTarget = useUpdateAutoJoinTarget();
  const deleteTarget = useDeleteAutoJoinTarget();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ accountId: "", keywords: "", targetType: "group" as "group"|"channel"|"both", dailyJoinLimit: "2", maxTotal: "20", minMemberCount: "100", scrapeMembers: true });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListAutoJoinTargetsQueryKey() });

  function handleCreate() {
    if (!form.accountId || !form.keywords) return;
    createTarget.mutate({
      data: { accountId: Number(form.accountId), keywords: JSON.stringify(form.keywords.split(",").map(s => s.trim())), targetType: form.targetType, dailyJoinLimit: Number(form.dailyJoinLimit), maxTotal: Number(form.maxTotal), minMemberCount: Number(form.minMemberCount), scrapeMembers: form.scrapeMembers }
    }, { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Cible créée ✓" }); } });
  }

  function toggleStatus(id: number, current: string) {
    updateTarget.mutate({ id, data: { status: current === "active" ? "paused" : "active" } }, { onSuccess: invalidate });
  }

  const totalJoined = targets.reduce((s, t) => s + t.totalJoined, 0);
  const active = targets.filter(t => t.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><Search className="w-7 h-7 text-teal-400" />Auto-Join Groups</h1>
          <p className="text-muted-foreground mt-1">Rejoindre automatiquement des groupes cibles par mots-clés · 1–3/jour pour éviter les bans</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nouvelle cible</Button>
      </div>

      {/* Info */}
      <div className="p-4 rounded-lg border border-teal-500/30 bg-teal-500/5 text-sm">
        <p className="font-semibold text-teal-400 mb-1">🔍 Comment ça fonctionne</p>
        <p className="text-teal-200/80">Le moteur Python recherche des groupes Telegram correspondant aux mots-clés, les rejoint progressivement (limite quotidienne configurable), et scrape les membres actifs comme nouvelles cibles de campagnes. Réglé à max 2–3 groupes/jour par compte.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Cibles actives", value: active, color: "text-emerald-400" },
          { label: "Groupes rejoints", value: totalJoined, color: "text-teal-400" },
          { label: "Cibles total", value: targets.length, color: "text-primary" },
        ].map(s => (
          <Card key={s.label} className="border-border/40">
            <CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p></CardContent>
          </Card>
        ))}
      </div>

      {/* Targets */}
      {targets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Search className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>Aucune cible. Crée une règle pour commencer à rejoindre des groupes automatiquement.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {targets.map(target => {
            const account = accounts.find(a => a.id === target.accountId);
            let keywords: string[] = [];
            try { keywords = JSON.parse(target.keywords); } catch { keywords = [target.keywords]; }
            let found: { title: string; username: string; memberCount?: number }[] = [];
            try { found = JSON.parse(target.foundGroups ?? "[]"); } catch { /* ignore */ }
            const progress = target.maxTotal > 0 ? (target.totalJoined / target.maxTotal) * 100 : 0;

            return (
              <Card key={target.id} className="border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">{account?.displayName ?? account?.username ?? `#${target.accountId}`}</CardTitle>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {keywords.map(k => <Badge key={k} variant="outline" className="text-xs">{k}</Badge>)}
                      </div>
                    </div>
                    <Badge className={`border text-xs font-mono ${STATUS_CFG[target.status]}`}>{target.status.toUpperCase()}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 rounded bg-muted/20">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        {target.targetType === "group" ? <Users className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
                        {target.targetType}
                      </div>
                      <p className="font-bold font-mono">{target.totalJoined}/{target.maxTotal}</p>
                    </div>
                    <div className="text-center p-2 rounded bg-muted/20">
                      <p className="text-muted-foreground mb-1">Aujourd'hui</p>
                      <p className="font-bold font-mono">{target.joinedToday}/{target.dailyJoinLimit}</p>
                    </div>
                    <div className="text-center p-2 rounded bg-muted/20">
                      <p className="text-muted-foreground mb-1">Min membres</p>
                      <p className="font-bold font-mono">{target.minMemberCount}</p>
                    </div>
                  </div>
                  {found.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Groupes trouvés :</p>
                      {found.slice(0, 3).map((g, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-muted/20 rounded px-2 py-1">
                          <Target className="w-3 h-3 text-teal-400" />
                          <span className="truncate">{g.title}</span>
                          {g.memberCount && <span className="ml-auto text-muted-foreground">{g.memberCount.toLocaleString()}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleStatus(target.id, target.status)}>
                      {target.status === "active" ? <><Pause className="w-3.5 h-3.5 mr-1.5" />Pause</> : <><Play className="w-3.5 h-3.5 mr-1.5" />Démarrer</>}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => deleteTarget.mutate({ id: target.id }, { onSuccess: invalidate })}>
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
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle règle auto-join</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Compte AI</label>
              <Select value={form.accountId} onValueChange={v => setForm(f => ({ ...f, accountId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.displayName ?? a.username}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Mots-clés (séparés par virgule)</label>
              <Input value={form.keywords} placeholder="crypto, trading, investissement" onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Type cible</label>
              <Select value={form.targetType} onValueChange={v => setForm(f => ({ ...f, targetType: v as "group"|"channel"|"both" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="group">Groupes</SelectItem><SelectItem value="channel">Channels</SelectItem><SelectItem value="both">Les deux</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Joins/jour max</label>
              <Input type="number" value={form.dailyJoinLimit} onChange={e => setForm(f => ({ ...f, dailyJoinLimit: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Total max</label>
              <Input type="number" value={form.maxTotal} onChange={e => setForm(f => ({ ...f, maxTotal: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Min membres</label>
              <Input type="number" value={form.minMemberCount} onChange={e => setForm(f => ({ ...f, minMemberCount: e.target.value }))} />
            </div>
            <div className="col-span-2 flex items-center justify-between p-3 border rounded-lg border-border/50">
              <div><p className="text-sm font-medium">Scraper les membres</p><p className="text-xs text-muted-foreground">Ajouter les membres actifs comme cibles de campagnes</p></div>
              <Switch checked={form.scrapeMembers} onCheckedChange={v => setForm(f => ({ ...f, scrapeMembers: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createTarget.isPending || !form.accountId || !form.keywords}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
