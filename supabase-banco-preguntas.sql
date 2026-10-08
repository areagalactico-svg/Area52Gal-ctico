-- ============================================
-- Migración: Banco de preguntas anti-repetición
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- Cada pregunta generada por la IA se guarda aquí con su hash.
-- Las siguientes generaciones descartan hashes iguales y textos
-- con similitud >= 0.85 (pg_trgm), así ningún simulacro repite.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS banco_preguntas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  universidad TEXT NOT NULL DEFAULT 'UNI',
  texto TEXT NOT NULL,
  texto_norm TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  opciones JSONB DEFAULT '[]',
  respuesta_correcta INTEGER DEFAULT 0,
  opciones_hash TEXT DEFAULT '',
  numeros TEXT DEFAULT '',
  area TEXT DEFAULT '',
  subtema TEXT DEFAULT '',
  explicacion TEXT DEFAULT '',
  veces_usada INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banco_hash ON banco_preguntas (hash);
CREATE INDEX IF NOT EXISTS idx_banco_uni ON banco_preguntas (universidad);
CREATE INDEX IF NOT EXISTS idx_banco_opts ON banco_preguntas (opciones_hash, numeros);
CREATE INDEX IF NOT EXISTS idx_banco_trgm ON banco_preguntas USING gin (texto_norm gin_trgm_ops);

ALTER TABLE banco_preguntas ENABLE ROW LEVEL SECURITY;

-- Lectura pública (la API filtra duplicados con esto)
DROP POLICY IF EXISTS "Lectura publica banco" ON banco_preguntas;
CREATE POLICY "Lectura publica banco" ON banco_preguntas FOR SELECT USING (true);

-- Escritura solo admin (la API usa SERVICE_KEY, que salta el RLS)
DROP POLICY IF EXISTS "Admin insert banco" ON banco_preguntas;
CREATE POLICY "Admin insert banco" ON banco_preguntas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admin update banco" ON banco_preguntas;
CREATE POLICY "Admin update banco" ON banco_preguntas FOR UPDATE USING (auth.role() = 'authenticated');

-- Función de apoyo: ¿ya existe una pregunta igual o muy parecida?
CREATE OR REPLACE FUNCTION es_pregunta_duplicada(p_texto_norm TEXT, p_hash TEXT, p_universidad TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM banco_preguntas
    WHERE universidad = p_universidad
      AND (hash = p_hash OR similarity(texto_norm, p_texto_norm) >= 0.85)
    LIMIT 1
  );
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION es_pregunta_duplicada(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION es_pregunta_duplicada(TEXT, TEXT, TEXT) TO authenticated;
