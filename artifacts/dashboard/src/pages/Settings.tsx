import { useState } from "react";
import { useListSettings, useUpsertSettings, getListSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Eye, EyeOff, Save, RefreshCw, CheckCircle2, KeyRound,
  Bot, Cpu, Database, ShieldCheck, Webhook, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SETTING_GROUPS: {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  fields: { key: string; label: string; description: string; isSecret: boolean; placeholder: string }[];
}[] = [
  {
    id: "telegram",
    label: "Telegram API",
    icon: Bot,
    color: "text-sky-400",
    fields: [
      {
        key: "TELEGRAM_API_ID",
        label: "API ID",
        description: "Obtenu sur my.telegram.org → API development tools",
        isSecret: false,
        placeholder: "12345678",
      },
      {
        key: "TELEGRAM_API_HASH",
        label: "API Hash",
        description: "Clé secrète associée à ton App Telegram",
        isSecret: true,
        placeholder: "abc123def456...",
      },
      {
        key: "TELEGRAM_SESSION_STRING",
        label: "Session String (optionnel)",
        description: "Session Telethon pré-générée pour éviter le re-login OTP",
        isSecret: true,
        placeholder: "1BQANOTEuAm3...",
      },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    icon: Cpu,
    color: "text-emerald-400",
    fields: [
      {
        key: "OPENAI_API_KEY",
        label: "API Key",
        description: "Clé OpenAI — utilisée pour GPT-4o (génération principale)",
        isSecret: true,
        placeholder: "sk-proj-...",
      },
      {
        key: "OPENAI_MODEL",
        label: "Modèle",
        description: "Modèle GPT à utiliser (défaut : gpt-4o)",
        isSecret: false,
        placeholder: "gpt-4o",
      },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    icon: Cpu,
    color: "text-violet-400",
    fields: [
      {
        key: "GEMINI_API_KEY",
        label: "API Key",
        description: "Clé Google AI Studio — fallback si OpenAI échoue",
        isSecret: true,
        placeholder: "AIzaSy...",
      },
      {
        key: "GEMINI_MODEL",
        label: "Modèle",
        description: "Modèle Gemini à utiliser (défaut : gemini-1.5-pro)",
        isSecret: false,
        placeholder: "gemini-1.5-pro",
      },
    ],
  },
  {
    id: "database",
    label: "Base de données",
    icon: Database,
    color: "text-orange-400",
    fields: [
      {
        key: "DATABASE_URL",
        label: "Connection String",
        description: "PostgreSQL — format : postgresql://user:pass@host:5432/db",
        isSecret: true,
        placeholder: "postgresql://...",
      },
    ],
  },
  {
    id: "security",
    label: "Sécurité & Sessions",
    icon: ShieldCheck,
    color: "text-rose-400",
    fields: [
      {
        key: "SESSION_SECRET",
        label: "Session Secret",
        description: "Clé de chiffrement des sessions Express (min. 32 caractères)",
        isSecret: true,
        placeholder: "super-secret-key-32-chars-min...",
      },
    ],
  },
  {
    id: "webhook",
    label: "Webhooks & Alertes",
    icon: Webhook,
    color: "text-yellow-400",
    fields: [
      {
        key: "WEBHOOK_URL",
        label: "Webhook URL",
        description: "URL appelée lors d'événements critiques (ban, erreur)",
        isSecret: false,
        placeholder: "https://hooks.zapier.com/...",
      },
      {
        key: "ALERT_EMAIL",
        label: "Email d'alerte",
        description: "Email de notification pour les alertes de sécurité",
        isSecret: false,
        placeholder: "admin@example.com",
      },
    ],
  },
];

function SecretInput({
  value,
  onChange,
  placeholder,
  isSecret,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  isSecret: boolean;
}) {
  const [show, setShow] = useState(false);
  if (!isSecret) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-sm"
      />
    );
  }
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-sm pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function StatusDot({ configured }: { configured: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${
        configured ? "bg-emerald-500" : "bg-zinc-600"
      }`}
    />
  );
}

export default function Settings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: settings = [], isLoading } = useListSettings();
  const upsert = useUpsertSettings();

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  function currentValue(key: string): string {
    if (key in edits) return edits[key];
    const s = settings.find((s) => s.key === key);
    return s?.value ?? "";
  }

  function isConfigured(key: string): boolean {
    const val = currentValue(key);
    return val.length > 0 && !val.includes("••");
  }

  function isMasked(key: string): boolean {
    const s = settings.find((s) => s.key === key);
    return !!(s?.value?.includes("••"));
  }

  function handleChange(key: string, value: string) {
    setEdits((e) => ({ ...e, [key]: value }));
    setSaved((s) => ({ ...s, [key]: false }));
  }

  function buildPayload(keys: string[], fields: typeof SETTING_GROUPS[0]["fields"]) {
    return keys
      .filter((k) => k in edits && edits[k] !== "")
      .map((k) => {
        const f = fields.find((f) => f.key === k)!;
        return { key: k, value: edits[k], isSecret: f.isSecret, description: f.description };
      });
  }

  function handleSaveGroup(groupId: string) {
    const group = SETTING_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    const toSave = buildPayload(
      group.fields.map((f) => f.key),
      group.fields
    );
    if (toSave.length === 0) {
      toast({ title: "Rien à sauvegarder", description: "Modifie au moins un champ." });
      return;
    }
    upsert.mutate(
      { data: { settings: toSave } },
      {
        onSuccess: () => {
          const m: Record<string, boolean> = {};
          toSave.forEach((s) => (m[s.key] = true));
          setSaved((p) => ({ ...p, ...m }));
          qc.invalidateQueries({ queryKey: getListSettingsQueryKey() });
          toast({ title: "Sauvegardé ✓", description: `${toSave.length} paramètre(s) mis à jour.` });
        },
      }
    );
  }

  function handleSaveAll() {
    const allFields = SETTING_GROUPS.flatMap((g) => g.fields);
    const toSave = buildPayload(
      allFields.map((f) => f.key),
      allFields
    );
    if (toSave.length === 0) {
      toast({ title: "Rien à sauvegarder", description: "Modifie au moins un champ." });
      return;
    }
    upsert.mutate(
      { data: { settings: toSave } },
      {
        onSuccess: () => {
          const m: Record<string, boolean> = {};
          toSave.forEach((s) => (m[s.key] = true));
          setSaved((p) => ({ ...p, ...m }));
          qc.invalidateQueries({ queryKey: getListSettingsQueryKey() });
          toast({ title: "Tout sauvegardé ✓", description: `${toSave.length} paramètre(s) mis à jour.` });
        },
      }
    );
  }

  function groupStatus(group: (typeof SETTING_GROUPS)[0]) {
    const configured = group.fields.filter((f) => {
      const s = settings.find((s) => s.key === f.key);
      return s?.value && s.value.length > 0;
    }).length;
    return { configured, total: group.fields.length };
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const telegramConfigured =
    !!settings.find((s) => s.key === "TELEGRAM_API_ID" && s.value) &&
    !!settings.find((s) => s.key === "TELEGRAM_API_HASH" && s.value);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <KeyRound className="w-7 h-7 text-primary" />
            Secrets & Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Tous les tokens API et clés nécessaires au fonctionnement du système
          </p>
        </div>
        <Button onClick={handleSaveAll} disabled={upsert.isPending} data-testid="btn-save-all">
          <Save className="w-4 h-4 mr-2" />
          {upsert.isPending ? "Sauvegarde..." : "Tout sauvegarder"}
        </Button>
      </div>

      {/* Status overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {SETTING_GROUPS.map((g) => {
          const { configured, total } = groupStatus(g);
          const Icon = g.icon;
          const allOk = configured === total;
          return (
            <div
              key={g.id}
              className={`p-3 rounded-lg border flex flex-col gap-1 ${
                allOk
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-border/40 bg-muted/20"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${allOk ? "text-emerald-400" : g.color}`} />
                <span className="text-xs font-medium truncate">{g.label}</span>
              </div>
              <span
                className={`text-lg font-bold font-mono ${
                  allOk ? "text-emerald-400" : "text-muted-foreground"
                }`}
              >
                {configured}/{total}
              </span>
            </div>
          );
        })}
      </div>

      {/* Telegram warning */}
      {!telegramConfigured && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
          <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-yellow-400">Telegram API non configuré</p>
            <p className="text-sm text-yellow-200/80 mt-0.5">
              Sans <span className="font-mono text-xs text-yellow-300">TELEGRAM_API_ID</span> et{" "}
              <span className="font-mono text-xs text-yellow-300">TELEGRAM_API_HASH</span>, le
              moteur Python ne peut pas se connecter aux comptes Telegram. Obtiens-les sur{" "}
              <span className="font-mono text-yellow-300">my.telegram.org</span> → API development
              tools.
            </p>
          </div>
        </div>
      )}

      {/* Setting groups */}
      <div className="space-y-4">
        {SETTING_GROUPS.map((group) => {
          const Icon = group.icon;
          const { configured, total } = groupStatus(group);
          const hasEdits = group.fields.some((f) => f.key in edits && edits[f.key] !== "");

          return (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${group.color}`} />
                    <div>
                      <CardTitle className="text-base">{group.label}</CardTitle>
                      <CardDescription>
                        {configured}/{total} clé{total > 1 ? "s" : ""} configurée
                        {total > 1 ? "s" : ""}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={hasEdits ? "default" : "outline"}
                    onClick={() => handleSaveGroup(group.id)}
                    disabled={upsert.isPending || !hasEdits}
                    data-testid={`btn-save-${group.id}`}
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Sauvegarder
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.fields.map((field, i) => {
                  const ok = isConfigured(field.key);
                  const masked = isMasked(field.key);
                  const wasSaved = saved[field.key];
                  return (
                    <div key={field.key}>
                      {i > 0 && <Separator className="mb-4" />}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusDot configured={ok || masked} />
                          <label className="text-sm font-medium">{field.label}</label>
                          {field.isSecret && (
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0 font-mono border-violet-500/40 text-violet-400"
                            >
                              SECRET
                            </Badge>
                          )}
                          {wasSaved && (
                            <span className="flex items-center gap-1 text-xs text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" /> Sauvegardé
                            </span>
                          )}
                          {masked && !wasSaved && (
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0 border-zinc-600 text-zinc-400"
                            >
                              MASQUÉ
                            </Badge>
                          )}
                        </div>
                        <SecretInput
                          value={currentValue(field.key)}
                          onChange={(v) => handleChange(field.key, v)}
                          placeholder={field.placeholder}
                          isSecret={field.isSecret}
                        />
                        <p className="text-xs text-muted-foreground">{field.description}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* How it works */}
      <Card className="border-border/40 bg-muted/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Comment ça fonctionne
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <p className="text-foreground font-medium mb-1">🔒 Stockage sécurisé</p>
              <p>
                Les valeurs{" "}
                <span className="font-mono text-xs bg-violet-500/10 text-violet-400 px-1 rounded">
                  SECRET
                </span>{" "}
                sont masquées après sauvegarde — seuls les 4 premiers et 4 derniers caractères
                restent visibles. Les valeurs brutes ne transitent jamais dans les logs.
              </p>
            </div>
            <div>
              <p className="text-foreground font-medium mb-1">⚙️ Utilisation par le système</p>
              <p>
                Le moteur Python lit{" "}
                <span className="font-mono text-xs">TELEGRAM_API_ID</span> +{" "}
                <span className="font-mono text-xs">API_HASH</span> au démarrage. L'API Node.js
                utilise <span className="font-mono text-xs">OPENAI_API_KEY</span> pour la
                génération AI.
              </p>
            </div>
            <div>
              <p className="text-foreground font-medium mb-1">📡 Où obtenir les tokens</p>
              <ul className="space-y-1 mt-1">
                <li>
                  Telegram :{" "}
                  <span className="font-mono text-xs text-sky-400">my.telegram.org</span>
                </li>
                <li>
                  OpenAI :{" "}
                  <span className="font-mono text-xs text-emerald-400">
                    platform.openai.com/api-keys
                  </span>
                </li>
                <li>
                  Gemini :{" "}
                  <span className="font-mono text-xs text-violet-400">aistudio.google.com</span>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-foreground font-medium mb-1">🔄 Application des changements</p>
              <p>
                Les paramètres sont lus par le moteur Python au prochain démarrage. Pour{" "}
                <span className="font-mono text-xs">DATABASE_URL</span> et{" "}
                <span className="font-mono text-xs">SESSION_SECRET</span>, un redémarrage complet
                du serveur est requis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
