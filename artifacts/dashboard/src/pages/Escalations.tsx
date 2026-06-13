import { useState } from "react";
import { useListEscalations, useUpdateEscalation, useDeleteEscalation, useListAccounts, getListEscalationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, XCircle, Eye, Trash2, BrainCircuit, Globe } from "lucide-react";

const REASON_CFG: Record<string, { color: string; label: string; icon: string }> = {
  angry: { color: "text-red-400", label: "En colère", icon: "😡" },
  suspicious: { color: "text-orange-400", label: "Suspicieux", icon: "🤨" },
  human_needed: { color: "text-yellow-400", label: "Humain requis", icon: "🙋" },
  spam_detected: { color: "text-purple-400", label: "Spam détecté", icon: "🚫" },
  other: { color: "text-muted-foreground", label: "Autre", icon: "❓" },
};

const STATUS_CFG: Record<string, string> = {
  pending: "bg-red-500/20 text-red-400 border-red-500/30",
  reviewed: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  resolved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  ignored: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

function SentimentBar({ score }: { score: number }) {
  const pct = ((score + 1) / 2) * 100;
  const color = score < -0.3 ? "bg-red-500" : score < 0.2 ? "bg-yellow-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono ${score < 0 ? "text-red-400" : "text-emerald-400"}`}>{score.toFixed(2)}</span>
    </div>
  );
}

export default function Escalations() {
  const qc = useQueryClient();
  const { data: accounts = [] } = useListAccounts();
  const [statusFilter, setStatusFilter] = useState("pending");
  const { data: escalations = [] } = useListEscalations({ status: statusFilter });
  const updateEsc = useUpdateEscalation();
  const deleteEsc = useDeleteEscalation();
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: getListEscalationsQueryKey({ status: statusFilter }) });

  function accountName(id: number) {
    const a = accounts.find(a => a.id === id);
    return a?.displayName ?? a?.username ?? `#${id}`;
  }

  function handleResolve(id: number, status: string) {
    updateEsc.mutate({ id, data: { status: status as "pending"|"reviewed"|"resolved"|"ignored", reviewNote: reviewNote || undefined, aiPaused: status === "resolved" ? 0 : 1 } }, {
      onSuccess: () => { invalidate(); setReviewing(null); setReviewNote(""); }
    });
  }

  const pending = escalations.filter(e => e.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-3"><AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 text-red-400" />Sentiment & Escalades</h1>
          <p className="text-muted-foreground mt-1 text-sm">Contacts détectés comme irrités ou suspicieux · AI mise en pause auto</p>
        </div>
        {pending > 0 && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-sm font-mono self-start">{pending} en attente</Badge>}
      </div>

      {/* Info */}
      <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-sm">
        <p className="font-semibold text-red-400 mb-1">🧠 Analyse de sentiment en temps réel</p>
        <p className="text-red-200/80">Le moteur Python analyse chaque message reçu avec un score de sentiment (-1 très négatif → +1 très positif). Sous -0.4, la conversation est escaladée et l'AI est automatiquement mise en pause sur ce contact pour éviter d'aggraver la situation.</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["pending", "reviewed", "resolved", "ignored"].map(s => (
          <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
            {STATUS_CFG[s] && <span className={`w-2 h-2 rounded-full mr-1.5 inline-block ${s === "pending" ? "bg-red-500" : s === "reviewed" ? "bg-yellow-500" : s === "resolved" ? "bg-emerald-500" : "bg-zinc-500"}`} />}
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {/* Escalations list */}
      {escalations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20 text-emerald-400" />
          <p>Aucune escalade avec ce filtre. {statusFilter === "pending" ? "Tous les contacts semblent positifs ✓" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {escalations.map(esc => {
            const reason = REASON_CFG[esc.reason] ?? REASON_CFG.other;
            return (
              <Card key={esc.id} className={`border ${esc.status === "pending" ? "border-red-500/30" : "border-border/40"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="text-2xl">{reason.icon}</div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-semibold">{esc.contactName ?? esc.contactUsername ?? esc.contactPhone ?? "Inconnu"}</p>
                          <p className="text-xs text-muted-foreground">Compte : {accountName(esc.accountId)} · {new Date(esc.createdAt).toLocaleString("fr-FR")}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {esc.detectedLanguage && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Globe className="w-3 h-3" />{esc.detectedLanguage.toUpperCase()}</span>}
                          <Badge className={`border text-xs ${reason.color} bg-transparent border-current/30`}>{reason.label}</Badge>
                          <Badge className={`border text-xs font-mono ${STATUS_CFG[esc.status]}`}>{esc.status.toUpperCase()}</Badge>
                        </div>
                      </div>
                      <SentimentBar score={esc.sentimentScore} />
                      {esc.conversationSnippet && (
                        <div className="bg-muted/20 rounded p-2 text-xs text-muted-foreground italic border-l-2 border-red-500/30">
                          "{esc.conversationSnippet}"
                        </div>
                      )}
                      {esc.aiPaused === 1 && <p className="text-xs text-yellow-400 flex items-center gap-1"><BrainCircuit className="w-3 h-3" />AI mise en pause pour ce contact</p>}
                    </div>
                    {esc.status === "pending" && (
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => { setReviewing(esc.id); setReviewNote(""); }}>
                          <Eye className="w-3.5 h-3.5 mr-1" />Réviser
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive text-xs" onClick={() => deleteEsc.mutate({ id: esc.id }, { onSuccess: invalidate })}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review dialog */}
      <Dialog open={reviewing !== null} onOpenChange={v => !v && setReviewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Réviser l'escalade</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Note de révision (optionnel)..." rows={3} />
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" className="text-emerald-400 border-emerald-500/30" onClick={() => reviewing && handleResolve(reviewing, "resolved")}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" />Résolu
              </Button>
              <Button variant="outline" className="text-yellow-400 border-yellow-500/30" onClick={() => reviewing && handleResolve(reviewing, "reviewed")}>
                <Eye className="w-4 h-4 mr-1.5" />Révisé
              </Button>
              <Button variant="outline" className="text-zinc-400 border-zinc-500/30" onClick={() => reviewing && handleResolve(reviewing, "ignored")}>
                <XCircle className="w-4 h-4 mr-1.5" />Ignorer
              </Button>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setReviewing(null)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
