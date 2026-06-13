import { useListCampaigns } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Square, Activity, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Campaigns() {
  const { data: campaigns, isLoading } = useListCampaigns();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Active Campaigns</h1>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
          Initialize Campaign
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-muted-foreground font-mono">
            Loading campaigns...
          </div>
        ) : campaigns?.map((campaign) => (
          <Card key={campaign.id} className="bg-card/50 border-border/50 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{campaign.name}</CardTitle>
                <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className="uppercase font-mono text-[10px]">
                  {campaign.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{campaign.type}</div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <p className="text-sm text-foreground/80 flex-1">{campaign.description || 'No description provided.'}</p>
              
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-mono">
                  <span className="flex items-center text-muted-foreground"><Target className="w-3 h-3 mr-1" /> Target Scope</span>
                  <span className="text-primary">{campaign.targetGroups?.length || 0} Groups</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="flex items-center text-muted-foreground"><Activity className="w-3 h-3 mr-1" /> Payload Delivered</span>
                    <span>{campaign.messagesSent || 0} msgs</span>
                  </div>
                  <Progress value={Math.min(100, ((campaign.messagesSent || 0) / 1000) * 100)} className="h-1 bg-secondary/50" />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-border/50">
                {campaign.status === 'active' ? (
                  <Button variant="outline" size="sm" className="flex-1 font-mono text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Square className="w-3 h-3 mr-2" /> HALT
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="flex-1 font-mono text-xs text-primary hover:text-primary hover:bg-primary/10">
                    <Play className="w-3 h-3 mr-2" /> ENGAGE
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
