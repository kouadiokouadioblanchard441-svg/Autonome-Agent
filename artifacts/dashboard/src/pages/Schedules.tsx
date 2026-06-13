import { useListSchedules } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";

export default function Schedules() {
  const { data: schedules, isLoading } = useListSchedules();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Cron Orchestration</h1>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle>Schedule Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50 overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead>Directive</TableHead>
                  <TableHead>CRON</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Execution</TableHead>
                  <TableHead>Next Expected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-mono">
                      Loading cron data...
                    </TableCell>
                  </TableRow>
                ) : schedules?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-mono">
                      No schedules defined.
                    </TableCell>
                  </TableRow>
                ) : schedules?.map((schedule) => (
                  <TableRow key={schedule.id} className="border-border/50">
                    <TableCell className="font-medium">{schedule.name}</TableCell>
                    <TableCell className="font-mono text-sm text-primary">{schedule.cronExpression}</TableCell>
                    <TableCell>
                      <Switch checked={schedule.isActive} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {schedule.lastRun ? format(new Date(schedule.lastRun), 'yyyy-MM-dd HH:mm:ss') : 'Never'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {schedule.nextRun ? format(new Date(schedule.nextRun), 'yyyy-MM-dd HH:mm:ss') : '-'}
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
