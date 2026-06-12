import { useListMessages, useSendMessage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { BrainCircuit, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Messages() {
  const { data: messages, isLoading } = useListMessages({});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Signal Intelligence</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card/50 border-border/50 flex flex-col h-[700px]">
          <CardHeader>
            <CardTitle>Intercepted Comms</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground font-mono">Decrypting stream...</div>
            ) : messages?.map((msg) => (
              <div key={msg.id} className={`flex flex-col max-w-[80%] rounded-md p-3 text-sm ${msg.direction === 'outbound' ? 'bg-primary/10 border border-primary/20 ml-auto' : 'bg-secondary border border-border/50'}`}>
                <div className="flex items-center justify-between mb-1 gap-4">
                  <span className="font-medium">{msg.senderUsername || 'Unknown'}</span>
                  <span className="text-xs font-mono text-muted-foreground opacity-50">{format(new Date(msg.createdAt), 'HH:mm:ss')}</span>
                </div>
                <p className="whitespace-pre-wrap text-foreground/90">{msg.content}</p>
                <div className="flex items-center justify-between mt-2">
                  {msg.isAIGenerated && (
                    <Badge variant="outline" className="text-[9px] uppercase font-mono text-accent border-accent/20 bg-accent/5 py-0 px-1.5 h-4">
                      <BrainCircuit className="w-2.5 h-2.5 mr-1 inline" /> AI Synthesized
                    </Badge>
                  )}
                  <span className="text-[10px] uppercase font-mono text-muted-foreground ml-auto">{msg.status}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50 h-fit">
          <CardHeader>
            <CardTitle>Manual Override</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground font-mono">
                Inject custom signal into communication stream.
              </div>
              <textarea 
                className="w-full h-32 bg-secondary/50 border border-border rounded-md p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                placeholder="Enter payload..."
              />
              <Button className="w-full font-mono font-bold tracking-wider">
                <SendHorizontal className="w-4 h-4 mr-2" />
                TRANSMIT
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
