import { useState } from "react";
import { useListProxies, useCreateProxy, useUpdateProxy, useDeleteProxy, useTestProxy, useListAccounts, getListProxiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Shield, Plus, Trash2, Zap, Wifi, WifiOff, Globe, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">UNCHECKED</Badge>;
  const cfg: Record<string, string> = {
    ok: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    timeout: "bg-red-500/20 text-red-400 border-red-500/30",
    banned: "bg-red-500/20 text-red-400 border-red-500/30",
    error: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  };
  return <Badge className={`border text-xs font-mono ${cfg[status] ?? "border-zinc-600 text-zinc-400"}`}>{status.toUpperCase()}</Badge>;
}

const EMPTY_FORM = { name: "", host: "", port: "1080", type: "socks5" as "socks5"|"http"|"https", username: "", password: "", assignedAccountId: "", country: "", provider: "" };

export default function ProxyManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: proxies = [] } = useListProxies();
  const { data: accounts = [] } = useListAccounts();
  const createProxy = useCreateProxy();
  const updateProxy = useUpdateProxy();
  const deleteProxy = useDeleteProxy();
  const testProxy = useTestProxy();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [testing, setTesting] = useState<number | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListProxiesQueryKey() });

  function handleCreate() {
    if (!form.name || !form.host) return;
    createProxy.mutate({
      data: { name: form.name, host: form.host, port: Number(form.port), type: form.type, username: form.username || undefined, password: form.password || undefined, assignedAccountId: form.assignedAccountId ? Number(form.assignedAccountId) : undefined, country: form.country || undefined, provider: form.provider || undefined }
    }, { onSuccess: () => { invalidate(); setOpen(false); setForm({ ...EMPTY_FORM }); toast({ title: "Proxy ajouté ✓" }); } });
  }

  function handleTest(id: number) {
    setTesting(id);
    testProxy.mutate({ id }, {
      onSuccess: (data) => {
        invalidate();
        toast({ title: data.success ? `✓ ${data.responseTimeMs}ms` : "Échec du test", description: data.success ? "Proxy opérationnel" : (data.error ?? "Timeout"), variant: data.success ? "default" : "destructive" });
        setTesting(null);
      },
      onError: () => setTesting(null),
    });
  }

  function handleToggle(id: number, isActive: boolean) {
    updateProxy.mutate({ id, data: { isActive: !isActive } }, { onSuccess: invalidate });
  }

  const active = proxies.filter(p => p.isActive && p.lastCheckStatus === "ok").length;
  const flagged = proxies.filter(p => p.lastCheckStatus === "banned" || p.failCount > 3).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-3"><Shield className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400" /> Proxy & IP Manager</h1>
          <p className="text-muted-foreground mt-1 text-sm">Assigne un proxy SOCKS5 dédié par compte</p>
        </div>
        <Button onClick={() => setOpen(true)} className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" />Ajouter proxy</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: proxies.length, icon: Globe, color: "text-primary" },
          { label: "Opérationnels", value: active, icon: Wifi, color: "text-emerald-400" },
          { label: "Assignés", value: proxies.filter(p => p.assignedAccountId).length, icon: Shield, color: "text-violet-400" },
          { label: "Flaggés", value: flagged, icon: AlertTriangle, color: "text-red-400" },
        ].map(s => (
          <Card key={s.label} className="border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Proxy table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/50">
                <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                  {["Nom", "Hôte:Port", "Type", "Compte assigné", "Statut", "Latence", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proxies.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Aucun proxy configuré</td></tr>
                )}
                {proxies.map(proxy => {
                  const account = accounts.find(a => a.id === proxy.assignedAccountId);
                  return (
                    <tr key={proxy.id} className={`border-b border-border/20 hover:bg-muted/10 ${!proxy.isActive ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 font-medium">{proxy.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{proxy.host}:{proxy.port}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono text-xs">{proxy.type.toUpperCase()}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {account ? (account.displayName ?? account.username) : <span className="text-zinc-600">Non assigné</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={proxy.lastCheckStatus ?? null} /></td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {proxy.responseTimeMs ? `${proxy.responseTimeMs}ms` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => handleTest(proxy.id)} disabled={testing === proxy.id}>
                            <Zap className={`w-3.5 h-3.5 ${testing === proxy.id ? "animate-pulse" : ""}`} />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleToggle(proxy.id, proxy.isActive)}>
                            {proxy.isActive ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-zinc-500" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteProxy.mutate({ id: proxy.id }, { onSuccess: invalidate })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ajouter un proxy</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {[["Nom", "name", "text", "My Proxy 1"], ["Hôte", "host", "text", "1.2.3.4"], ["Port", "port", "number", "1080"], ["Pays", "country", "text", "FR"], ["Utilisateur", "username", "text", "user"], ["Mot de passe", "password", "password", "••••"], ["Fournisseur", "provider", "text", "provider.com"]].map(([label, key, type, ph]) => (
              <div key={key} className={key === "name" || key === "host" ? "col-span-2" : ""}>
                <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">{label}</label>
                <Input type={type} value={(form as Record<string, string>)[key]} placeholder={ph} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Type</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as "socks5"|"http"|"https" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="socks5">SOCKS5</SelectItem><SelectItem value="http">HTTP</SelectItem><SelectItem value="https">HTTPS</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground uppercase">Compte</label>
              <Select value={form.assignedAccountId} onValueChange={v => setForm(f => ({ ...f, assignedAccountId: v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent><SelectItem value="">Aucun</SelectItem>{accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.displayName ?? a.username}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createProxy.isPending}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
