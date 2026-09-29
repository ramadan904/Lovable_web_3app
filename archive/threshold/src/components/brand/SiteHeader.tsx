import { Link, NavLink, useNavigate } from "react-router-dom";
import { Wordmark } from "./Mark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/data";
import { cn } from "@/lib/utils";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative text-sm transition-colors duration-500 ease-quiet hover:text-bone",
    isActive ? "text-bone after:absolute after:-bottom-2 after:left-0 after:h-px after:w-full after:bg-copper/70" : "text-bone-dim",
  );

export function SiteHeader({ className }: { className?: string }) {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

  return (
    <header className={cn("relative z-20", className)}>
      <div className="container flex h-20 items-center justify-between md:h-24">
        <Link to="/" aria-label="Threshold, home" className="rounded-sm">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-5 md:gap-8">
          <NavLink to="/guides" className={cn(navClass, "hidden sm:inline")}>
            Guides
          </NavLink>
          {ready && user?.role === "guide" && (
            <NavLink to="/guide" className={navClass}>
              Calendar
            </NavLink>
          )}
          {ready && user && user.role !== "guide" && (
            <NavLink to="/record" className={navClass}>
              My thresholds
            </NavLink>
          )}
          {ready && !user && (
            <NavLink to="/login" className={navClass}>
              Sign in
            </NavLink>
          )}
          {ready && user && (
            <button
              type="button"
              className="hidden text-sm text-bone-faint transition-colors duration-500 hover:text-bone-dim md:inline"
              onClick={async () => {
                await api.signOut();
                navigate("/");
              }}
            >
              Sign out
            </button>
          )}
          <Button asChild size="sm" variant="outline" className="h-10 px-5">
            <Link to="/begin">Begin</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
