import { useState } from "react";
import { useListAccounts } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Users, Plus, Copy, Check, Trash2, ShieldCheck, ShieldOff, KeyRound,
  RefreshCw, Bot, Mail, User, Eye, EyeOff, ExternalLink, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Portal {
  id: number;
  accountId: number;
  clientName: string;
  clientEmail: string;
  notes: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  account: { id: number; username: string; displayName: string | null; healthScore: number | null; status: string } | null;
}

async function fetchPortals(): Promise<Portal[]> {
  const r = await fetch("/api/client-portals", { credentials: "include" });
  if (!r.ok) throw new Error("Erreur chargement");
  return r.json();
}

async function createPortal(data: { accountId: number; clientName: string; clientEmail: string; password: string; notes?: string }) {
  const r = await fetch("/api/client-portals", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error ?? "Erreur création");
  return json;
}

async function patchPortal(id: number, patch: Record<string, any>) {
  const r = await fetch(`/api/client-portals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(patch) });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error ?? "Erreur mise à jour");
  return json;
}

async function deletePortal(id: number) {
  const r = await fetch(`/api/client-portals/${id}`, { method: "DELETE", credentials: "include" });
  if (!r.ok) throw new Error("Erreur suppression");
}

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function ClientsManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: accounts = [] } = useListAccounts();
  const { data: portals = [], isLoading } = useQuery({ queryKey: ["client-portals"], queryFn: fetchPortals });

  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState<Portal | null>(null);
  const [form, setForm] = useState({ accountId: "", clientName: "", clientEmail: "", password: genPassword(), notes: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [newPwd, setNewPwd] = useState("");

  const createMut = useMutation({ mutationFn: createPortal, onSuccess: () => { qc.invalidateQueries({ queryKey: ["client-portals"] }); setCreateOpen(false); setForm({ accountId: "", clientName: "", clientEmail: "", password: genPassword(), notes: "" }); toast({ title: "Portail créé ✓", description: "Les identifiants sont prêts à être partagés avec le client." }); }, onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }) });
  const patchMut = useMutation({ mutationFn: ({ id, patch }: { id: number; patch: any }) => patchPortal(id, patch), onSuccess: () => { qc.invalidateQueries({ queryKey: ["client-portals"] }); setResetOpen(null); toast({ title: "Mis à jour ✓" }); } });
  const deleteMut = useMutation({ mutationFn: deletePortal, onSuccess: () => { qc.invalidateQueries({ queryKey: ["client-portals"] }); toast({ title: "Portail supprimé" }); } });

  const loginUrl = `${window.location.origin}/`;

  const statusColor: Record<string, string> = {
    connected: "text-emerald-400", disconnected: "text-red-400", cooldown: "text-yellow-400", banned: "text-red-500",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-3"><Users className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />Gestion des Clients</h1>
          <p className="text-muted-foreground mt-1 text-sm">Crée et gère les accès portail pour chaque client</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 w-full sm:w-auto"><Plus className="w-4 h-4" />Nouveau client</Button>
      </div>

      {/* Info banner */}
      <div className="p-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 flex items-start gap-3 text-sm">
        <Bot className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-cyan-400">Comment ça marche</p>
          <p className="text-cyan-200/70 mt-0.5">Tu connects un compte Telegram pour un client → Tu crées son portail ici → Il reçoit son email + mot de passe → Il se connecte sur <span className="font-mono text-cyan-300">{loginUrl}</span> et voit uniquement son bot, ses messages et ses stats.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Portails créés", value: portals.length, color: "text-cyan-400" },
          { label: "Actifs", value: portals.filter(p => p.isActive).length, color: "text-emerald-400" },
          { label: "Désactivés", value: portals.filter(p => !p.isActive).length, color: "text-zinc-400" },
        ].map(s => (
          <Card key={s.label} className="border-border/40">
            <CardContent className="pt-4"><div className={`text-3xl font-black font-mono ${s.color}`}>{s.value}</div><p className="text-xs text-muted-foreground mt-1">{s.label}</p></CardContent>
          </Card>
        ))}
      </div>

      {/* Portals list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>
      ) : portals.length === 0 ? (
        <Card className="border-dashed border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
            <Users className="w-10 h-10 opacity-30" />
            <div className="text-center"><p className="font-medium">Aucun client pour l'instant</p><p className="text-sm">Clique sur « Nouveau client » pour créer le premier portail.</p></div>
            <Button variant="outline" onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Créer un portail</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {portals.map((p) => (
            <Card key={p.id} className={`border-border/40 ${!p.isActive ? "opacity-60" : ""}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-base font-bold text-cyan-400 shrink-0">
                      {p.clientName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{p.clientName}</span>
                        <Badge className={`text-xs border font-mono ${p.isActive ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"}`}>
                          {p.isActive ? "ACTIF" : "DÉSACTIVÉ"}
                        </Badge>
                      </div>
                      {/* Credentials */}
                      <div className="mt-2 space-y-1 font-mono text-xs bg-black/20 rounded-lg p-3 border border-white/5">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-cyan-300">{p.clientEmail}</span>
                          <CopyBtn text={p.clientEmail} />
                        </div>
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">{loginUrl}</span>
                          <CopyBtn text={loginUrl} />
                        </div>
                        {p.notes && <div className="text-zinc-500 text-xs mt-1 font-sans italic">{p.notes}</div>}
                      </div>
                      {/* Account + last login */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        {p.account && (
                          <span className="flex items-center gap-1">
                            <Bot className="w-3 h-3" />
                            <span className={statusColor[p.account.status] ?? "text-zinc-400"}>@{p.account.username}</span>
                            {p.account.healthScore !== null && <span className="text-zinc-500">· {p.account.healthScore}/100</span>}
                          </span>
                        )}
                        {p.lastLoginAt ? (
                          <span>Dernière connexion : {new Date(p.lastLoginAt).toLocaleDateString("fr-FR")}</span>
                        ) : (
                          <span className="text-zinc-600">Jamais connecté</span>
                        )}
                        <span className="text-zinc-600">Créé le {new Date(p.createdAt).toLocaleDateString("fr-FR")}</span>
                      </div>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => { setResetOpen(p); setNewPwd(genPassword()); }} className="gap-1.5 text-xs">
                      <KeyRound className="w-3.5 h-3.5" />Changer MDP
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => patchMut.mutate({ id: p.id, patch: { isActive: !p.isActive } })} className={`gap-1.5 text-xs ${p.isActive ? "hover:text-yellow-400" : "hover:text-emerald-400"}`}>
                      {p.isActive ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      {p.isActive ? "Désactiver" : "Activer"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Supprimer le portail de ${p.clientName} ?`)) deleteMut.mutate(p.id); }} className="hover:text-red-400 text-xs">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4 text-primary" />Créer un portail client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Compte Telegram à associer</label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={form.accountId}
                onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
              >
                <option value="">— Sélectionne un compte —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>@{a.username}{a.displayName ? ` (${a.displayName})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nom du client</label>
              <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="John Doe" className="pl-9" /></div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email du client</label>
              <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input type="email" value={form.clientEmail} onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))} placeholder="client@exemple.com" className="pl-9" /></div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mot de passe</label>
                <button type="button" onClick={() => setForm(f => ({ ...f, password: genPassword() }))} className="text-xs text-primary hover:underline">Générer</button>
              </div>
              <div className="relative">
                <Input type={showPwd ? "text" : "password"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="font-mono pr-20" />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button type="button" onClick={() => setShowPwd(s => !s)} className="text-muted-foreground hover:text-foreground p-1">{showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  <CopyBtn text={form.password} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">⚠️ Copie ce mot de passe maintenant — il ne sera plus affiché.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes internes (optionnel)</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ex : Client payé — pack Pro" />
            </div>
            {/* Credentials preview */}
            {form.clientEmail && form.clientName && (
              <div className="p-3 rounded-lg bg-muted/20 border border-border/40 text-xs font-mono space-y-1">
                <p className="text-muted-foreground font-sans text-xs mb-2 font-semibold">À envoyer au client :</p>
                <p>🌐 URL : <span className="text-cyan-400">{loginUrl}</span></p>
                <p>📧 Email : <span className="text-foreground">{form.clientEmail}</span></p>
                <p>🔑 Mot de passe : <span className="text-foreground">{form.password}</span></p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={() => createMut.mutate({ accountId: Number(form.accountId), clientName: form.clientName, clientEmail: form.clientEmail, password: form.password, notes: form.notes || undefined })} disabled={createMut.isPending || !form.accountId || !form.clientName || !form.clientEmail || !form.password}>
              {createMut.isPending ? "Création..." : "Créer le portail"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetOpen} onOpenChange={() => setResetOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4" />Nouveau mot de passe</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Client : <span className="font-semibold text-foreground">{resetOpen?.clientName}</span></p>
            <div className="relative">
              <Input type={showPwd ? "text" : "password"} value={newPwd} onChange={e => setNewPwd(e.target.value)} className="font-mono pr-16" />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button type="button" onClick={() => setShowPwd(s => !s)} className="text-muted-foreground hover:text-foreground p-1">{showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                <CopyBtn text={newPwd} />
              </div>
            </div>
            <button type="button" onClick={() => setNewPwd(genPassword())} className="text-xs text-primary hover:underline">Générer un mot de passe aléatoire</button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(null)}>Annuler</Button>
            <Button onClick={() => resetOpen && patchMut.mutate({ id: resetOpen.id, patch: { password: newPwd } })} disabled={patchMut.isPending || !newPwd}>
              {patchMut.isPending ? "Mise à jour..." : "Mettre à jour"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
