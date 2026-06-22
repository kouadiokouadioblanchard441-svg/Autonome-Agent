import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, XCircle, ShieldCheck, Bot, Cpu, Database,
  ExternalLink, AlertTriangle, Info, KeyRound, RefreshCw,
  Lock, Unlock, ChevronDown, ChevronUp, BookOpen, Layers,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnvStatus {
  key: string;
  label: string;
  description: string;
  isSecret: boolean;
  howTo: string | null;
  configured: boolean;
  source: "env";
}

// ─── Groups pour l'affichage ─────────────────────────────────────────────────

const GROUPS: {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  keys: string[];
  importance: "required" | "recommended" | "optional";
  description: string;
  whereToFind?: { label: string; url: string }[];
}[] = [
  {
    id: "telegram",
    label: "Telegram API",
    icon: Bot,
    color: "text-sky-400",
    bg: "bg-sky-500/5",
    border: "border-sky-500/30",
    importance: "required",
    description: "Permet de connecter de vrais comptes Telegram via Telethon (protocole MTProto)",
    keys: ["TELEGRAM_API_ID", "TELEGRAM_API_HASH", "TELEGRAM_BOT_TOKEN", "ADMIN_TELEGRAM_ID"],
    whereToFind: [
      { label: "Obtenir API ID & Hash → my.telegram.org", url: "https://my.telegram.org" },
      { label: "Créer un bot → @BotFather sur Telegram", url: "https://t.me/BotFather" },
    ],
  },
  {
    id: "ai",
    label: "Intelligence Artificielle",
    icon: Cpu,
    color: "text-emerald-400",
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/30",
    importance: "recommended",
    description: "GPT-4o génère les messages humanisés. Gemini est le fallback automatique si OpenAI échoue.",
    keys: ["OPENAI_API_KEY", "GEMINI_API_KEY"],
    whereToFind: [
      { label: "OpenAI (GPT-4o) → platform.openai.com/api-keys", url: "https://platform.openai.com/api-keys" },
      { label: "Gemini (gratuit) → aistudio.google.com", url: "https://aistudio.google.com" },
    ],
  },
  {
    id: "database",
    label: "Base de données Supabase",
    icon: Database,
    color: "text-orange-400",
    bg: "bg-orange-500/5",
    border: "border-orange-500/30",
    importance: "required",
    description: "PostgreSQL hébergé sur Supabase — stocke tous tes comptes, messages, campagnes, leads, etc.",
    keys: ["SUPABASE_DATABASE_URL"],
    whereToFind: [
      { label: "Tableau de bord Supabase → app.supabase.com", url: "https://app.supabase.com" },
    ],
  },
];

// ─── Where to find each key ────────────────────────────────────────────────

const KEY_WHERE: Record<string, { steps: string[]; url?: string; urlLabel?: string }> = {
  TELEGRAM_API_ID: {
    steps: [
      "Ouvre https://my.telegram.org dans un navigateur",
      "Connecte-toi avec ton numéro Telegram",
      "Clique sur « API development tools »",
      "Remplis le formulaire (App title: Nexus AI, Platform: Other)",
      "Copie l'App api_id (nombre, ex: 12345678)",
    ],
    url: "https://my.telegram.org",
    urlLabel: "Ouvrir my.telegram.org",
  },
  TELEGRAM_API_HASH: {
    steps: [
      "Même page que l'API ID (my.telegram.org → API development tools)",
      "Copie l'App api_hash (32 caractères hexadécimaux)",
      "⚠️ Ne partage JAMAIS ce hash — c'est ta clé privée d'application",
    ],
    url: "https://my.telegram.org",
    urlLabel: "Ouvrir my.telegram.org",
  },
  TELEGRAM_BOT_TOKEN: {
    steps: [
      "Ouvre Telegram et cherche @BotFather",
      "Envoie /newbot",
      "Choisis un nom et un username pour ton bot",
      "Copie le token (format: 123456789:AAF...)",
    ],
    url: "https://t.me/BotFather",
    urlLabel: "Ouvrir @BotFather",
  },
  ADMIN_TELEGRAM_ID: {
    steps: [
      "Ouvre Telegram et cherche @userinfobot ou @getmyid_bot",
      "Envoie /start",
      "Le bot te renvoie ton ID numérique (ex: 123456789)",
      "Copie ce nombre — c'est ton ADMIN_TELEGRAM_ID",
    ],
    url: "https://t.me/userinfobot",
    urlLabel: "Ouvrir @userinfobot",
  },
  OPENAI_API_KEY: {
    steps: [
      "Va sur platform.openai.com",
      "Connecte-toi / crée un compte",
      "Va dans API Keys → Create new secret key",
      "Copie la clé IMMÉDIATEMENT (commence par sk-proj-...)",
      "⚠️ Elle ne s'affiche qu'une seule fois — sauvegarde-la dans les Secrets Replit",
    ],
    url: "https://platform.openai.com/api-keys",
    urlLabel: "Ouvrir OpenAI API Keys",
  },
  GEMINI_API_KEY: {
    steps: [
      "Va sur aistudio.google.com",
      "Connecte-toi avec un compte Google",
      "Clique sur « Get API key » → Create API key",
      "Copie la clé (commence par AIzaSy...)",
      "✅ Gratuit pour un usage modéré",
    ],
    url: "https://aistudio.google.com",
    urlLabel: "Ouvrir Google AI Studio",
  },
  SUPABASE_DATABASE_URL: {
    steps: [
      "Va sur app.supabase.com → ton projet",
      "Settings → Database → Connection string",
      "Sélectionne « URI » avec le mode Transaction (port 6543)",
      "Copie l'URL complète (commence par postgresql://...)",
    ],
    url: "https://app.supabase.com",
    urlLabel: "Ouvrir Supabase",
  },
};

// ─── Component: EnvStatusCard ─────────────────────────────────────────────────

function EnvStatusCard({ item, expanded, onToggle }: {
  item: EnvStatus;
  expanded: boolean;
  onToggle: () => void;
}) {
  const detail = KEY_WHERE[item.key];
  return (
    <div className={`rounded-lg border transition-colors ${
      item.configured
        ? "border-emerald-500/20 bg-emerald-500/5"
        : "border-red-500/20 bg-red-500/5"
    }`}>
      <button
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
        onClick={onToggle}
      >
        {item.configured
          ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          : <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
              {item.key}
            </span>
            <span className="text-sm font-medium">{item.label}</span>
            {item.isSecret && (
              <Lock className="w-3 h-3 text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`text-xs border ${
            item.configured
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-red-500/10 text-red-400 border-red-500/30"
          }`}>
            {item.configured ? "✓ Configuré" : "✗ Manquant"}
          </Badge>
          {detail && (
            expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && detail && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Comment obtenir cette clé
          </p>
          <ol className="space-y-1.5">
            {detail.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="font-mono text-xs text-muted-foreground shrink-0 w-4 pt-0.5">
                  {i + 1}.
                </span>
                <span className="text-foreground/80">{step}</span>
              </li>
            ))}
          </ol>
          {detail.url && (
            <a
              href={detail.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium mt-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {detail.urlLabel ?? detail.url}
            </a>
          )}
          {!item.configured && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300 flex gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Pour ajouter cette clé : dans Replit, clique sur l'icône 🔒 <strong>Secrets</strong> dans la barre latérale gauche → « New Secret » → colle la valeur.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function Settings() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"status" | "howto">("status");

  const { data: envStatus = [], isLoading, refetch, isFetching } = useQuery<EnvStatus[]>({
    queryKey: ["env-status"],
    queryFn: async () => {
      const r = await fetch("/api/settings/env-status");
      if (!r.ok) throw new Error("Erreur chargement");
      return r.json();
    },
  });

  const totalConfigured = envStatus.filter(e => e.configured).length;
  const total = envStatus.length;
  const allOk = totalConfigured === total;
  const missing = envStatus.filter(e => !e.configured);

  function toggle(key: string) {
    setExpanded(prev => prev === key ? null : key);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <KeyRound className="w-7 h-7 text-primary" />
            Configuration Système
          </h1>
          <p className="text-muted-foreground mt-1">
            Statut de tes variables d'environnement (Replit Secrets) — {totalConfigured}/{total} configurées
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {/* === EXPLICATION PRINCIPALE === */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-semibold text-blue-300">Comment ça fonctionne ?</p>
              <div className="text-sm text-foreground/80 space-y-1.5">
                <p>
                  Toutes les clés API (Telegram, OpenAI, Supabase, etc.) sont stockées dans les{" "}
                  <strong className="text-white">Secrets Replit</strong> — c'est la façon correcte et sécurisée de les gérer.
                  Le bot Python les lit directement depuis l'environnement.
                </p>
                <p>
                  Cette page te montre <strong className="text-white">l'état réel</strong> de chaque clé : ✓ configurée (verte) ou ✗ manquante (rouge).
                  Elle ne te demande <strong className="text-white">pas de les resaisir ici</strong> — tout se gère dans l'onglet Secrets de Replit.
                </p>
              </div>
              <div className="mt-3 rounded-md bg-blue-500/10 border border-blue-500/20 p-3 flex gap-2">
                <Lock className="w-3.5 h-3.5 text-blue-300 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-200">
                  <strong>Pour ajouter ou modifier une clé :</strong> Replit → icône 🔒 Secrets (barre gauche) → New Secret → entre le nom exact (ex: OPENAI_API_KEY) et la valeur.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status banner */}
      <div className={`p-4 rounded-lg border flex items-center gap-4 ${
        allOk
          ? "border-emerald-500/30 bg-emerald-500/5"
          : missing.length <= 2
            ? "border-yellow-500/30 bg-yellow-500/5"
            : "border-red-500/30 bg-red-500/5"
      }`}>
        {allOk ? (
          <>
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-400">✅ Tout est configuré — Système opérationnel</p>
              <p className="text-sm text-emerald-200/70">
                Les {total} variables d'environnement sont présentes. Le bot fonctionne en mode pleine puissance.
              </p>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className={`w-6 h-6 shrink-0 ${missing.length <= 2 ? "text-yellow-400" : "text-red-400"}`} />
            <div>
              <p className={`font-semibold ${missing.length <= 2 ? "text-yellow-400" : "text-red-400"}`}>
                {missing.length} clé{missing.length > 1 ? "s" : ""} manquante{missing.length > 1 ? "s" : ""}
              </p>
              <p className="text-sm text-foreground/60">
                Clique sur chaque clé rouge pour savoir où la trouver et comment l'ajouter.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/20 rounded-lg w-fit">
        {[
          { id: "status", label: "🔑 Statut des clés" },
          { id: "howto",  label: "📋 Guide de démarrage" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as "status" | "howto")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* === TAB: STATUS === */}
      {activeTab === "status" && (
        <div className="space-y-6">
          {GROUPS.map(group => {
            const groupItems = envStatus.filter(e => group.keys.includes(e.key));
            const groupOk = groupItems.filter(e => e.configured).length;
            const GroupIcon = group.icon;
            return (
              <div key={group.id} className={`rounded-xl border ${group.border} ${group.bg} overflow-hidden`}>
                <div className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <GroupIcon className={`w-5 h-5 ${group.color} mt-0.5`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${group.color}`}>{group.label}</h3>
                        <Badge className={`text-xs border ${
                          group.importance === "required"
                            ? "bg-red-500/10 text-red-400 border-red-500/30"
                            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                        }`}>
                          {group.importance === "required" ? "OBLIGATOIRE" : "RECOMMANDÉ"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{group.description}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-lg font-bold ${groupOk === groupItems.length ? "text-emerald-400" : "text-red-400"}`}>
                      {groupOk}/{groupItems.length}
                    </span>
                    <p className="text-xs text-muted-foreground">configurées</p>
                  </div>
                </div>

                <div className="px-4 pb-4 space-y-2">
                  {groupItems.map(item => (
                    <EnvStatusCard
                      key={item.key}
                      item={item}
                      expanded={expanded === item.key}
                      onToggle={() => toggle(item.key)}
                    />
                  ))}
                </div>

                {group.whereToFind && groupOk < groupItems.length && (
                  <div className="px-4 pb-4 flex flex-wrap gap-3">
                    {group.whereToFind.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${group.color} hover:underline`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* === TAB: HOW TO === */}
      {activeTab === "howto" && (
        <div className="space-y-4">
          <Card className="border-muted/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Comment ajouter une clé manquante dans Replit ?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/20 border border-muted/30 p-4 space-y-2">
                {[
                  "Dans Replit, regarde la barre latérale gauche",
                  "Clique sur l'icône 🔒 « Secrets » (ou cherche dans les outils)",
                  "Clique sur « + New Secret »",
                  "Dans « Key » : entre le nom exact de la variable (ex: OPENAI_API_KEY)",
                  "Dans « Value » : colle la valeur de ta clé",
                  "Clique « Add Secret » — c'est tout !",
                  "Redémarre le workflow Python pour que les nouvelles clés soient prises en compte",
                ].map((step, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="font-mono text-xs text-primary shrink-0 w-5 pt-0.5 font-bold">{i + 1}.</span>
                    <span className="text-foreground/80">{step}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300 flex gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Les Secrets Replit sont <strong>chiffrés et sécurisés</strong>. Ils ne sont jamais exposés dans le code ni dans les logs.
                  C'est la méthode recommandée pour stocker des clés API.
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-muted/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Architecture du système
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  {
                    icon: "🖥️", label: "Dashboard React",
                    desc: "Ce que tu vois maintenant. Interface de contrôle pour tout gérer.",
                    color: "border-sky-500/30 bg-sky-500/5 text-sky-300",
                  },
                  {
                    icon: "⚙️", label: "API Node.js (Express 5)",
                    desc: "Serveur intermédiaire — reçoit les actions du dashboard, écrit en base.",
                    color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
                  },
                  {
                    icon: "🐍", label: "Moteur Python (FastAPI + Telethon)",
                    desc: "Le cœur du bot. Se connecte aux comptes Telegram, génère les messages IA, envoie tout. Tourne en permanence.",
                    color: "border-violet-500/30 bg-violet-500/5 text-violet-300",
                  },
                  {
                    icon: "🗄️", label: "PostgreSQL (Supabase)",
                    desc: "Base de données — stocke comptes, messages, campagnes, leads, mémoire IA, etc.",
                    color: "border-orange-500/30 bg-orange-500/5 text-orange-300",
                  },
                  {
                    icon: "🤖", label: "OpenAI GPT-4o / Google Gemini",
                    desc: "Génère les messages humanisés, détecte les émotions, répond en contexte.",
                    color: "border-pink-500/30 bg-pink-500/5 text-pink-300",
                  },
                ].map((item, i) => (
                  <div key={i} className={`rounded-lg border ${item.color} p-3 flex gap-3`}>
                    <span className="text-xl shrink-0">{item.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{item.label}</p>
                      <p className="text-xs text-foreground/60 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
