import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Hash, MessageCircle, Settings2, Clock, Zap, Globe, Brain,
  Users, BarChart2, RefreshCw, CheckCircle2, Play, Pause,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SCHEDULE_PRESETS = [
  { value: "30min", label: "30 minutes" },
  { value: "1h",    label: "1 heure" },
  { value: "2h",    label: "2 heures" },
  { value: "4h",    label: "4 heures" },
  { value: "8h",    label: "8 heures" },
  { value: "daily", label: "1 fois/jour" },
  { value: "weekly", label: "1 fois/semaine" },
];

const CONTENT_TYPES = [
  { value: "market_summary",       label: "Résumé marché" },
  { value: "analysis",             label: "Analyse" },
  { value: "educational",          label: "Éducatif" },
  { value: "motivation",           label: "Motivation" },
  { value: "anecdote",             label: "Anecdote" },
  { value: "engagement_question",  label: "Question d'engagement" },
  { value: "news",                 label: "Actualité" },
  { value: "report",               label: "Rapport" },
];

const COMMUNITY_TYPE_LABELS: Record<string, string> = {
  crypto: "Crypto & Blockchain", finance: "Finance & Économie",
  business: "Business", marketing: "Marketing", politics: "Politique",
  technology: "Technologie", ai: "Intelligence Artificielle",
  education: "Éducation", health: "Santé", sports: "Sports",
  entertainment: "Divertissement", religion: "Religion",
  realestate: "Immobilier", ecommerce: "E-commerce",
  investment: "Investissement", startups: "Startups",
  gaming: "Gaming", science: "Science", news: "Actualités",
  lifestyle: "Lifestyle", motivational: "Motivation", community: "Communauté",
};

const TONES = ["casual", "professional", "friendly", "authoritative", "inspirational", "humorous"];
const LANGUAGES = [
  { value: "fr", label: "Français" }, { value: "en", label: "English" },
  { value: "ar", label: "العربية" }, { value: "es", label: "Español" },
];

async function fetchCommunities() {
  const res = await fetch("/api/communities");
  if (!res.ok) throw new Error("Erreur communities");
  return res.json();
}

async function saveSchedule(chatType: string, tgId: string, config: any) {
  const res = await fetch(`/api/communities/${chatType}/${tgId}/schedule`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return res.json();
}

function CommunityTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    crypto: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    finance: "bg-green-500/10 text-green-400 border-green-500/20",
    technology: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ai: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    politics: "bg-red-500/10 text-red-400 border-red-500/20",
    marketing: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    education: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    religion: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    business: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    community: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };
  const cls = colors[type] ?? colors.community;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>
      {COMMUNITY_TYPE_LABELS[type] ?? type}
    </span>
  );
}

function ConfigModal({
  community,
  chatType,
  onClose,
}: {
  community: any;
  chatType: "group" | "channel";
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    interval_preset:  community.schedule?.interval_preset ?? "4h",
    enabled:          community.schedule?.enabled ?? true,
    post_with_image:  community.schedule?.post_with_image ?? true,
    post_with_video:  community.schedule?.post_with_video ?? false,
    content_rotation: community.schedule?.content_rotation ?? CONTENT_TYPES.map((c) => c.value),
    custom_instructions: community.schedule?.custom_instructions ?? "",
    language:         community.schedule?.language ?? community.language ?? "fr",
  });

  const mut = useMutation({
    mutationFn: () => saveSchedule(chatType, community.telegram_id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communities"] });
      toast({ title: "Sauvegardé ✓", description: "Configuration mise à jour" });
      onClose();
    },
    onError: () => toast({ title: "Erreur", variant: "destructive", description: "Impossible de sauvegarder" }),
  });

  const toggleContentType = (val: string) => {
    setForm((f) => ({
      ...f,
      content_rotation: f.content_rotation.includes(val)
        ? f.content_rotation.filter((x: string) => x !== val)
        : [...f.content_rotation, val],
    }));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            {community.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2 max-h-[60vh] overflow-y-auto pr-1">
          {/* Info strip */}
          <div className="flex flex-wrap gap-2">
            <CommunityTypeBadge type={community.community_type} />
            {community.mission && (
              <p className="text-xs text-muted-foreground italic w-full">{community.mission.slice(0, 100)}</p>
            )}
          </div>

          {/* Enable toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
            <div>
              <Label className="text-sm font-medium">Activer auto-post</Label>
              <p className="text-xs text-muted-foreground">Le moteur publie automatiquement</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
          </div>

          {/* Schedule preset */}
          <div className="space-y-2">
            <Label className="text-sm">Fréquence de publication</Label>
            <Select value={form.interval_preset} onValueChange={(v) => setForm((f) => ({ ...f, interval_preset: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <Label className="text-sm">Langue principale</Label>
            <Select value={form.language} onValueChange={(v) => setForm((f) => ({ ...f, language: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Media */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
              <Label className="text-sm">Avec images</Label>
              <Switch checked={form.post_with_image} onCheckedChange={(v) => setForm((f) => ({ ...f, post_with_image: v }))} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
              <Label className="text-sm">Avec vidéos</Label>
              <Switch checked={form.post_with_video} onCheckedChange={(v) => setForm((f) => ({ ...f, post_with_video: v }))} />
            </div>
          </div>

          {/* Content rotation */}
          <div className="space-y-2">
            <Label className="text-sm">Types de contenu (rotation)</Label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map((ct) => {
                const active = form.content_rotation.includes(ct.value);
                return (
                  <button
                    key={ct.value}
                    onClick={() => toggleContentType(ct.value)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      active
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "bg-muted/20 text-muted-foreground border-border/40 hover:border-border"
                    }`}
                  >
                    {ct.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{form.content_rotation.length} type(s) sélectionné(s) — alternés à chaque post</p>
          </div>

          {/* Custom instructions */}
          <div className="space-y-2">
            <Label className="text-sm">Instructions personnalisées (optionnel)</Label>
            <Input
              placeholder="Ex: Toujours mentionner notre site web..."
              value={form.custom_instructions}
              onChange={(e) => setForm((f) => ({ ...f, custom_instructions: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommunityCard({ item, chatType }: { item: any; chatType: "group" | "channel" }) {
  const [open, setOpen] = useState(false);
  const schedule = item.schedule ?? {};
  const enabled  = schedule.enabled ?? true;
  const preset   = schedule.interval_preset ?? "4h";

  return (
    <>
      <Card className={`bg-card/50 border transition-colors ${enabled ? "border-border/50 hover:border-primary/30" : "border-border/30 opacity-60"}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              {chatType === "channel" ? (
                <Hash className="w-4 h-4 text-primary" />
              ) : (
                <MessageCircle className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">{item.title}</span>
                {!enabled && <Badge variant="secondary" className="text-[10px] py-0">Pausé</Badge>}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <CommunityTypeBadge type={item.community_type} />
              </div>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => setOpen(true)}>
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{SCHEDULE_PRESETS.find((p) => p.value === preset)?.label ?? preset}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Globe className="w-3 h-3" />
              <span>{schedule.language ?? item.language ?? "fr"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Brain className="w-3 h-3" />
              <span>{item.tone ?? "casual"}</span>
            </div>
          </div>

          {item.mission && (
            <p className="mt-2 text-xs text-muted-foreground italic line-clamp-1">{item.mission}</p>
          )}

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {chatType === "channel" ? (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />{(item.subscribers ?? 0).toLocaleString()} abonnés
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />{(item.members ?? 0).toLocaleString()} membres
                </span>
              )}
              {item.total_posts > 0 && (
                <span className="flex items-center gap-1">
                  <BarChart2 className="w-3 h-3" />{item.total_posts} posts
                </span>
              )}
            </div>
            {enabled ? (
              <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Actif
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Pause className="w-3 h-3" />
                Pausé
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {open && (
        <ConfigModal community={item} chatType={chatType} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

export default function CommunityManager() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["communities"],
    queryFn: fetchCommunities,
    refetchInterval: 30_000,
  });

  const [tab, setTab] = useState("channels");

  const groups   = data?.groups   ?? [];
  const channels = data?.channels ?? [];
  const totalActive = [
    ...channels.filter((c: any) => c.schedule?.enabled !== false),
    ...groups.filter((g: any) => g.schedule?.enabled !== false),
  ].length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Gestionnaire de Communautés</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure le planificateur et le type de contenu par communauté
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total groupes",   value: groups.length,   icon: MessageCircle, color: "text-blue-400" },
          { label: "Total canaux",    value: channels.length, icon: Hash,          color: "text-cyan-400" },
          { label: "Actifs",          value: totalActive,     icon: Play,          color: "text-emerald-400" },
          { label: "Types détectés",  value: new Set([...groups, ...channels].map((c: any) => c.community_type)).size, icon: Brain, color: "text-violet-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card/50 border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color} shrink-0`} />
              <div>
                <p className="text-lg font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs: Channels / Groups */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="channels" className="gap-2">
            <Hash className="w-3.5 h-3.5" />
            Canaux ({channels.length})
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-2">
            <MessageCircle className="w-3.5 h-3.5" />
            Groupes ({groups.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 rounded-xl bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-16">
              <Hash className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Aucun canal enregistré</p>
              <p className="text-xs text-muted-foreground mt-1">Connectez un compte Telegram — les canaux seront détectés automatiquement</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {channels.map((c: any) => (
                <CommunityCard key={c.telegram_id} item={c} chatType="channel" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="groups" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 rounded-xl bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-16">
              <MessageCircle className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Aucun groupe enregistré</p>
              <p className="text-xs text-muted-foreground mt-1">Rejoignez des groupes depuis un compte connecté pour les voir ici</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((g: any) => (
                <CommunityCard key={g.telegram_id} item={g} chatType="group" />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
