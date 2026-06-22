import { useState } from "react";
import { useListAccounts, useGetAccountsStats, useConnectAccount, useCreateAccount, useDisconnectAccount } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, ShieldAlert, Wifi, WifiOff, Activity, Loader2, Link, Unlink, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type ConnectStep = "idle" | "phone" | "otp" | "twofa" | "done";

interface ConnectState {
  accountId: number | null;
  phoneNumber: string;
  step: ConnectStep;
  loading: boolean;
  error: string;
}

export default function Accounts() {
  const { data: accounts, isLoading } = useListAccounts();
  const { data: stats } = useGetAccountsStats();
  const queryClient = useQueryClient();

  const connectMutation = useConnectAccount();
  const disconnectMutation = useDisconnectAccount();
  const createMutation = useCreateAccount();

  // New account modal
  const [showNew, setShowNew] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState("");

  // OTP connect flow
  const [cs, setCs] = useState<ConnectState>({
    accountId: null,
    phoneNumber: "",
    step: "idle",
    loading: false,
    error: "",
  });
  const [otpCode, setOtpCode] = useState("");
  const [tfaPassword, setTfaPassword] = useState("");

  function refreshAccounts() {
    queryClient.invalidateQueries({ queryKey: ["listAccounts"] });
    queryClient.invalidateQueries({ queryKey: ["getAccountsStats"] });
  }

  // ── Create new account ──────────────────────────────────────────────────────
  async function handleCreateAccount() {
    if (!newPhone.trim()) { toast.error("Numéro de téléphone requis"); return; }
    try {
      await createMutation.mutateAsync({ data: { phoneNumber: newPhone.trim(), displayName: newLabel.trim() || undefined } });
      toast.success("Compte créé");
      setShowNew(false);
      setNewPhone("");
      setNewLabel("");
      refreshAccounts();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur création");
    }
  }

  // ── Step 1: request OTP ─────────────────────────────────────────────────────
  async function handleRequestCode(accountId: number, phoneNumber: string) {
    setCs({ accountId, phoneNumber, step: "phone", loading: true, error: "" });
    setOtpCode("");
    setTfaPassword("");
    try {
      const res = await connectMutation.mutateAsync({
        id: accountId,
        data: { action: "request_code" } as any,
      });
      if ((res as any).needsCode) {
        setCs((s) => ({ ...s, step: "otp", loading: false }));
        toast.success("Code OTP envoyé sur votre Telegram !");
      } else if ((res as any).success) {
        setCs((s) => ({ ...s, step: "done", loading: false }));
        toast.success("Compte déjà connecté !");
        refreshAccounts();
      } else {
        setCs((s) => ({ ...s, step: "idle", loading: false, error: (res as any).message ?? "Erreur" }));
        toast.error((res as any).message ?? "Erreur lors de l'envoi du code");
      }
    } catch (e: any) {
      const msg = e?.message ?? "Erreur réseau";
      setCs((s) => ({ ...s, step: "idle", loading: false, error: msg }));
      toast.error(msg);
    }
  }

  // ── Step 2: verify OTP ──────────────────────────────────────────────────────
  async function handleVerifyCode() {
    if (!otpCode.trim()) { toast.error("Entrez le code OTP"); return; }
    setCs((s) => ({ ...s, loading: true, error: "" }));
    try {
      const res = await connectMutation.mutateAsync({
        id: cs.accountId as number,
        data: { action: "verify_code", code: otpCode.trim() } as any,
      });
      if ((res as any).needs2FA) {
        setCs((s) => ({ ...s, step: "twofa", loading: false }));
        toast.info("Mot de passe 2FA requis");
      } else if ((res as any).success) {
        setCs((s) => ({ ...s, step: "done", loading: false }));
        toast.success(`Compte connecté ! ${(res as any).username ? `@${(res as any).username}` : ""}`);
        refreshAccounts();
      } else {
        setCs((s) => ({ ...s, loading: false, error: (res as any).message ?? "Code invalide" }));
        toast.error((res as any).message ?? "Code invalide");
      }
    } catch (e: any) {
      const msg = e?.message ?? "Erreur vérification";
      setCs((s) => ({ ...s, loading: false, error: msg }));
      toast.error(msg);
    }
  }

  // ── Step 3: verify 2FA ──────────────────────────────────────────────────────
  async function handleVerify2FA() {
    if (!tfaPassword.trim()) { toast.error("Entrez le mot de passe 2FA"); return; }
    setCs((s) => ({ ...s, loading: true, error: "" }));
    try {
      const res = await connectMutation.mutateAsync({
        id: cs.accountId as number,
        data: { action: "verify_2fa", password: tfaPassword } as any,
      });
      if ((res as any).success) {
        setCs((s) => ({ ...s, step: "done", loading: false }));
        toast.success(`Compte connecté via 2FA ! ${(res as any).username ? `@${(res as any).username}` : ""}`);
        refreshAccounts();
      } else {
        setCs((s) => ({ ...s, loading: false, error: (res as any).message ?? "2FA invalide" }));
        toast.error((res as any).message ?? "Mot de passe 2FA invalide");
      }
    } catch (e: any) {
      const msg = e?.message ?? "Erreur 2FA";
      setCs((s) => ({ ...s, loading: false, error: msg }));
      toast.error(msg);
    }
  }

  async function handleDisconnect(accountId: number) {
    try {
      await disconnectMutation.mutateAsync({ id: accountId });
      toast.success("Compte déconnecté");
      refreshAccounts();
    } catch {
      toast.error("Erreur déconnexion");
    }
  }

  const connectDialogOpen = cs.step !== "idle" && cs.step !== "done";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Agent Accounts</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshAccounts}>
            <RefreshCw className="w-4 h-4 mr-2" /> Rafraîchir
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nouveau Compte
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Comptes", value: stats?.total ?? 0, color: "" },
          { label: "Connectés", value: stats?.connected ?? 0, color: "text-primary" },
          { label: "Cooldown/Bannis", value: (stats?.cooldown ?? 0) + (stats?.banned ?? 0), color: "text-destructive" },
          { label: "Santé Moyenne", value: `${stats?.avgHealthScore ?? 0}/100`, color: "text-accent" },
        ].map((s) => (
          <Card key={s.label} className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle>Fleet Manifest</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50 overflow-x-auto">
            <Table className="min-w-[650px]">
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Santé</TableHead>
                  <TableHead>Connexion</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</TableCell>
                  </TableRow>
                ) : accounts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Aucun compte. Cliquez sur "Nouveau Compte" pour commencer.
                    </TableCell>
                  </TableRow>
                ) : accounts?.map((account) => (
                  <TableRow key={account.id} className="border-border/50">
                    <TableCell>
                      <div className="font-mono text-sm">{account.phoneNumber}</div>
                      <div className="text-xs text-muted-foreground">{account.username ? `@${account.username}` : "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={account.status === "active" ? "default" : account.status === "banned" ? "destructive" : "secondary"}
                        className="uppercase font-mono text-[10px]"
                      >
                        {account.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Activity className={`w-4 h-4 ${(account.healthScore ?? 0) > 80 ? "text-primary" : (account.healthScore ?? 0) > 50 ? "text-accent" : "text-destructive"}`} />
                        <span className="font-mono text-sm">{account.healthScore ?? 0}/100</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {account.isConnected ? (
                        <div className="flex items-center gap-1 text-primary text-xs font-mono">
                          <Wifi className="w-3 h-3" /> ONLINE
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground text-xs font-mono">
                          <WifiOff className="w-3 h-3" /> OFFLINE
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {format(new Date(account.createdAt), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {account.isConnected ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs font-mono text-destructive border-destructive/50 hover:bg-destructive/10"
                            onClick={() => handleDisconnect(account.id)}
                            disabled={disconnectMutation.isPending}
                          >
                            <Unlink className="w-3 h-3 mr-1" /> DÉCONNECTER
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs font-mono text-primary border-primary/50 hover:bg-primary/10"
                            onClick={() => handleRequestCode(account.id, account.phoneNumber)}
                            disabled={cs.loading}
                          >
                            <Link className="w-3 h-3 mr-1" /> CONNECTER
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Modal: Nouveau compte ─────────────────────────────────────────── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un compte Telegram</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Numéro de téléphone (format international)</Label>
              <Input
                placeholder="+33612345678"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label>Libellé (optionnel)</Label>
              <Input
                placeholder="Ex: Compte principal"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleCreateAccount} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Créer le compte
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Flux OTP ───────────────────────────────────────────────── */}
      <Dialog open={connectDialogOpen} onOpenChange={(open) => { if (!open) setCs((s) => ({ ...s, step: "idle" })); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {cs.step === "phone" && "Envoi du code…"}
              {cs.step === "otp" && "Vérification OTP"}
              {cs.step === "twofa" && "Authentification 2FA"}
            </DialogTitle>
          </DialogHeader>

          {/* Step: sending code */}
          {cs.step === "phone" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm text-center">Envoi du code OTP à <span className="font-mono text-foreground">{cs.phoneNumber}</span>…</p>
            </div>
          )}

          {/* Step: enter OTP */}
          {cs.step === "otp" && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Un code de connexion a été envoyé sur votre application Telegram pour le numéro{" "}
                <span className="font-mono text-foreground">{cs.phoneNumber}</span>.
                Entrez-le ci-dessous.
              </p>
              <div className="space-y-1">
                <Label>Code OTP Telegram</Label>
                <Input
                  placeholder="12345"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="font-mono text-center text-lg tracking-widest"
                  maxLength={6}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                />
              </div>
              {cs.error && <p className="text-destructive text-xs">{cs.error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => handleRequestCode(cs.accountId!, cs.phoneNumber)}>
                  Renvoyer le code
                </Button>
                <Button className="flex-1" onClick={handleVerifyCode} disabled={cs.loading || otpCode.length < 4}>
                  {cs.loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Vérifier
                </Button>
              </div>
            </div>
          )}

          {/* Step: 2FA */}
          {cs.step === "twofa" && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Ce compte a la vérification en deux étapes activée. Entrez votre mot de passe Telegram.
              </p>
              <div className="space-y-1">
                <Label>Mot de passe 2FA</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={tfaPassword}
                  onChange={(e) => setTfaPassword(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleVerify2FA()}
                />
              </div>
              {cs.error && <p className="text-destructive text-xs">{cs.error}</p>}
              <Button className="w-full" onClick={handleVerify2FA} disabled={cs.loading || !tfaPassword}>
                {cs.loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Confirmer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
