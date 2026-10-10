import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/funtok/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in — Funtok" },
    { name: "description", content: "Sign in to Funtok to post, like and chat." },
    { property: "og:title", content: "Sign in — Funtok" },
    { property: "og:description", content: "Sign in to Funtok to post, like and chat." },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const { data, error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (data.session) navigate({ to: "/" }); else toast.success("Check your email to confirm your account");
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Google sign-in failed");
    else if (!r.redirected) navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6">
      <Logo />
      <div className="w-full max-w-sm space-y-3">
        <button onClick={google} className="w-full rounded-lg bg-secondary py-3 font-semibold">Continue with Google</button>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="w-full rounded-lg bg-secondary px-4 py-3 outline-none" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full rounded-lg bg-secondary px-4 py-3 outline-none" />
        <button disabled={busy} onClick={submit} className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground shadow-glow">
          {mode === "in" ? "Sign in" : "Create account"}
        </button>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-sm text-muted-foreground">
          {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
