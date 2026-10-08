-- ============================================
-- Migración: Agentes recolectores + Guías personalizadas
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- ============================================

-- 1) Tabla de guías personalizadas (una por estudiante+simulacro)
CREATE TABLE IF NOT EXISTS guias_personalizadas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estudiante_email TEXT NOT NULL,
  nombre_completo TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  universidad TEXT DEFAULT 'UNI',
  simulacro_id UUID REFERENCES simulacros_ien(id) ON DELETE SET NULL,
  nota NUMERIC(4,2) DEFAULT 0,
  puntaje NUMERIC(10,2) DEFAULT 0,
  area_results JSONB DEFAULT '{}',
  diagnostico TEXT DEFAULT '',
  focos JSONB DEFAULT '[]',
  plan JSONB DEFAULT '[]',
  guia_markdown TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(estudiante_email, simulacro_id)
);

ALTER TABLE guias_personalizadas ENABLE ROW LEVEL SECURITY;

-- Lectura/escritura vía API (service key la salta; anon solo inserta su guía)
DROP POLICY IF EXISTS "Estudiante insert guias" ON guias_personalizadas;
CREATE POLICY "Estudiante insert guias" ON guias_personalizadas FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admin select guias" ON guias_personalizadas;
CREATE POLICY "Admin select guias" ON guias_personalizadas FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Publica select own guia" ON guias_personalizadas;
CREATE POLICY "Publica select own guia" ON guias_personalizadas FOR SELECT USING (estudiante_email = auth.email());

-- 2) Trazabilidad de agentes: qué trajo cada corrida
CREATE TABLE IF NOT EXISTS agente_hallazgos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  universidad TEXT NOT NULL,
  titulo TEXT NOT NULL,
  url_pdf TEXT NOT NULL,
  url_fuente TEXT DEFAULT '',
  tipo TEXT DEFAULT 'examen_pasado',
  materia_sugerida TEXT DEFAULT 'General',
  guardado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agente_hallazgos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin all hallazgos" ON agente_hallazgos;
CREATE POLICY "Admin all hallazgos" ON agente_hallazgos FOR ALL USING (auth.role() = 'authenticated');

-- 3) Asegurar columna nota (por si el schema base no se migró)
ALTER TABLE simulacro_submissions ADD COLUMN IF NOT EXISTS nota NUMERIC(4,2) DEFAULT 0;

-- 4) Vista de mérito global: nombre, número, correo, nota y orden
CREATE OR REPLACE VIEW ranking_global AS
SELECT
  s.simulacro_id,
  sim.titulo AS simulacro_titulo,
  sim.universidad,
  s.estudiante_email AS correo,
  s.nombre_completo AS nombre,
  s.whatsapp AS numero,
  s.nota,
  s.puntaje,
  s.porcentaje,
  s.tiempo_segundos,
  s.fecha_fin,
  RANK() OVER (PARTITION BY s.simulacro_id ORDER BY s.nota DESC, s.puntaje DESC, s.tiempo_segundos ASC) AS orden_merito
FROM simulacro_submissions s
LEFT JOIN simulacros_ien sim ON sim.id = s.simulacro_id;

GRANT SELECT ON ranking_global TO anon;
GRANT SELECT ON ranking_global TO authenticated;
