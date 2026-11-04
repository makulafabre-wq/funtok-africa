CREATE TABLE public.market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 100),
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'UGX',
  category text NOT NULL DEFAULT 'Other',
  condition text NOT NULL DEFAULT 'New',
  location text NOT NULL DEFAULT 'Kampala',
  phone text,
  image_paths text[] NOT NULL DEFAULT '{}',
  bunny_video_id text,
  delivery boolean NOT NULL DEFAULT false,
  is_sold boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.market_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_listings TO authenticated;
GRANT ALL ON public.market_listings TO service_role;
ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market read" ON public.market_listings FOR SELECT USING (true);
CREATE POLICY "market own insert" ON public.market_listings FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
CREATE POLICY "market own update" ON public.market_listings FOR UPDATE TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
CREATE POLICY "market own delete" ON public.market_listings FOR DELETE TO authenticated USING (seller_id = auth.uid());
CREATE INDEX market_listings_created_idx ON public.market_listings (created_at DESC);
CREATE POLICY "market media read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'market-media');
CREATE POLICY "market media own upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'market-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "market media own delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'market-media' AND (storage.foldername(name))[1] = auth.uid()::text);