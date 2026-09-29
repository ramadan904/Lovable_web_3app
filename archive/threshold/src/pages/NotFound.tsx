import { Link, useLocation } from "react-router-dom";
import { PageShell } from "@/components/brand/PageShell";
import { EmptyState } from "@/components/threshold/EmptyState";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <PageShell>
      <EmptyState
        title="There is no door here."
        action={
          <Button asChild variant="outline">
            <Link to="/">Return to the beginning</Link>
          </Button>
        }
      >
        <span className="font-mono text-xs text-bone-faint">{pathname}</span> doesn't lead anywhere.
      </EmptyState>
    </PageShell>
  );
}
