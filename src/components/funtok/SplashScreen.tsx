import { useEffect, useState } from "react";
import { Sparkle } from "lucide-react";

export function SplashScreen() {
  const [stage, setStage] = useState<"logo" | "text" | "tagline" | "fadeout" | "done">(() => {
    if (typeof window !== "undefined" && window.sessionStorage?.getItem("funtok_splash_seen")) {
      return "done";
    }
    return "logo";
  });

  useEffect(() => {
    if (stage === "done") return;
    try {
      window.sessionStorage?.setItem("funtok_splash_seen", "1");
    } catch {
      // Ignore storage restrictions
    }

    const t1 = setTimeout(() => setStage("text"), 250);
    const t2 = setTimeout(() => setStage("tagline"), 650);
    const t3 = setTimeout(() => setStage("fadeout"), 1600);
    const t4 = setTimeout(() => setStage("done"), 2100);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [stage]);

  if (stage === "done") return null;

  const isFadingOut = stage === "fadeout";
  const showText = stage === "text" || stage === "tagline" || stage === "fadeout";
  const showTagline = stage === "tagline" || stage === "fadeout";

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black transition-opacity duration-500 ease-out select-none pointer-events-none ${
        isFadingOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center justify-center gap-4">
        {/* Glowing Funtok Brand Emblem */}
        <div className="relative flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-brand shadow-[0_0_45px_rgba(255,45,85,0.45)] transition-transform duration-700 ease-out">
          <Sparkle className="h-12 w-12 fill-white text-white drop-shadow-md" />
          <span className="absolute -bottom-1 left-3 h-3 w-3 rotate-45 bg-[#A855F7]" />
        </div>

        {/* Funtok Title with Smooth Scale & Reveal */}
        <div className="overflow-hidden pt-1">
          <h1
            className={`font-display text-4xl font-extrabold tracking-tight text-white transition-all duration-700 ease-out ${
              showText
                ? "translate-y-0 opacity-100 scale-100"
                : "translate-y-4 opacity-0 scale-95"
            }`}
          >
            Funtok
          </h1>
        </div>

        {/* Tagline with Smooth Slide & Subtle Glow */}
        <div className="overflow-hidden">
          <p
            className={`text-xs font-semibold tracking-widest uppercase text-zinc-400 transition-all duration-700 ease-out ${
              showTagline
                ? "translate-y-0 opacity-100 tracking-widest"
                : "translate-y-3 opacity-0 tracking-normal"
            }`}
          >
            Save data, infinite happiness
          </p>
        </div>
      </div>
    </div>
  );
}
