import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout/Layout";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err: any) => err?.status !== 401 && count < 2,
    },
  },
});

function AuthGate() {
  const { admin, loading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!admin && location !== "/login") navigate("/login");
      if (admin && location === "/login") navigate("/");
    }
  }, [admin, loading, location, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
          <span className="text-sm text-zinc-500 font-mono">Vérification...</span>
        </div>
      </div>
    );
  }

  if (!admin) {
    return <Login />;
  }

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
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
