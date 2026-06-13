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
  ExternalLink, Terminal, Zap, BrainCircuit, Globe, Phone,
  ArrowRight, BookOpen, Server, Lock, Layers, ChevronDown, ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Configuration groups ─────────────────────────────────────────────────────

const SETTING_GROUPS: {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  priority: "required" | "recommended" | "optional";
  description: string;
  fields: { key: string; label: string; description: string; isSecret: boolean; placeholder: string; howTo?: string }[];
}[] = [
  {
    id: "telegram",
    label: "Telegram API",
    icon: Bot,
    color: "text-sky-400",
    priority: "required",
    description: "Obligatoire pour connecter des comptes Telegram réels via Telethon",
    fields: [
      {
        key: "TELEGRAM_API_ID",
        label: "API ID",
        description: "Identifiant numérique de ton application Telegram",
        isSecret: false,
        placeholder: "12345678",
        howTo: "Va sur my.telegram.org → Log in → API development tools → Create application → copie l'App api_id",
      },
      {
        key: "TELEGRAM_API_HASH",
        label: "API Hash",
        description: "Clé secrète de ton application Telegram",
        isSecret: true,
        placeholder: "abc123def456abc123def456abc12345",
        howTo: "Sur la même page my.telegram.org, copie l'App api_hash (32 caractères hexadécimaux)",
      },
      {
        key: "TELEGRAM_SESSION_STRING",
        label: "Session String (optionnel)",
        description: "Session Telethon pré-générée pour se connecter sans OTP à chaque redémarrage",
        isSecret: true,
        placeholder: "1BQANOTEuAm3T...",
        howTo: "Généré automatiquement quand tu connectes un compte via le dashboard → Accounts → Connect",
      },
    ],
  },
  {
    id: "openai",
    label: "OpenAI GPT-4o",
    icon: Cpu,
    color: "text-emerald-400",
    priority: "recommended",
    description: "IA principale pour générer les messages. Sans cette clé, le bot utilise Gemini ou les templates.",
    fields: [
      {
        key: "OPENAI_API_KEY",
        label: "API Key",
        description: "Clé d'accès à l'API OpenAI — utilisée pour GPT-4o (génération principale)",
        isSecret: true,
        placeholder: "sk-proj-...",
        howTo: "Va sur platform.openai.com → API keys → Create new secret key → copie la clé immédiatement (elle ne s'affiche qu'une fois)",
      },
      {
        key: "OPENAI_MODEL",
        label: "Modèle",
        description: "Modèle GPT à utiliser. gpt-4o est le meilleur, gpt-4o-mini est 10x moins cher.",
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
    priority: "recommended",
    description: "Fallback automatique si OpenAI échoue ou si tu n'as pas de clé OpenAI",
    fields: [
      {
        key: "GEMINI_API_KEY",
        label: "API Key",
        description: "Clé Google AI Studio — fallback automatique si OpenAI n'est pas disponible",
        isSecret: true,
        placeholder: "AIzaSy...",
        howTo: "Va sur aistudio.google.com → Get API key → Create API key → copie la clé (commence par AIzaSy...)",
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
    priority: "required",
    description: "PostgreSQL — stocke tous les comptes, messages, campagnes, leads, etc.",
    fields: [
      {
        key: "DATABASE_URL",
        label: "Connection String",
        description: "URL de connexion PostgreSQL complète avec user/password/host/database",
        isSecret: true,
        placeholder: "postgresql://user:password@host:5432/nexus_ai",
        howTo: "Sur Replit : va dans l'onglet Database → copie la DATABASE_URL. Ailleurs : Neon.tech, Supabase, ou Railway offrent du PostgreSQL gratuit.",
      },
    ],
  },
  {
    id: "security",
    label: "Sécurité & Sessions",
    icon: ShieldCheck,
    color: "text-rose-400",
    priority: "required",
    description: "Chiffrement des sessions Express — doit être une chaîne aléatoire longue",
    fields: [
      {
        key: "SESSION_SECRET",
        label: "Session Secret",
        description: "Clé de chiffrement des sessions (minimum 32 caractères aléatoires)",
        isSecret: true,
        placeholder: "nexus-ai-super-secret-key-2024-random-chars...",
        howTo: "Génère avec : openssl rand -hex 32  (ou utilise n'importe quelle chaîne aléatoire de 32+ chars)",
      },
    ],
  },
  {
    id: "webhook",
    label: "Webhooks & Alertes",
    icon: Webhook,
    color: "text-yellow-400",
    priority: "optional",
    description: "Notifications externes quand un compte est banni ou qu'une erreur critique survient",
    fields: [
      {
        key: "WEBHOOK_URL",
        label: "Webhook URL",
        description: "URL POST appelée lors d'événements critiques (ban, FloodWait critique, erreur)",
        isSecret: false,
        placeholder: "https://hooks.zapier.com/hooks/catch/...",
        howTo: "Créer sur Zapier, Make, n8n, ou Discord (Server Settings → Integrations → Webhooks)",
      },
      {
        key: "ALERT_EMAIL",
        label: "Email d'alerte",
        description: "Email de notification pour les alertes de sécurité urgentes",
        isSecret: false,
        placeholder: "admin@example.com",
      },
    ],
  },
];

// ─── Deployment steps ─────────────────────────────────────────────────────────

const DEPLOY_STEPS = [
  {
    number: "01",
    title: "Obtenir les clés Telegram API",
    color: "text-sky-400",
    borderColor: "border-sky-500/30",
    bg: "bg-sky-500/5",
    steps: [
      "Ouvre ton navigateur et va sur https://my.telegram.org",
      "Connecte-toi avec ton numéro de téléphone (le même que ton compte Telegram principal)",
      "Clique sur « API development tools »",
      "Remplis le formulaire : App title = « Nexus AI », Short name = « nexusai », Platform = « Other »",
      "Clique « Create application »",
      "Copie l'App api_id (nombre) et l'App api_hash (chaîne hexadécimale) → colle-les dans Settings ci-dessous",
    ],
    warning: "⚠️ Utilise un compte Telegram personnel (pas un compte fraîchement créé). Telegram peut bloquer les nouvelles apps sur des comptes suspects.",
  },
  {
    number: "02",
    title: "Configurer la base de données",
    color: "text-orange-400",
    borderColor: "border-orange-500/30",
    bg: "bg-orange-500/5",
    steps: [
      "Sur Replit : dans le panneau gauche, clique sur l'icône « Database » → Replit crée automatiquement une base PostgreSQL",
      "Copie la DATABASE_URL affichée → colle dans Settings ci-dessous",
      "La base est déjà initialisée — toutes les tables ont été créées automatiquement au démarrage",
    ],
    warning: "💡 La base Replit est incluse dans ton abonnement. Pour la production, utilise Neon.tech (gratuit jusqu'à 512 MB).",
  },
  {
    number: "03",
    title: "Configurer l'IA (GPT-4o ou Gemini)",
    color: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    steps: [
      "Pour OpenAI GPT-4o : va sur platform.openai.com → API Keys → Create new secret key",
      "Copie la clé (sk-proj-...) → colle dans Settings sous « OpenAI GPT-4o »",
      "Pour Gemini (alternative gratuite) : va sur aistudio.google.com → Get API key",
      "Tu peux configurer les deux — le bot utilise OpenAI en priorité, Gemini en fallback",
    ],
    warning: "📊 Budget recommandé : GPT-4o coûte ~$0.005 par message généré. Pour 1000 messages/jour = ~$5/jour. GPT-4o-mini = 10x moins cher.",
  },
  {
    number: "04",
    title: "Connecter ton premier compte Telegram",
    color: "text-violet-400",
    borderColor: "border-violet-500/30",
    bg: "bg-violet-500/5",
    steps: [
      "Va dans le menu « Accounts » du dashboard",
      "Clique « Add Account » → entre le numéro de téléphone au format international (+33...)",
      "Entre le code OTP reçu par SMS ou Telegram",
      "Le compte apparaît avec statut « Connected » et un Health Score de 100",
      "Active le Warm-Up Scheduler (menu « Warm-Up ») — CRITIQUE pour les nouveaux comptes",
    ],
    warning: "🔥 RÈGLE D'OR : Ne jamais envoyer plus de 5 messages le premier jour sur un nouveau compte. Le Warm-Up Scheduler gère ça automatiquement.",
  },
  {
    number: "05",
    title: "Lancer le moteur Python",
    color: "text-pink-400",
    borderColor: "border-pink-500/30",
    bg: "bg-pink-500/5",
    steps: [
      "Dans Replit, ouvre le Shell (terminal)",
      "Lance : python python-backend/main.py",
      "Vérifie que le log affiche « Database pool created » et « Uvicorn running on port 8090 »",
      "Le moteur Python est maintenant actif — il écoute les commandes du dashboard",
    ],
    warning: "💻 En production : configure le moteur Python comme un workflow Replit permanent avec la commande : python python-backend/main.py",
  },
  {
    number: "06",
    title: "Créer et lancer ta première campagne",
    color: "text-yellow-400",
    borderColor: "border-yellow-500/30",
    bg: "bg-yellow-500/5",
    steps: [
      "Va dans « Campaigns » → « New Campaign »",
      "Définis un nom, le message template (ou active AI Generation), les groupes cibles",
      "Configure le délai humain (recommandé : 8–15 secondes minimum entre messages)",
      "Lance la campagne — le bot commence à envoyer avec des délais aléatoires naturels",
      "Surveille le Health Score dans Accounts — s'il descend sous 70, mets en pause",
    ],
    warning: "📈 Commence petit : 10–20 messages/jour max la première semaine. Augmente progressivement selon le Warm-Up Scheduler.",
  },
];

// ─── Architecture overview ─────────────────────────────────────────────────────

const ARCHITECTURE = [
  { layer: "Dashboard React", desc: "Interface de contrôle — ce que tu vois maintenant. Gère tout : comptes, campagnes, leads, A/B tests...", color: "bg-sky-500/20 border-sky-500/30 text-sky-300", icon: "🖥️" },
  { layer: "API Node.js /api", desc: "Serveur Express 5 — point d'entrée de toutes les requêtes. Valide avec Zod, stocke en PostgreSQL.", color: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300", icon: "⚙️" },
  { layer: "Python FastAPI :8090", desc: "Moteur Telegram — se connecte aux comptes via Telethon (MTProto). Simule un humain : délais gaussiens, simulation de frappe.", color: "bg-violet-500/20 border-violet-500/30 text-violet-300", icon: "🐍" },
  { layer: "PostgreSQL + Drizzle", desc: "Base de données — stocke 15+ tables : comptes, messages, campagnes, leads, proxies, mémoires...", color: "bg-orange-500/20 border-orange-500/30 text-orange-300", icon: "🗄️" },
  { layer: "OpenAI / Gemini API", desc: "Génération AI — GPT-4o génère les messages contextuels. Gemini est le fallback. Templates si aucune clé.", color: "bg-pink-500/20 border-pink-500/30 text-pink-300", icon: "🤖" },
];

// ─── Components ───────────────────────────────────────────────────────────────

function SecretInput({ value, onChange, placeholder, isSecret }: { value: string; onChange: (v: string) => void; placeholder: string; isSecret: boolean }) {
  const [show, setShow] = useState(false);
  if (!isSecret) return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="font-mono text-sm" />;
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="font-mono text-sm pr-10" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function StatusDot({ configured }: { configured: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${configured ? "bg-emerald-500" : "bg-zinc-600"}`} />;
}

function PriorityBadge({ priority }: { priority: "required" | "recommended" | "optional" }) {
  const cfg = { required: "bg-red-500/20 text-red-400 border-red-500/30", recommended: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", optional: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" };
  const labels = { required: "OBLIGATOIRE", recommended: "RECOMMANDÉ", optional: "OPTIONNEL" };
  return <Badge className={`border text-xs font-mono ${cfg[priority]}`}>{labels[priority]}</Badge>;
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function Settings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: settings = [], isLoading } = useListSettings();
  const upsert = useUpsertSettings();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"config" | "guide" | "architecture">("guide");

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
    return keys.filter((k) => k in edits && edits[k] !== "").map((k) => {
      const f = fields.find((f) => f.key === k)!;
      return { key: k, value: edits[k], isSecret: f.isSecret, description: f.description };
    });
  }

  function handleSaveGroup(groupId: string) {
    const group = SETTING_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    const toSave = buildPayload(group.fields.map((f) => f.key), group.fields);
    if (toSave.length === 0) { toast({ title: "Rien à sauvegarder", description: "Modifie au moins un champ." }); return; }
    upsert.mutate({ data: { settings: toSave } }, {
      onSuccess: () => {
        const m: Record<string, boolean> = {};
        toSave.forEach((s) => (m[s.key] = true));
        setSaved((p) => ({ ...p, ...m }));
        qc.invalidateQueries({ queryKey: getListSettingsQueryKey() });
        toast({ title: "Sauvegardé ✓", description: `${toSave.length} paramètre(s) mis à jour.` });
      },
    });
  }

  function handleSaveAll() {
    const allFields = SETTING_GROUPS.flatMap((g) => g.fields);
    const toSave = buildPayload(allFields.map((f) => f.key), allFields);
    if (toSave.length === 0) { toast({ title: "Rien à sauvegarder" }); return; }
    upsert.mutate({ data: { settings: toSave } }, {
      onSuccess: () => {
        const m: Record<string, boolean> = {};
        toSave.forEach((s) => (m[s.key] = true));
        setSaved((p) => ({ ...p, ...m }));
        qc.invalidateQueries({ queryKey: getListSettingsQueryKey() });
        toast({ title: "Tout sauvegardé ✓", description: `${toSave.length} paramètre(s) mis à jour.` });
      },
    });
  }

  function groupStatus(group: (typeof SETTING_GROUPS)[0]) {
    const configured = group.fields.filter((f) => {
      const s = settings.find((s) => s.key === f.key);
      return s?.value && s.value.length > 0;
    }).length;
    return { configured, total: group.fields.length };
  }

  const requiredKeys = SETTING_GROUPS.filter(g => g.priority === "required").flatMap(g => g.fields.map(f => f.key));
  const allRequiredSet = requiredKeys.every(k => settings.find(s => s.key === k)?.value);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <KeyRound className="w-7 h-7 text-primary" />
            Configuration & Déploiement
          </h1>
          <p className="text-muted-foreground mt-1">Guide complet · Clés API · Architecture du système</p>
        </div>
        {activeTab === "config" && (
          <Button onClick={handleSaveAll} disabled={upsert.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {upsert.isPending ? "Sauvegarde..." : "Tout sauvegarder"}
          </Button>
        )}
      </div>

      {/* Status banner */}
      <div className={`p-4 rounded-lg border flex items-center gap-4 ${allRequiredSet ? "border-emerald-500/30 bg-emerald-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
        {allRequiredSet
          ? <><CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /><div><p className="font-semibold text-emerald-400">Système prêt à démarrer</p><p className="text-sm text-emerald-200/70">Toutes les clés obligatoires sont configurées. Lance le moteur Python pour activer les comptes Telegram.</p></div></>
          : <><AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" /><div><p className="font-semibold text-yellow-400">Configuration incomplète</p><p className="text-sm text-yellow-200/70">Configure les clés <span className="font-mono text-xs text-yellow-300">OBLIGATOIRES</span> en rouge pour que le bot fonctionne. Commence par le Guide de déploiement ci-dessous.</p></div></>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/20 rounded-lg w-fit">
        {[
          { id: "guide", label: "📋 Guide déploiement", icon: BookOpen },
          { id: "config", label: "🔑 Clés API & Secrets", icon: KeyRound },
          { id: "architecture", label: "🏗️ Architecture", icon: Layers },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as "config" | "guide" | "architecture")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: GUIDE ──────────────────────────────────────────────────────── */}
      {activeTab === "guide" && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">Suis ces 6 étapes dans l'ordre pour mettre le bot en production. Clique sur chaque étape pour les instructions détaillées.</p>
          {DEPLOY_STEPS.map((step, i) => {
            const isOpen = expandedGuide === i;
            return (
              <div key={i} className={`rounded-lg border ${step.borderColor} ${step.bg} overflow-hidden`}>
                <button className="w-full p-4 flex items-center gap-4 text-left" onClick={() => setExpandedGuide(isOpen ? null : i)}>
                  <div className={`text-3xl font-black font-mono ${step.color} opacity-60`}>{step.number}</div>
                  <div className="flex-1">
                    <p className={`font-semibold ${step.color}`}>{step.title}</p>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 space-y-3">
                    <ol className="space-y-2">
                      {step.steps.map((s, j) => (
                        <li key={j} className="flex gap-3 text-sm">
                          <span className={`font-mono font-bold ${step.color} shrink-0 w-5`}>{j + 1}.</span>
                          <span className="text-foreground/80">{s}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-3 p-3 rounded bg-black/20 border border-white/5 text-xs text-muted-foreground">
                      {step.warning}
                    </div>
                    {i === 0 && (
                      <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 text-sm font-medium ${step.color} hover:underline mt-1`}>
                        <ExternalLink className="w-3.5 h-3.5" /> Ouvrir my.telegram.org
                      </a>
                    )}
                    {i === 2 && (
                      <div className="flex gap-3 flex-wrap mt-1">
                        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:underline">
                          <ExternalLink className="w-3.5 h-3.5" /> OpenAI API Keys
                        </a>
                        <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 hover:underline">
                          <ExternalLink className="w-3.5 h-3.5" /> Google AI Studio
                        </a>
                      </div>
                    )}
                    {i === 4 && (
                      <div className="mt-2 p-3 rounded bg-black/40 font-mono text-xs text-emerald-300 border border-emerald-500/20">
                        <p className="text-muted-foreground mb-1"># Dans le Shell Replit :</p>
                        <p>python python-backend/main.py</p>
                        <p className="text-muted-foreground mt-2"># Log attendu :</p>
                        <p>INFO: Database pool created</p>
                        <p>INFO: Uvicorn running on http://0.0.0.0:8090</p>
                      </div>
                    )}
                    {i < DEPLOY_STEPS.length - 1 && (
                      <Button size="sm" variant="ghost" className={`mt-1 ${step.color}`} onClick={() => setExpandedGuide(i + 1)}>
                        Étape suivante <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Quick checklist */}
          <Card className="border-border/40">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" />Checklist de déploiement rapide</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: "TELEGRAM_API_ID", label: "API ID Telegram configuré" },
                  { key: "TELEGRAM_API_HASH", label: "API Hash Telegram configuré" },
                  { key: "OPENAI_API_KEY", label: "Clé OpenAI ou Gemini configurée" },
                  { key: "DATABASE_URL", label: "Base de données connectée" },
                  { key: "SESSION_SECRET", label: "Session Secret défini" },
                ].map(item => {
                  const done = settings.find(s => s.key === item.key)?.value;
                  return (
                    <div key={item.key} className={`flex items-center gap-2 p-2 rounded text-sm ${done ? "text-emerald-400" : "text-muted-foreground"}`}>
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${done ? "text-emerald-400" : "text-zinc-600"}`} />
                      {item.label}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB: CONFIG ─────────────────────────────────────────────────────── */}
      {activeTab === "config" && (
        <div className="space-y-4">
          {/* Status overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {SETTING_GROUPS.map((g) => {
              const { configured, total } = groupStatus(g);
              const Icon = g.icon;
              const allOk = configured === total;
              return (
                <div key={g.id} className={`p-3 rounded-lg border flex flex-col gap-1 ${allOk ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/40 bg-muted/20"}`}>
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${allOk ? "text-emerald-400" : g.color}`} />
                    <span className="text-xs font-medium truncate">{g.label}</span>
                  </div>
                  <span className={`text-lg font-bold font-mono ${allOk ? "text-emerald-400" : "text-muted-foreground"}`}>{configured}/{total}</span>
                </div>
              );
            })}
          </div>

          {SETTING_GROUPS.map((group) => {
            const Icon = group.icon;
            const { configured, total } = groupStatus(group);
            const hasEdits = group.fields.some((f) => f.key in edits && edits[f.key] !== "");
            return (
              <Card key={group.id} className={group.priority === "required" && configured < total ? "border-red-500/20" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${group.color}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{group.label}</CardTitle>
                          <PriorityBadge priority={group.priority} />
                        </div>
                        <CardDescription className="mt-0.5">{group.description}</CardDescription>
                      </div>
                    </div>
                    <Button size="sm" variant={hasEdits ? "default" : "outline"} onClick={() => handleSaveGroup(group.id)} disabled={upsert.isPending || !hasEdits}>
                      <Save className="w-3.5 h-3.5 mr-1.5" />Sauvegarder
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
                            {field.isSecret && <Badge variant="outline" className="text-xs px-1.5 py-0 font-mono border-violet-500/40 text-violet-400">SECRET</Badge>}
                            {wasSaved && <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3 h-3" />Sauvegardé</span>}
                            {masked && !wasSaved && <Badge variant="outline" className="text-xs px-1.5 py-0 border-zinc-600 text-zinc-400">MASQUÉ</Badge>}
                          </div>
                          <SecretInput value={currentValue(field.key)} onChange={(v) => handleChange(field.key, v)} placeholder={field.placeholder} isSecret={field.isSecret} />
                          <p className="text-xs text-muted-foreground">{field.description}</p>
                          {field.howTo && (
                            <div className="p-2.5 rounded bg-muted/20 border border-border/40">
                              <p className="text-xs text-foreground/70"><span className="font-semibold text-primary">📍 Comment obtenir : </span>{field.howTo}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── TAB: ARCHITECTURE ───────────────────────────────────────────────── */}
      {activeTab === "architecture" && (
        <div className="space-y-6">
          {/* Stack diagram */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Layers className="w-4 h-4 text-primary" />Stack Nexus AI — Vue d'ensemble</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {ARCHITECTURE.map((layer) => (
                <div key={layer.layer} className={`p-4 rounded-lg border ${layer.color} flex items-start gap-4`}>
                  <span className="text-2xl shrink-0">{layer.icon}</span>
                  <div>
                    <p className="font-bold font-mono text-sm">{layer.layer}</p>
                    <p className="text-xs opacity-80 mt-0.5">{layer.desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Flow explanation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" />Flux d'envoi d'un message</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {[
                  ["Dashboard", "Tu déclenches une campagne ou un message"],
                  ["API /api", "Valide la requête Zod, stocke en DB, appelle Python"],
                  ["Python :8090", "Calcule un délai humain gaussien (σ=2s)"],
                  ["Telethon", "Simule la frappe, attend, envoie via MTProto"],
                  ["Telegram", "Message délivré depuis le vrai compte"],
                  ["Retour DB", "Message loggé avec timestamp, statut, AI badge"],
                ].map(([from, to], i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="font-mono text-xs font-bold text-primary w-20 shrink-0">{from}</span>
                    <ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground/50" />
                    <span className="text-xs">{to}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" />Systèmes anti-ban actifs</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[
                  { name: "Warm-Up Scheduler", desc: "Augmente progressivement les limites (2→50 msg/j sur 14 jours)", color: "text-orange-400" },
                  { name: "Human Delay Engine", desc: "Délais gaussiens entre 8–15s, simulation de frappe", color: "text-sky-400" },
                  { name: "FloodWait Tracker", desc: "Détecte les 420 errors, refroidit le compte automatiquement", color: "text-yellow-400" },
                  { name: "Health Score", desc: "Score 0–100 par compte, pause si < 50", color: "text-emerald-400" },
                  { name: "Proxy Manager", desc: "1 IP dédiée par compte via SOCKS5", color: "text-cyan-400" },
                  { name: "Sentiment Escalation", desc: "Met l'AI en pause si contact négatif détecté", color: "text-red-400" },
                ].map(s => (
                  <div key={s.name} className="flex gap-2 text-xs">
                    <span className={`font-semibold ${s.color} w-36 shrink-0`}>{s.name}</span>
                    <span className="text-muted-foreground">{s.desc}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-violet-400" />Pipeline IA complet</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {[
                  "1. Message reçu → analyse de sentiment (-1 à +1)",
                  "2. Lookup Memory Engine → récupère le contexte contact",
                  "3. Détection de langue automatique (FR/EN/ES/AR...)",
                  "4. GPT-4o génère une réponse contextualisée en langue détectée",
                  "5. Si sentiment < -0.4 → escalade + pause AI",
                  "6. Mémoire mise à jour avec les nouveaux sujets détectés",
                  "7. Lead Funnel mis à jour selon la progression du contact",
                  "8. A/B Test : variante A ou B sélectionnée aléatoirement",
                ].map((step, i) => (
                  <p key={i} className="text-foreground/70">{step}</p>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Database className="w-4 h-4 text-orange-400" />Tables de la base de données</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    "accounts", "groups", "channels", "messages",
                    "campaigns", "schedules", "ai_personalities", "security_events",
                    "notifications", "delay_configs", "app_settings", "warmup_plans",
                    "proxies", "flood_events", "conversation_memories", "leads",
                    "ab_tests", "auto_join_targets", "escalations",
                  ].map(t => (
                    <span key={t} className="text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Technology stack */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Server className="w-4 h-4 text-primary" />Technologies utilisées</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { cat: "Frontend", items: ["React 18", "Vite", "shadcn/ui", "Recharts", "React Query", "Wouter"], color: "text-sky-400" },
                  { cat: "API Backend", items: ["Node.js 24", "Express 5", "TypeScript 5.9", "Zod validation", "Drizzle ORM", "Pino logger"], color: "text-emerald-400" },
                  { cat: "Python Engine", items: ["FastAPI", "Uvicorn", "Telethon (MTProto)", "asyncpg", "OpenAI SDK", "NumPy (délais)"], color: "text-violet-400" },
                  { cat: "Infra & Data", items: ["PostgreSQL", "pnpm workspaces", "Orval codegen", "OpenAPI 3.1", "esbuild", "Replit hosting"], color: "text-orange-400" },
                ].map(col => (
                  <div key={col.cat}>
                    <p className={`text-xs font-bold uppercase mb-2 ${col.color}`}>{col.cat}</p>
                    <ul className="space-y-1">
                      {col.items.map(item => <li key={item} className="text-xs text-muted-foreground font-mono">{item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Security note */}
          <div className="p-4 rounded-lg border border-rose-500/20 bg-rose-500/5 flex items-start gap-3">
            <Lock className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-rose-400 mb-1">Sécurité des secrets</p>
              <p className="text-rose-200/80">Les valeurs marquées <span className="font-mono text-xs bg-violet-500/20 text-violet-300 px-1 rounded">SECRET</span> sont masquées en base dès la sauvegarde (seuls 4 premiers + 4 derniers chars visibles). Les clés API ne transitent jamais dans les logs. La <span className="font-mono text-xs">SESSION_SECRET</span> chiffre les cookies Express avec HMAC-SHA256. En production, utilise aussi les variables d'environnement Replit Secrets pour un stockage hors base.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
