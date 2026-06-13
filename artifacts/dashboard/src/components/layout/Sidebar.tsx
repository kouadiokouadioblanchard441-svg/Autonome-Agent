import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users, MessageSquare, Megaphone, CalendarClock,
  BrainCircuit, ShieldAlert, BarChart3, Bell, MessageCircle, Hash,
  Timer, KeyRound, Flame, Shield, Zap, Brain, Target, FlaskConical,
  Search, AlertTriangle, LogOut,
} from "lucide-react";
import nexusLogo from "@/assets/nexus-logo.svg";

const NAV_GROUPS = [
  {
    label: "Principal",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/accounts", label: "Accounts", icon: Users },
      { href: "/groups", label: "Groups", icon: MessageCircle },
      { href: "/channels", label: "Channels", icon: Hash },
      { href: "/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    label: "Automation",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/schedules", label: "Schedules", icon: CalendarClock },
      { href: "/auto-join", label: "Auto-Join Groups", icon: Search },
      { href: "/warmup", label: "Warm-Up Scheduler", icon: Flame },
    ],
  },
  {
    label: "Anti-Ban",
    items: [
      { href: "/proxy-manager", label: "Proxy Manager", icon: Shield },
      { href: "/flood-tracker", label: "FloodWait Tracker", icon: Zap },
      { href: "/human-delay", label: "Human Delay", icon: Timer },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/ai", label: "AI Engine", icon: BrainCircuit },
      { href: "/memory-engine", label: "Memory Engine", icon: Brain },
      { href: "/lead-funnel", label: "Lead Funnel", icon: Target },
      { href: "/ab-testing", label: "A/B Testing", icon: FlaskConical },
      { href: "/escalations", label: "Escalations", icon: AlertTriangle },
    ],
  },
  {
    label: "Système",
    items: [
      { href: "/security", label: "Security", icon: ShieldAlert },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/settings", label: "Secrets & Config", icon: KeyRound },
    ],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { admin, logout } = useAuth();

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full sticky top-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-border shrink-0 gap-3">
        <img src={nexusLogo} alt="Nexus AI" className="w-8 h-8 shrink-0" />
        <div>
          <span className="font-black text-base tracking-widest uppercase text-white">
            NEXUS<span className="text-cyan-400"> AI</span>
          </span>
          <p className="text-[9px] text-cyan-400/50 font-mono tracking-[0.2em] uppercase -mt-0.5">Control Panel</p>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3">
        <nav className="space-y-4 px-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location === item.href ||
                  (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} className="block">
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                      data-testid={`link-${item.href.replace("/", "").replace("-", "")}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Admin footer */}
      <div className="p-3 border-t border-border shrink-0 space-y-2">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/20">
          <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-cyan-400">
              {admin?.name?.charAt(0).toUpperCase() ?? "A"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{admin?.name ?? "Admin"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{admin?.email ?? ""}</p>
          </div>
          <button
            onClick={() => logout()}
            title="Déconnexion"
            className="text-muted-foreground hover:text-red-400 transition-colors p-1 rounded"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="px-2 text-[10px] text-muted-foreground flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          SYSTEM STATUS: <span className="text-primary font-bold">ONLINE</span>
        </div>
      </div>
    </div>
  );
}
