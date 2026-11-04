import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as tus from "tus-js-client";
import { ImagePlus, Loader2, MapPin, MessageCircle, Phone, Plus, Search, Store, Trash2, Truck, Video, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { createUploadTicket } from "@/lib/bunny.functions";
import { playlistUrl, thumbUrl } from "@/lib/bunny";
import { VideoPlayer } from "@/components/funtok/VideoPlayer";
import { BottomNav } from "@/components/funtok/BottomNav";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/market")({
  head: () => ({ meta: [
    { title: "Market — Funtok" },
    { name: "description", content: "Buy and sell products in Uganda with photos, videos and prices on Funtok Market." },
    { property: "og:title", content: "Market — Funtok" },
    { property: "og:description", content: "Buy and sell products in Uganda with photos, videos and prices." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MarketPage,
});

const CATEGORIES = ["All", "Phones", "Fashion", "Electronics", "Food", "Beauty", "Home", "Vehicles", "Services", "Other"];
const CONDITIONS = ["New", "Used - like new", "Used"];

type Listing = {
  id: string; seller_id: string; title: string; description: string; price: number; currency: string; category: string;
  condition: string; location: string; phone: string | null; image_paths: string[]; bunny_video_id: string | null;
  delivery: boolean; is_sold: boolean; created_at: string; seller?: { username: string; avatar_url: string | null } | null;
};

const urlCache = new Map<string, string>();
async function mediaUrl(path: string) {
  const hit = urlCache.get(path);
  if (hit) return hit;
  const { data } = await supabase.storage.from("market-media").createSignedUrl(path, 86400);
  if (data?.signedUrl) urlCache.set(path, data.signedUrl);
  return data?.signedUrl ?? "";
}
function useMediaUrl(path?: string) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (path) void mediaUrl(path).then(setUrl); }, [path]);
  return url;
}
const money = (n: number, c: string) => `${c} ${Number(n).toLocaleString()}`;

function MarketPage() {
  const { user } = useAuth();
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [selling, setSelling] = useState(false);
  const [open, setOpen] = useState<Listing | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["market"],
    queryFn: async () => {
      const { data, error } = await supabase.from("market_listings").select("*, seller:profiles(username, avatar_url)").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as unknown as Listing[];
    },
  });
  const list = data.filter((l) => (cat === "All" || l.category === cat) && `${l.title} ${l.description} ${l.location}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col bg-background">
      <header className="space-y-2 border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Store className="h-6 w-6 text-primary" /> Market</h1>
          {user ? <Button size="sm" onClick={() => setSelling(true)}><Plus /> Sell</Button> : <Button size="sm" asChild><Link to="/auth">Sign in to sell</Link></Button>}
        </div>
        <label className="flex items-center gap-2 rounded-full bg-muted px-3 py-2"><Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
          {CATEGORIES.map((c) => <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${cat === c ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{c}</button>)}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-2">
        {isLoading ? <Loader2 className="mx-auto mt-10 h-8 w-8 animate-spin text-primary" />
          : !list.length ? <p className="mt-10 text-center text-sm text-muted-foreground">No products yet. Be the first to sell!</p>
          : <div className="grid grid-cols-2 gap-2">{list.map((l) => <Card key={l.id} l={l} onOpen={() => setOpen(l)} />)}</div>}
      </main>
      <BottomNav />
      {selling && user && <SellForm userId={user.id} onClose={() => setSelling(false)} />}
      {open && <Detail l={open} me={user?.id} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Card({ l, onOpen }: { l: Listing; onOpen: () => void }) {
  const img = useMediaUrl(l.image_paths[0]);
  const src = img || (l.bunny_video_id ? thumbUrl(l.bunny_video_id) : "");
  return (
    <button onClick={onOpen} className="overflow-hidden rounded-2xl bg-card text-left">
      <div className="relative aspect-square bg-muted">
        {src && <img src={src} alt={l.title} loading="lazy" className="h-full w-full object-cover" />}
        {l.bunny_video_id && <Video className="absolute right-2 top-2 h-4 w-4" />}
        {l.is_sold && <span className="absolute left-2 top-2 rounded bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">SOLD</span>}
      </div>
      <div className="p-2">
        <p className="truncate text-sm font-semibold">{l.title}</p>
        <p className="font-display font-bold text-primary">{money(l.price, l.currency)}</p>
        <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />{l.location}</p>
      </div>
    </button>
  );
}

function Detail({ l, me, onClose }: { l: Listing; me: string | undefined; onClose: () => void }) {
  const qc = useQueryClient();
  const [imgs, setImgs] = useState<string[]>([]);
  useEffect(() => { void Promise.all(l.image_paths.map(mediaUrl)).then(setImgs); }, [l]);
  const mine = me === l.seller_id;
  const update = async (patch: { is_sold?: boolean } | null) => {
    const { error } = patch ? await supabase.from("market_listings").update(patch).eq("id", l.id) : await supabase.from("market_listings").delete().eq("id", l.id);
    if (error) { toast.error("Could not update the product."); return; }
    await qc.invalidateQueries({ queryKey: ["market"] }); onClose();
  };
  const phone = l.phone?.replace(/[^\d+]/g, "");
  return (
    <div role="dialog" aria-label={l.title} className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-md pb-6">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-overlay p-3 backdrop-blur-md">
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X /></Button>
          <span className="truncate font-semibold">{l.title}</span><span className="w-10" />
        </div>
        {l.bunny_video_id && <div className="aspect-[9/16] max-h-[70dvh] w-full bg-card"><VideoPlayer src={playlistUrl(l.bunny_video_id)} poster={thumbUrl(l.bunny_video_id, 720)} active muted={false} className="h-full w-full" /></div>}
        {!!imgs.length && <div className="scrollbar-none flex snap-x gap-2 overflow-x-auto p-2">{imgs.map((u) => <img key={u} src={u} alt={l.title} className="h-72 w-full shrink-0 snap-center rounded-2xl object-cover" />)}</div>}
        <div className="space-y-3 p-4">
          <p className="font-display text-3xl font-bold text-primary">{money(l.price, l.currency)}</p>
          <h2 className="text-xl font-semibold">{l.title}</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-muted px-2 py-1">{l.category}</span>
            <span className="rounded-full bg-muted px-2 py-1">{l.condition}</span>
            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1"><MapPin className="h-3 w-3" />{l.location}</span>
            {l.delivery && <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1"><Truck className="h-3 w-3" />Delivery available</span>}
            {l.is_sold && <span className="rounded-full bg-destructive px-2 py-1 text-destructive-foreground">Sold</span>}
          </div>
          {l.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{l.description}</p>}
          <Link to="/profile/$id" params={{ id: l.seller_id }} className="block text-sm font-semibold">Seller: @{l.seller?.username ?? "seller"}</Link>
          {mine ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => void update({ is_sold: !l.is_sold })}>{l.is_sold ? "Mark available" : "Mark as sold"}</Button>
              <Button variant="destructive" onClick={() => void update(null)}><Trash2 /> Delete</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {me ? <Button asChild><Link to="/chat" search={{ user: l.seller_id }}><MessageCircle /> Chat seller</Link></Button> : <Button asChild><Link to="/auth">Sign in to chat</Link></Button>}
              {phone ? <Button variant="secondary" asChild><a href={`tel:${phone}`}><Phone /> Call</a></Button> : <span />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SellForm({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: "", description: "", price: "", currency: "UGX", category: "Other", condition: "New", location: "Kampala", phone: "", delivery: false });
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    const price = Number(f.price);
    if (f.title.trim().length < 2) { toast.error("Add a product name."); return; }
    if (!f.price || !(price >= 0)) { toast.error("Add a valid price."); return; }
    if (!images.length && !video) { toast.error("Add at least one photo or a video."); return; }
    try {
      setBusy("Uploading photos…");
      const paths: string[] = [];
      for (const img of images) {
        const path = `${userId}/${Date.now()}_${img.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("market-media").upload(path, img, { contentType: img.type });
        if (error) throw error;
        paths.push(path);
      }
      let bunny: string | null = null;
      if (video) {
        const t = await createUploadTicket({ data: { title: f.title } });
        await new Promise<void>((resolve, reject) => {
          new tus.Upload(video, {
            endpoint: "https://video.bunnycdn.com/tusupload", retryDelays: [0, 3000, 5000],
            headers: { AuthorizationSignature: t.signature, AuthorizationExpire: String(t.expire), VideoId: t.videoId, LibraryId: t.libraryId },
            metadata: { filetype: video.type, title: f.title },
            onProgress: (s, total) => setBusy(`Uploading video ${Math.round((s / total) * 100)}%`),
            onError: reject, onSuccess: () => resolve(),
          }).start();
        });
        bunny = t.videoId;
      }
      setBusy("Posting…");
      const { error } = await supabase.from("market_listings").insert({
        seller_id: userId, title: f.title.trim(), description: f.description.trim(), price, currency: f.currency, category: f.category,
        condition: f.condition, location: f.location.trim() || "Kampala", phone: f.phone.trim() || null, delivery: f.delivery, image_paths: paths, bunny_video_id: bunny,
      });
      if (error) throw error;
      toast.success("Your product is on the Market! 🛍️");
      await qc.invalidateQueries({ queryKey: ["market"] });
      onClose();
    } catch (e) {
      console.error(e); toast.error("Could not post your product. Please try again."); setBusy("");
    }
  };
  const input = "w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none";
  return (
    <div role="dialog" aria-label="Sell a product" className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-md space-y-3 p-4 pb-8">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Sell a product</h2>
          <Button variant="ghost" size="icon" aria-label="Close" disabled={!!busy} onClick={onClose}><X /></Button></div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border border-dashed border-border p-4 text-xs font-semibold"><ImagePlus className="h-6 w-6 text-primary" />{images.length ? `${images.length} photo(s)` : "Add photos (up to 6)"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const fs = Array.from(e.target.files ?? []).filter((x) => x.size <= 10 * 1024 * 1024).slice(0, 6); setImages(fs); }} /></label>
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border border-dashed border-border p-4 text-xs font-semibold"><Video className="h-6 w-6 text-primary" />{video ? "Video added" : "Add a video"}
            <input type="file" accept="video/*" className="hidden" onChange={(e) => { const v = e.target.files?.[0]; if (v && v.size > 500 * 1024 * 1024) { toast.error("Video max 500 MB."); return; } setVideo(v ?? null); }} /></label>
        </div>
        <input className={input} placeholder="Product name" maxLength={100} value={f.title} onChange={(e) => set("title", e.target.value)} />
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <select className={input} value={f.currency} onChange={(e) => set("currency", e.target.value)}><option>UGX</option><option>USD</option><option>KES</option></select>
          <input className={input} inputMode="numeric" placeholder="Price" value={f.price} onChange={(e) => set("price", e.target.value.replace(/[^\d.]/g, ""))} />
        </div>
        <textarea className={`${input} min-h-24`} placeholder="Describe your product: size, colour, features…" maxLength={2000} value={f.description} onChange={(e) => set("description", e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <select className={input} value={f.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.slice(1).map((c) => <option key={c}>{c}</option>)}</select>
          <select className={input} value={f.condition} onChange={(e) => set("condition", e.target.value)}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <input className={input} placeholder="Location (e.g. Kampala, Ntinda)" value={f.location} onChange={(e) => set("location", e.target.value)} />
        <input className={input} type="tel" placeholder="Phone for buyers (optional)" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.delivery} onChange={(e) => set("delivery", e.target.checked)} /> I can deliver</label>
        <Button size="lg" className="w-full" disabled={!!busy} onClick={() => void submit()}>{busy ? <><Loader2 className="animate-spin" />{busy}</> : "Post to Market"}</Button>
      </div>
    </div>
  );
}
