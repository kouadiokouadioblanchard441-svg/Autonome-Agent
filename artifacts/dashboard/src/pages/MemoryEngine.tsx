import { useState } from "react";
import { useListMemories, useCreateMemory, useUpdateMemory, useDeleteMemory, useListAccounts, getListMemoriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Brain, Plus, Trash2, MessageCircle, Tag, Globe, TrendingUp, Thermometer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const INTEREST_CFG: Record<string, { color: string; border: string; label: string; icon: string }> = {
  cold: { color: "text-blue-400", border: "border-blue-500/30", label: "FROID", icon: "🧊" },
  warm: { color: "text-yellow-400", border: "border-yellow-500/30", label: "TIÈDE", icon: "☀️" },
  hot: { color: "text-red-400", border: "border-red-500/30", label: "CHAUD", icon: "🔥" },
};

export default function MemoryEngine() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const { data: accounts = [] } = useListAccounts();

  const params: Record<string, unknown> = {};
  if (accountFilter !== "all") params.accountId = Number(accountFilter);
  if (filter !== "all") params.interestLevel = filter;

  const { data: memories = [] } = useListMemories(params as { accountId?: number; interestLevel?: string });
  const createMem = useCreateMemory();
  const updateMem = useUpdateMemory();
  const deleteMem = useDeleteMemory();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ accountId: "", contactName: "", contactUsername: "", contactPhone: "", interestLevel: "cold" as "cold"|"warm"|"hot", topics: "", notes: "", detectedLanguage: "" });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListMemoriesQueryKey(params as { accountId?: number; interestLevel?: string }) });

  function handleCreate() {
    if (!form.accountId || !form.contactName) return;
    createMem.mutate({
      data: { accountId: Number(form.accountId), contactName: form.contactName, contactUsername: form.contactUsername || undefined, contactPhone: form.contactPhone || undefined, interestLevel: form.interestLevel, topics: form.topics ? JSON.stringify(form.topics.split(",").map(s => s.trim())) : "[]", notes: form.notes || undefined, detectedLanguage: form.detectedLanguage || undefined }
    }, { onSuccess: () => { invalidate(); setOpen(false); toast({ title: "Mémoire créée ✓" }); } });
  }

  function handleInterestChange(id: number, level: string) {
    updateMem.mutate({ id, data: { interestLevel: level as "cold"|"warm"|"hot" } }, { onSuccess: invalidate });
  }

  const hot = memories.filter(m => m.interestLevel === "hot").length;
  const warm = memories.filter(m => m.interestLevel === "warm").length;
  const langs = [...new Set(memories.map(m => m.detectedLanguage).filter(Boolean))].length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><Brain className="w-7 h-7 text-violet-400" />Memory Engine</h1>
          <p className="text-muted-foreground mt-1">Mémoire par contact — l'AI répond en cohérence avec les échanges passés</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nouveau contact</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total contacts", value: memories.length, icon: Brain, color: "text-violet-400" },
          { label: "🔥 Chauds", value: hot, icon: Thermometer, color: "text-red-400" },
          { label: "☀️ Tièdes", value: warm, icon: TrendingUp, color: "text-yellow-400" },
          { label: "Langues détectées", value: langs, icon: Globe, color: "text-sky-400" },
        ].map(s => (
          <Card key={s.label} className="border-border/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tous les comptes" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Tous les comptes</SelectItem>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.displayName ?? a.username}</SelectItem>)}</SelectContent>
        </Select>
        {["all", "cold", "warm", "hot"].map(level => (
          <Button key={level} variant={filter === level ? "default" : "outline"} size="sm" onClick={() => setFilter(level)}>
            {level === "all" ? "Tous" : `${INTEREST_CFG[level].icon} ${INTEREST_CFG[level].label}`}
          </Button>
        ))}
      </div>

      {/* Memory cards */}
      {memories.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Aucune mémoire de conversation. Ajoute des contacts pour que l'AI se souvienne d'eux.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {memories.map(mem => {
            const ic = INTEREST_CFG[mem.interestLevel];
            const accountName = accounts.find(a => a.id === mem.accountId)?.displayName ?? `#${mem.accountId}`;
            let topics: string[] = [];
            try { topics = JSON.parse(mem.topics ?? "[]"); } catch { /* ignore */ }
            return (
              <Card key={mem.id} className={`border ${ic.border}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{mem.contactName ?? "Inconnu"}</p>
                      <p className="text-xs text-muted-foreground">{mem.contactUsername ? `@${mem.contactUsername}` : mem.contactPhone ?? "—"}</p>
                    </div>
                    <Badge className={`border text-xs font-mono ${ic.color} bg-transparent ${ic.border}`}>{ic.icon} {ic.label}</Badge>
                  </div>
                  {topics.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {topics.map(t => <span key={t} className="text-xs bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded"><Tag className="w-2.5 h-2.5 inline mr-0.5" />{t}</span>)}
                    </div>
                  )}
                  {mem.lastMessage && <p className="text-xs text-muted-foreground line-clamp-2 italic">"{mem.lastMessage}"</p>}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {mem.detectedLanguage && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{mem.detectedLanguage.toUpperCase()}</span>}
                    <span className="ml-auto">{accountName}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {["cold", "warm", "hot"].map(level => (
                      <Button key={level} size="sm" variant={mem.interestLevel === level ? "default" : "ghost"} className="flex-1 text-xs h-7" onClick={() => handleInterestChange(mem.id, level)}>
                        {INTEREST_CFG[level].icon}
                      </Button>
                    ))}
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMem.mutate({ id: mem.id }, { onSuccess: invalidate })}>
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
          <DialogHeader><DialogTitle>Nouveau contact mémorisé</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Compte AI</label>
              <Select value={form.accountId} onValueChange={v => setForm(f => ({ ...f, accountId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.displayName ?? a.username}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {[["Nom du contact*", "contactName", "Alex Martin"], ["@Username", "contactUsername", "@alex"], ["Téléphone", "contactPhone", "+33..."], ["Langue", "detectedLanguage", "fr"]].map(([l, k, p]) => (
              <div key={k}><label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">{l}</label><Input value={(form as Record<string, string>)[k]} placeholder={p} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
            ))}
            <div><label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Intérêt</label>
              <Select value={form.interestLevel} onValueChange={v => setForm(f => ({ ...f, interestLevel: v as "cold"|"warm"|"hot" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cold">🧊 Froid</SelectItem><SelectItem value="warm">☀️ Tiède</SelectItem><SelectItem value="hot">🔥 Chaud</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Sujets (séparés par virgule)</label><Input value={form.topics} placeholder="crypto, investissement, trading" onChange={e => setForm(f => ({ ...f, topics: e.target.value }))} /></div>
            <div className="col-span-2"><label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Notes</label><Input value={form.notes} placeholder="Détails importants..." onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createMem.isPending || !form.accountId || !form.contactName}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
