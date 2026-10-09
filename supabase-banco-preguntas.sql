-- ============================================
-- Migración: Banco de preguntas anti-repetición
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- Evita que los simulacros repitan preguntas entre sí y por
-- estudiante: cada pregunta generada entra al banco con su hash;
-- las nuevas se comparan (exacto + similitud) antes de aceptarse.
-- ============================================

-- 1) Extensión de similitud de texto
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2) Banco central de preguntas
CREATE TABLE IF NOT EXISTS banco_preguntas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  universidad TEXT NOT NULL DEFAULT 'UNI',
  area TEXT DEFAULT '',
  subtema TEXT DEFAULT '',
  materia TEXT DEFAULT 'General',
  texto TEXT NOT NULL,
  texto_norm TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  opciones JSONB DEFAULT '[]',
  respuesta_correcta INTEGER DEFAULT 0,
  explicacion TEXT DEFAULT '',
  dificultad TEXT DEFAULT 'media',
  origen TEXT DEFAULT 'ia',
  veces_usada INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banco_uni ON banco_preguntas (universidad);
CREATE INDEX IF NOT EXISTS idx_banco_hash ON banco_preguntas (hash);
CREATE INDEX IF NOT EXISTS idx_banco_area ON banco_preguntas (universidad, area, subtema);
CREATE INDEX IF NOT EXISTS idx_banco_trgm ON banco_preguntas USING gin (texto_norm gin_trgm_ops);

ALTER TABLE banco_preguntas ENABLE ROW LEVEL SECURITY;

-- Lectura pública (como el resto de tablas de contenido)
DROP POLICY IF EXISTS "Lectura pública banco" ON banco_preguntas;
CREATE POLICY "Lectura pública banco" ON banco_preguntas FOR SELECT USING (true);
-- Escritura solo vía service key (la salta RLS) o admin autenticado
DROP POLICY IF EXISTS "Admin insert banco" ON banco_preguntas;
CREATE POLICY "Admin insert banco" ON banco_preguntas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admin update banco" ON banco_preguntas;
CREATE POLICY "Admin update banco" ON banco_preguntas FOR UPDATE USING (auth.role() = 'authenticated');

-- 3) Preguntas ya vistas por cada estudiante (para no repetírselas)
CREATE TABLE IF NOT EXISTS pregunta_vistas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estudiante_email TEXT NOT NULL,
  pregunta_id UUID REFERENCES banco_preguntas(id) ON DELETE CASCADE,
  simulacro_id UUID REFERENCES simulacros_ien(id) ON DELETE SET NULL,
  fue_correcta BOOLEAN DEFAULT NULL,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(estudiante_email, pregunta_id)
);

CREATE INDEX IF NOT EXISTS idx_vistas_email ON pregunta_vistas (estudiante_email);

ALTER TABLE pregunta_vistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Server insert vistas" ON pregunta_vistas;
CREATE POLICY "Server insert vistas" ON pregunta_vistas FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Estudiante select own vistas" ON pregunta_vistas;
CREATE POLICY "Estudiante select own vistas" ON pregunta_vistas FOR SELECT USING (estudiante_email = auth.email());
DROP POLICY IF EXISTS "Admin select vistas" ON pregunta_vistas;
CREATE POLICY "Admin select vistas" ON pregunta_vistas FOR SELECT USING (auth.role() = 'authenticated');

-- 4) RPC: buscar preguntas similares (capa semántica, umbral 0.85)
CREATE OR REPLACE FUNCTION buscar_preguntas_similares(p_universidad TEXT, p_texto TEXT, p_umbral FLOAT DEFAULT 0.85)
RETURNS TABLE(id UUID, texto TEXT, similitud FLOAT)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT b.id, b.texto, similarity(b.texto_norm, p_texto) AS sim
  FROM banco_preguntas b
  WHERE b.universidad = p_universidad
    AND similarity(b.texto_norm, p_texto) >= p_umbral
  ORDER BY sim DESC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION buscar_preguntas_similares(TEXT, TEXT, FLOAT) TO anon;
GRANT EXECUTE ON FUNCTION buscar_preguntas_similares(TEXT, TEXT, FLOAT) TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_preguntas_similares(TEXT, TEXT, FLOAT) TO service_role;
