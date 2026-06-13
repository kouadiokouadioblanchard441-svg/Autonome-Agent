import { useListNotifications, useMarkNotificationRead } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Info, ShieldAlert, BrainCircuit, CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const ICON_MAP = {
  info: <Info className="w-5 h-5 text-primary" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  error: <AlertTriangle className="w-5 h-5 text-destructive" />,
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
  security: <ShieldAlert className="w-5 h-5 text-destructive" />,
  ai: <BrainCircuit className="w-5 h-5 text-accent" />
};

export default function Notifications() {
  const { data: notifications } = useListNotifications({});

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight">System Alerts</h1>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {notifications?.map((notif) => (
              <div key={notif.id} className={`p-4 flex gap-4 transition-colors ${!notif.isRead ? 'bg-primary/5' : 'hover:bg-secondary/30'}`}>
                <div className="mt-1">{ICON_MAP[notif.type] || ICON_MAP.info}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${!notif.isRead ? 'text-foreground' : 'text-foreground/80'}`}>
                      {notif.title}
                    </p>
                    <span className="text-xs font-mono text-muted-foreground">
                      {format(new Date(notif.createdAt), 'MMM dd HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{notif.message}</p>
                </div>
              </div>
            ))}
            {(!notifications || notifications.length === 0) && (
              <div className="p-8 text-center text-muted-foreground font-mono">
                No system alerts.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
