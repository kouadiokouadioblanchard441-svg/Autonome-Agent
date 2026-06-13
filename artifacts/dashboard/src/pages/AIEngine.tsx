import { useListPersonalities, useListAILogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, Zap } from "lucide-react";
import { format } from "date-fns";

export default function AIEngine() {
  const { data: personalities } = useListPersonalities();
  const { data: logs } = useListAILogs({});

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <BrainCircuit className="w-6 h-6 sm:w-8 sm:h-8 text-accent" />
          Neural Engine
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Defined Personas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {personalities?.map((p) => (
                <div key={p.id} className="flex flex-col gap-2 p-3 rounded-md bg-secondary/30 border border-border/50">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm tracking-wide">{p.name}</span>
                    <Badge variant="outline" className="font-mono text-[10px] text-accent border-accent/20">{p.type}</Badge>
                  </div>
                  <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-500" /> E:{p.energyLevel}</span>
                    <span>T:{p.tone}</span>
                    <span>EMOJI:{p.emojiFrequency}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Engine Telemetry</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px] overflow-y-auto">
            <div className="space-y-2">
              {logs?.map((log) => (
                <div key={log.id} className="text-xs font-mono border-b border-border/30 pb-2 last:border-0">
                  <div className="flex justify-between text-muted-foreground mb-1">
                    <span className="text-accent">{log.action}</span>
                    <span>{format(new Date(log.createdAt), 'HH:mm:ss')}</span>
                  </div>
                  <div className="truncate text-foreground/70">{log.prompt || 'Implicit execution'}</div>
                  <div className="flex justify-between mt-1 opacity-50">
                    <span>{log.model}</span>
                    <span>Tokens: {log.tokensUsed || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
