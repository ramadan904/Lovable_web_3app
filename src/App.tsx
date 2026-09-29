import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, HashRouter, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/sonner";
import Index from "./pages/Index";

const Book = lazy(() => import("./pages/Book"));
const Manage = lazy(() => import("./pages/Manage"));
const Claim = lazy(() => import("./pages/Claim"));
const Owner = lazy(() => import("./pages/Owner"));
const NotFound = lazy(() => import("./pages/NotFound"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo({ top: 0 }), [pathname]);
  return null;
}

// Hosted builds can't rely on server-side URL rewriting: the single-file "artifact" build routes in
// memory, and the GitHub Pages build routes on the URL hash. The normal build uses real paths.
const Router = import.meta.env.VITE_ROUTER === "memory" ? MemoryRouter : import.meta.env.VITE_ROUTER === "hash" ? HashRouter : BrowserRouter;

const App = () => (
  <Router>
    <Toaster />
    <ScrollToTop />
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" aria-label="Loading" />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Index />} />
          <Route path="/book" element={<Book />} />
          <Route path="/b/:code" element={<Manage />} />
          <Route path="/w/:id" element={<Claim />} />
          <Route path="/owner" element={<Owner />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  </Router>
);

export default App;
