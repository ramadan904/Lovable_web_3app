import { Component, type ErrorInfo, type ReactNode } from "react";
import { CloudRain, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actions } from "@/lib/store";

/** If something unexpected breaks a page, show a way back instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Fernhill hit an unexpected error", error, info.componentStack);
  }

  freshWeek = () => {
    try { actions.reset(); } catch { /* the saved data is what broke; the reload below reseeds */ }
    try { localStorage.clear(); } catch { /* private mode */ }
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="container flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 py-16" role="alert">
        <CloudRain className="size-9 text-primary" aria-hidden="true" />
        <h1 className="text-3xl font-extrabold">Bertha hit a pothole</h1>
        <p className="text-lg text-foreground/85">
          Something on this page went wrong. Nothing was charged and no text was sent. Reload to try again, or start a fresh demo week if the saved data is the problem.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.location.reload()}>Reload the page</Button>
          <Button variant="outline" onClick={this.freshWeek}><RotateCcw /> Start a fresh week</Button>
        </div>
      </main>
    );
  }
}
