import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout/Layout";

import Dashboard from "@/pages/Dashboard";
import Accounts from "@/pages/Accounts";
import Groups from "@/pages/Groups";
import Channels from "@/pages/Channels";
import Messages from "@/pages/Messages";
import Campaigns from "@/pages/Campaigns";
import Schedules from "@/pages/Schedules";
import AIEngine from "@/pages/AIEngine";
import HumanDelay from "@/pages/HumanDelay";
import Settings from "@/pages/Settings";
import Security from "@/pages/Security";
import Analytics from "@/pages/Analytics";
import Notifications from "@/pages/Notifications";
import WarmupScheduler from "@/pages/WarmupScheduler";
import ProxyManager from "@/pages/ProxyManager";
import FloodTracker from "@/pages/FloodTracker";
import MemoryEngine from "@/pages/MemoryEngine";
import LeadFunnel from "@/pages/LeadFunnel";
import ABTesting from "@/pages/ABTesting";
import AutoJoin from "@/pages/AutoJoin";
import Escalations from "@/pages/Escalations";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/accounts" component={Accounts} />
        <Route path="/groups" component={Groups} />
        <Route path="/channels" component={Channels} />
        <Route path="/messages" component={Messages} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/schedules" component={Schedules} />
        <Route path="/ai" component={AIEngine} />
        <Route path="/human-delay" component={HumanDelay} />
        <Route path="/settings" component={Settings} />
        <Route path="/security" component={Security} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/warmup" component={WarmupScheduler} />
        <Route path="/proxy-manager" component={ProxyManager} />
        <Route path="/flood-tracker" component={FloodTracker} />
        <Route path="/memory-engine" component={MemoryEngine} />
        <Route path="/lead-funnel" component={LeadFunnel} />
        <Route path="/ab-testing" component={ABTesting} />
        <Route path="/auto-join" component={AutoJoin} />
        <Route path="/escalations" component={Escalations} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
