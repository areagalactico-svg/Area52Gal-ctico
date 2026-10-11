-- Portada personalizable para videos (YouTube, TikTok o enlaces)
ALTER TABLE videos ADD COLUMN IF NOT EXISTS portada_url TEXT DEFAULT '';
