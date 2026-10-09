-- ============================================
-- Migración: Banco de preguntas anti-repetición
-- Ejecutar en Supabase SQL Editor (SEGURA DE RE-EJECUTAR: todo es
-- IF NOT EXISTS / OR REPLACE, no borra datos existentes).
-- Cada pregunta generada por la IA se guarda aquí con su hash.
-- Las siguientes generaciones descartan hashes iguales, mismas
-- opciones+números, y textos con similitud >= 0.85 (pg_trgm):
-- ningún simulacro repite preguntas.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) Banco central
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

-- Columnas extra (para guías y reportes): solo si faltan
ALTER TABLE banco_preguntas ADD COLUMN IF NOT EXISTS materia TEXT DEFAULT 'General';
ALTER TABLE banco_preguntas ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'ia';
ALTER TABLE banco_preguntas ADD COLUMN IF NOT EXISTS dificultad TEXT DEFAULT 'media';

CREATE INDEX IF NOT EXISTS idx_banco_hash ON banco_preguntas (hash);
CREATE INDEX IF NOT EXISTS idx_banco_uni ON banco_preguntas (universidad);
CREATE INDEX IF NOT EXISTS idx_banco_opts ON banco_preguntas (opciones_hash, numeros);
CREATE INDEX IF NOT EXISTS idx_banco_area ON banco_preguntas (universidad, area, subtema);
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

-- 2) Preguntas ya vistas por cada estudiante (memoria servidor,
-- complementa la memoria local del navegador)
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

-- 3) Función de apoyo: ¿ya existe una pregunta igual o muy parecida?
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

-- 4) RPC alternativo: top-5 similares (para diagnósticos del admin)
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
