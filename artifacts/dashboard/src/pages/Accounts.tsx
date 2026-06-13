import { useListAccounts, useGetAccountsStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, ShieldAlert, Wifi, WifiOff, Activity } from "lucide-react";
import { format } from "date-fns";

export default function Accounts() {
  const { data: accounts, isLoading } = useListAccounts();
  const { data: stats } = useGetAccountsStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Agent Accounts</h1>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Provision New Agent
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active & Connected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.connected || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cooldown/Banned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{(stats?.cooldown || 0) + (stats?.banned || 0)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Health Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{stats?.avgHealthScore || 0}/100</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle>Fleet Manifest</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50 overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead>Identifier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Connection</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Scanning accounts...
                    </TableCell>
                  </TableRow>
                ) : accounts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No accounts provisioned.
                    </TableCell>
                  </TableRow>
                ) : accounts?.map((account) => (
                  <TableRow key={account.id} className="border-border/50">
                    <TableCell>
                      <div className="font-mono text-sm">{account.phoneNumber}</div>
                      <div className="text-xs text-muted-foreground">{account.username ? `@${account.username}` : 'No username'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.status === 'active' ? 'default' : account.status === 'banned' ? 'destructive' : 'secondary'} className="uppercase font-mono text-[10px]">
                        {account.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Activity className={`w-4 h-4 ${account.healthScore && account.healthScore > 80 ? 'text-primary' : account.healthScore && account.healthScore > 50 ? 'text-accent' : 'text-destructive'}`} />
                        <span className="font-mono text-sm">{account.healthScore}/100</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {account.isConnected ? (
                        <div className="flex items-center gap-1 text-primary text-xs font-mono">
                          <Wifi className="w-3 h-3" /> ONLINE
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground text-xs font-mono">
                          <WifiOff className="w-3 h-3" /> OFFLINE
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {format(new Date(account.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="h-7 text-xs font-mono">
                        CONFIGURE
                      </Button>
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
