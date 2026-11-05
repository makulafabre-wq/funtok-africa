<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Camera recordings use browser MediaRecorder with a canvas-filtered video stream and cloned microphone audio; the resulting File goes through the existing Bunny upload flow so camera filters are preserved in posted videos.
- Group live uses a six-seat, row-locked join RPC and expiring membership heartbeats; browser WebRTC mesh exchanges participant-scoped database signals so video and audio are not merely local previews.
- Visited feed tabs remain mounted with inactive players paused, five-minute query freshness and thirty-minute cache retention; players share one lazy HLS import and only buffer the active and next entry to limit bandwidth.
- Feed and profile follow controls share the relationship query hook so changes stay synchronized and refresh follower counts and the Following feed.
- Feed video gestures distinguish delayed single taps, double taps, and movement-cancelled long presses; downloads prepare a video Blob before a separate save click to preserve mobile user activation.
