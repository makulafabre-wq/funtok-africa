import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/funtok/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Funtok" },
      { name: "description", content: "Sign in to Funtok to post, like and chat." },
      { property: "og:title", content: "Sign in — Funtok" },
      { property: "og:description", content: "Sign in to Funtok to post, like and chat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const getSafeOrigin = () => {
    if (typeof window === "undefined") return "https://funtok-africa.lovable.app";
    if (window.location.origin.includes("localhost") || window.location.origin.startsWith("file:")) {
      return "https://funtok-africa.lovable.app";
    }
    return window.location.origin;
  };

  const submit = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      toast.error("Please enter your email and password");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setBusy(true);
    try {
      if (mode === "in") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          let friendly = error.message;
          const lower = friendly.toLowerCase();
          if (lower.includes("invalid login credentials") || lower.includes("invalid grant")) {
            friendly = "Invalid login details. Please check your email and password.";
          } else if (lower.includes("email not confirmed")) {
            friendly = "Please check your inbox and verify your email before signing in.";
          } else if (lower.includes("too many requests") || lower.includes("rate limit")) {
            friendly = "Too many attempts. Please wait a moment and try again.";
          } else if (lower.includes("failed to fetch") || lower.includes("network")) {
            friendly = "Network error. Please check your internet connection.";
          }
          toast.error(friendly);
          return;
        }

        if (data?.session) {
          toast.success("Welcome back!");
          navigate({ to: "/" });
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: `${getSafeOrigin()}/` },
        });

        if (error) {
          let friendly = error.message;
          const lower = friendly.toLowerCase();
          if (lower.includes("user already registered")) {
            friendly = "This email is already registered. Please sign in instead.";
          }
          toast.error(friendly);
          return;
        }

        if (data?.session) {
          toast.success("Account created! Welcome to Funtok.");
          navigate({ to: "/" });
        } else {
          toast.success("Account created! Check your email to confirm, then sign in.");
          setMode("in");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-black px-6">
      <Logo />
      <div className="w-full max-w-sm space-y-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoCapitalize="none" autoCorrect="off" placeholder="Email address" className="w-full rounded-xl bg-secondary px-4 py-3 outline-none text-foreground placeholder:text-muted-foreground" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full rounded-xl bg-secondary px-4 py-3 outline-none text-foreground placeholder:text-muted-foreground" />
        <button disabled={busy} onClick={submit} className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground shadow-glow transition-opacity disabled:opacity-60">
          {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-center text-sm text-muted-foreground hover:text-foreground py-2">
          {mode === "in" ? "New to Funtok? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
