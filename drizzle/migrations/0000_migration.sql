CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text,
  bio text DEFAULT '',
  avatar_url text,
  followers_count int NOT NULL DEFAULT 0,
  following_count int NOT NULL DEFAULT 0,
  likes_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles own insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles own update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text;
BEGIN
  base := lower(regexp_replace(coalesce(split_part(NEW.email,'@',1),'user'),'[^a-z0-9_]','','g'));
  IF base = '' THEN base := 'user'; END IF;
  INSERT INTO public.profiles(id, username, display_name, avatar_url)
  VALUES (NEW.id, base || '_' || substr(NEW.id::text,1,4),
          coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', base),
          NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bunny_video_id text NOT NULL UNIQUE,
  bunny_cdn_url text NOT NULL,
  thumbnail_url text,
  caption text NOT NULL DEFAULT '',
  hashtags text[] NOT NULL DEFAULT '{}',
  location text DEFAULT 'Kampala',
  visibility text NOT NULL DEFAULT 'public',
  allow_comments boolean NOT NULL DEFAULT true,
  allow_duet boolean NOT NULL DEFAULT true,
  likes_count int NOT NULL DEFAULT 0,
  comments_count int NOT NULL DEFAULT 0,
  shares_count int NOT NULL DEFAULT 0,
  views_count int NOT NULL DEFAULT 0,
  saves_count int NOT NULL DEFAULT 0,
  watch_time_total double precision NOT NULL DEFAULT 0,
  avg_watch_percent double precision NOT NULL DEFAULT 0,
  completion_rate double precision NOT NULL DEFAULT 0,
  trending_score double precision NOT NULL DEFAULT 0,
  is_trending boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX videos_trending_idx ON public.videos(trending_score DESC);
CREATE INDEX videos_created_idx ON public.videos(created_at DESC);
GRANT SELECT ON public.videos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "videos public read" ON public.videos FOR SELECT USING (visibility = 'public' OR auth.uid() = user_id);
CREATE POLICY "videos own insert" ON public.videos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "videos own update" ON public.videos FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "videos own delete" ON public.videos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.likes (
  user_id uuid NOT NULL, video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, video_id));
GRANT SELECT ON public.likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes read" ON public.likes FOR SELECT USING (true);
CREATE POLICY "likes own insert" ON public.likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes own delete" ON public.likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.follows (
  follower_id uuid NOT NULL, following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (follower_id, following_id));
GRANT SELECT ON public.follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows read" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows own insert" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id AND follower_id <> following_id);
CREATE POLICY "follows own delete" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments read" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments own insert" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments own delete" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid,
  watch_duration double precision NOT NULL DEFAULT 0,
  watched_percent double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.video_views TO service_role;
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.trending_config (
  id int PRIMARY KEY DEFAULT 1,
  trending_enabled boolean NOT NULL DEFAULT true,
  boost_hashtags text[] NOT NULL DEFAULT '{}');
INSERT INTO public.trending_config(id) VALUES (1);
GRANT SELECT ON public.trending_config TO anon, authenticated;
GRANT ALL ON public.trending_config TO service_role;
ALTER TABLE public.trending_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config read" ON public.trending_config FOR SELECT USING (true);

-- Trending score
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
  UPDATE public.videos SET trending_score = score, is_trending = score > 100 WHERE id = _video_id;
END $$;

CREATE OR REPLACE FUNCTION public.recalc_all_trending() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.videos WHERE created_at > now() - interval '48 hours' LOOP
    PERFORM public.recalc_trending(r.id);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.recalc_all_trending() FROM PUBLIC, anon, authenticated;

-- Counter triggers
CREATE OR REPLACE FUNCTION public.on_like_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE vid uuid; owner uuid; d int;
BEGIN
  IF TG_OP = 'INSERT' THEN vid := NEW.video_id; d := 1; ELSE vid := OLD.video_id; d := -1; END IF;
  UPDATE public.videos SET likes_count = greatest(likes_count + d,0) WHERE id = vid RETURNING user_id INTO owner;
  UPDATE public.profiles SET likes_count = greatest(likes_count + d,0) WHERE id = owner;
  PERFORM public.recalc_trending(vid);
  RETURN NULL;
END $$;
CREATE TRIGGER likes_count_trg AFTER INSERT OR DELETE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.on_like_change();

CREATE OR REPLACE FUNCTION public.on_comment_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE vid uuid; d int;
BEGIN
  IF TG_OP = 'INSERT' THEN vid := NEW.video_id; d := 1; ELSE vid := OLD.video_id; d := -1; END IF;
  UPDATE public.videos SET comments_count = greatest(comments_count + d,0) WHERE id = vid;
  PERFORM public.recalc_trending(vid);
  RETURN NULL;
END $$;
CREATE TRIGGER comments_count_trg AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.on_comment_change();

CREATE OR REPLACE FUNCTION public.on_follow_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid; b uuid; d int;
BEGIN
  IF TG_OP = 'INSERT' THEN a := NEW.follower_id; b := NEW.following_id; d := 1; ELSE a := OLD.follower_id; b := OLD.following_id; d := -1; END IF;
  UPDATE public.profiles SET following_count = greatest(following_count + d,0) WHERE id = a;
  UPDATE public.profiles SET followers_count = greatest(followers_count + d,0) WHERE id = b;
  RETURN NULL;
END $$;
CREATE TRIGGER follows_count_trg AFTER INSERT OR DELETE ON public.follows FOR EACH ROW EXECUTE FUNCTION public.on_follow_change();

-- Public RPCs
CREATE OR REPLACE FUNCTION public.record_view(_video_id uuid, _watch_duration double precision, _watched_percent double precision)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pct double precision := least(greatest(_watched_percent,0),100);
DECLARE dur double precision := least(greatest(_watch_duration,0),600);
BEGIN
  INSERT INTO public.video_views(video_id, user_id, watch_duration, watched_percent) VALUES (_video_id, auth.uid(), dur, pct);
  UPDATE public.videos SET
    views_count = views_count + 1,
    watch_time_total = watch_time_total + dur,
    avg_watch_percent = (avg_watch_percent * views_count + pct) / (views_count + 1),
    completion_rate = (completion_rate * views_count + CASE WHEN pct >= 95 THEN 100 ELSE 0 END) / (views_count + 1)
  WHERE id = _video_id;
  PERFORM public.recalc_trending(_video_id);
END $$;
GRANT EXECUTE ON FUNCTION public.record_view(uuid, double precision, double precision) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_share(_video_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.videos SET shares_count = shares_count + 1 WHERE id = _video_id;
  PERFORM public.recalc_trending(_video_id);
END $$;
GRANT EXECUTE ON FUNCTION public.record_share(uuid) TO anon, authenticated;