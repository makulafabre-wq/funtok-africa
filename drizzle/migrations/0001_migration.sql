CREATE TABLE public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text,
  video_bunny_id text,
  cta_text text NOT NULL DEFAULT 'Learn more',
  cta_link text,
  impressions int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.ads TO anon, authenticated;
GRANT ALL ON public.ads TO service_role;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads read active" ON public.ads FOR SELECT USING (is_active);

CREATE TABLE public.ad_config (
  id int PRIMARY KEY DEFAULT 1,
  ads_enabled boolean NOT NULL DEFAULT true,
  feed_ad_frequency int NOT NULL DEFAULT 5);
INSERT INTO public.ad_config(id) VALUES (1);
GRANT SELECT ON public.ad_config TO anon, authenticated;
GRANT ALL ON public.ad_config TO service_role;
ALTER TABLE public.ad_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_config read" ON public.ad_config FOR SELECT USING (true);

INSERT INTO public.ads(title, cta_text, cta_link) VALUES ('Advertise on Funtok — reach Kampala', 'Get started', 'https://funtok.app');

CREATE OR REPLACE FUNCTION public.track_ad(_ad_id uuid, _kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _kind = 'click' THEN UPDATE public.ads SET clicks = clicks + 1 WHERE id = _ad_id;
  ELSE UPDATE public.ads SET impressions = impressions + 1 WHERE id = _ad_id; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.track_ad(uuid, text) TO anon, authenticated;

ALTER TABLE public.videos ADD COLUMN boost_until timestamptz;

CREATE OR REPLACE FUNCTION public.recalc_trending(_video_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.videos; hrs double precision; base double precision; score double precision;
BEGIN
  SELECT * INTO v FROM public.videos WHERE id = _video_id;
  IF NOT FOUND THEN RETURN; END IF;
  hrs := greatest(extract(epoch FROM (now() - v.created_at)) / 3600.0, 1);
  base := v.views_count*0.5 + v.likes_count*3 + v.comments_count*5 + v.shares_count*8 + v.saves_count*6
        + v.avg_watch_percent*10 + v.completion_rate*15;
  score := base / power(hrs, 1.5);
  IF v.location ILIKE 'kampala%' THEN score := score * 1.3; END IF;
  IF v.boost_until IS NOT NULL AND v.boost_until > now() THEN score := score * 2; END IF;
  UPDATE public.videos SET trending_score = score, is_trending = score > 100 WHERE id = _video_id;
END $$;

CREATE OR REPLACE FUNCTION public.boost_video(_video_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.videos SET boost_until = now() + interval '1 hour' WHERE id = _video_id AND user_id = auth.uid();
  PERFORM public.recalc_trending(_video_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.boost_video(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boost_video(uuid) TO authenticated;