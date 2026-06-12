import { useListGroups } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export default function Groups() {
  const { data: groups, isLoading } = useListGroups();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Monitored Groups</h1>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle>Group Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead>Target</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Auto-Reply</TableHead>
                  <TableHead>Auto-Moderate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Scanning matrix...
                    </TableCell>
                  </TableRow>
                ) : groups?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No groups currently monitored.
                    </TableCell>
                  </TableRow>
                ) : groups?.map((group) => (
                  <TableRow key={group.id} className="border-border/50">
                    <TableCell>
                      <div className="font-medium">{group.title}</div>
                      <div className="text-xs text-muted-foreground">{group.username ? `@${group.username}` : `ID: ${group.telegramId}`}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{group.membersCount?.toLocaleString() || 'Unknown'}</TableCell>
                    <TableCell>
                      <Badge variant={group.isMonitored ? "default" : "secondary"} className="uppercase font-mono text-[10px]">
                        {group.isMonitored ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={group.isAutoReply} />
                    </TableCell>
                    <TableCell>
                      <Switch checked={group.isAutoModerate} />
                    </TableCell>
                    <TableCell className="text-right">
                      {/* TODO: Add edit/details actions */}
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
