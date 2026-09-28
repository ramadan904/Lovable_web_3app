import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { DemoGuide } from "@/components/brand/DemoGuide";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";

const Begin = lazy(() => import("./pages/Begin"));
const Record = lazy(() => import("./pages/Record"));
const Letter = lazy(() => import("./pages/Letter"));
const Login = lazy(() => import("./pages/Login"));
const Guides = lazy(() => import("./pages/Guides"));
const GuideCalendar = lazy(() => import("./pages/GuideCalendar"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo({ top: 0 }), [pathname]);
  return null;
}

/** Between routes, the screen simply stays quiet. */
function Quiet() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Loading">
      <div className="copper-line h-px w-24 animate-breathe" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
        <Toaster />
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<Quiet />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/begin" element={<Begin />} />
              <Route path="/guides" element={<Guides />} />
              <Route path="/record" element={<Record />} />
              <Route path="/letters/:id" element={<Letter />} />
              <Route path="/login" element={<Login />} />
              <Route path="/guide" element={<GuideCalendar />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <DemoGuide />
        </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
