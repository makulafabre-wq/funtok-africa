      {/* Funtok Fluid Comet Ribbon Buffering Animation */}
      {buffering && active && !paused && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="relative flex h-14 w-14 items-center justify-center">
            {/* Ambient neon backglow */}
            <div
              className="absolute h-10 w-10 rounded-full blur-md"
              style={{
                background: "radial-gradient(circle, rgba(255, 45, 85, 0.6) 0%, rgba(168, 85, 247, 0.4) 60%, transparent 80%)",
              }}
            />
            {/* Fluid Comet Ribbon Arc */}
            <svg
              className="h-12 w-12 animate-spin"
              viewBox="0 0 48 48"
              style={{
                animationDuration: "1.0s",
                filter: "drop-shadow(0 0 8px rgba(255, 45, 85, 0.6)) drop-shadow(0 0 14px rgba(168, 85, 247, 0.4))",
              }}
            >
              <defs>
                <linearGradient id="funtokCometGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                  <stop offset="25%" stopColor="#FF2D55" stopOpacity="0.95" />
                  <stop offset="60%" stopColor="#A855F7" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle
                cx="24"
                cy="24"
                r="18"
                fill="none"
                stroke="url(#funtokCometGrad)"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="75 125"
                strokeDashoffset="0"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Funtok Bottom Buffering Progress Line */}
      {buffering && active && !paused && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[2.5px] overflow-hidden bg-black/40">
          <div
            className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#A855F7] via-[#FF2D55] to-[#A855F7]"
            style={{
              boxShadow: "0 0 10px rgba(255, 45, 85, 0.6), 0 0 14px rgba(168, 85, 247, 0.4)",
              animation: "funtok-bar 1.2s ease-in-out infinite",
            }}
          />
        </div>
      )}

      {!online && (
        <div role="status" className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto w-fit bg-secondary px-3 py-1 text-xs text-secondary-foreground">
          {offlineMissing ? "This video isn't saved offline yet" : "Offline · Cached mode"}
        </div>
      )}

      {!playing && posterFailed && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card text-muted-foreground">
          <Video className="h-12 w-12" />
          <span className="text-sm">Video unavailable</span>
        </div>
      )}

      {paused && (
        <div role="status" aria-label="Video paused" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Play className="h-16 w-16 fill-foreground text-foreground drop-shadow-lg" />
        </div>
      )}

      <style>{`
        @keyframes funtok-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  );
}
