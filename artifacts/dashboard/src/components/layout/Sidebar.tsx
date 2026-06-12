import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Megaphone,
  CalendarClock,
  BrainCircuit,
  ShieldAlert,
  BarChart3,
  Bell,
  MessageCircle,
  Hash,
  Timer,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Users },
  { href: "/groups", label: "Groups", icon: MessageCircle },
  { href: "/channels", label: "Channels", icon: Hash },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/schedules", label: "Schedules", icon: CalendarClock },
  { href: "/ai", label: "AI Engine", icon: BrainCircuit },
  { href: "/human-delay", label: "Human Delay", icon: Timer },
  { href: "/security", label: "Security", icon: ShieldAlert },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full sticky top-0">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg tracking-tight uppercase">Nexus AI</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            
            return (
              <Link key={item.href} href={item.href} className="block">
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                  data-testid={`link-${item.label.toLowerCase()}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-border text-xs text-muted-foreground">
        SYSTEM STATUS: <span className="text-primary font-bold">ONLINE</span>
      </div>
    </div>
  );
}
