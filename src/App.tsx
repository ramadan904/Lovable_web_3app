import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
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

const App = () => (
  <BrowserRouter>
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
  </BrowserRouter>
);

export default App;
