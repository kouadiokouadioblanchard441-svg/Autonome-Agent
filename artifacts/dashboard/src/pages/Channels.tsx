import { useListChannels } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

export default function Channels() {
  const { data: channels, isLoading } = useListChannels();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Controlled Channels</h1>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle>Broadcast Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50 overflow-x-auto">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead>Channel</TableHead>
                  <TableHead>Subscribers</TableHead>
                  <TableHead>Posts Made</TableHead>
                  <TableHead>Auto-Post</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Scanning frequencies...
                    </TableCell>
                  </TableRow>
                ) : channels?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No channels currently controlled.
                    </TableCell>
                  </TableRow>
                ) : channels?.map((channel) => (
                  <TableRow key={channel.id} className="border-border/50">
                    <TableCell>
                      <div className="font-medium">{channel.title}</div>
                      <div className="text-xs text-muted-foreground">{channel.username ? `@${channel.username}` : `ID: ${channel.telegramId}`}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{channel.subscribersCount?.toLocaleString() || 'Unknown'}</TableCell>
                    <TableCell className="font-mono text-sm">{channel.postsCount?.toLocaleString() || '0'}</TableCell>
                    <TableCell>
                      <Switch checked={channel.isAutoPost} />
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Actions */}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
