import { Link } from "react-router-dom";
import { Van } from "@/components/Van";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container flex flex-col items-center gap-6 py-20 text-center">
      <Van className="max-w-xs" raining />
      <h1 className="text-3xl font-extrabold">Bertha took a wrong turn</h1>
      <p className="max-w-md text-muted-foreground">We couldn't find that page. Let's get you back to something that exists.</p>
      <div className="flex gap-3"><Button asChild><Link to="/">Home</Link></Button><Button asChild variant="outline"><Link to="/book">Book a detail</Link></Button></div>
    </div>
  );
}
