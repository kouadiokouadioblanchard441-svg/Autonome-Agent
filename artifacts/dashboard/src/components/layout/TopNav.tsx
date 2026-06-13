import { Bell, Search, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TopNavProps {
  onOpenSidebar: () => void;
}

export function TopNav({ onOpenSidebar }: TopNavProps) {
  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 flex items-center px-4 sm:px-6 gap-3">
      {/* Hamburger — mobile only */}
      <button
        onClick={onOpenSidebar}
        className="md:hidden text-muted-foreground hover:text-foreground p-1.5 rounded-md transition-colors shrink-0"
        aria-label="Ouvrir le menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Search bar — hidden on small mobile, shown from sm */}
      <div className="flex-1 flex items-center gap-4">
        <div className="relative w-full max-w-xs hidden sm:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts, groups..."
            className="pl-9 bg-secondary/50 border-secondary-border focus-visible:ring-primary text-sm"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-pulse" />
        </Button>
        <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-sm text-primary shrink-0">
          OP
        </div>
      </div>
    </header>
  );
}
