import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, MessageSquare, Megaphone, CalendarClock,
  BrainCircuit, ShieldAlert, BarChart3, Bell, MessageCircle, Hash,
  Timer, KeyRound, Flame, Shield, Zap, Brain, Target, FlaskConical,
  Search, AlertTriangle,
} from "lucide-react";

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

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full sticky top-0">
      <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg tracking-tight uppercase">Nexus AI</span>
        </div>
      </div>
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
      <div className="p-4 border-t border-border text-xs text-muted-foreground shrink-0">
        SYSTEM STATUS: <span className="text-primary font-bold">ONLINE</span>
      </div>
    </div>
  );
}
