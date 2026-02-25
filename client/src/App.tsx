import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ConvexProvider client={convex}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </ConvexProvider>
  );
}

export default App;
