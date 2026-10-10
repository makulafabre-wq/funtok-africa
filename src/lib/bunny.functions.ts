import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Creates an empty Bunny video and returns a short-lived signature so the browser can upload directly via TUS. */
export const createUploadTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string }) => ({ title: String(input.title ?? "Funtok video").slice(0, 120) }))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["BUNNY_API_KEY"];
    const libraryId = process.env["BUNNY_LIBRARY_ID"] ?? "775931";
    if (!apiKey) throw new Error("Video uploads are not configured yet.");

    const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
      method: "POST",
      headers: { AccessKey: apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ title: `${data.title} · ${context.userId.slice(0, 8)}` }),
    });
    if (!res.ok) {
      console.error("Bunny create failed", res.status, await res.text());
      throw new Error("Could not start the upload. Please try again.");
    }
    const video = (await res.json()) as { guid: string };
    const expire = Math.floor(Date.now() / 1000) + 60 * 60 * 6;
    const raw = new TextEncoder().encode(`${libraryId}${apiKey}${expire}${video.guid}`);
    const hash = await crypto.subtle.digest("SHA-256", raw);
    const signature = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return { videoId: video.guid, libraryId, expire, signature };
  });
