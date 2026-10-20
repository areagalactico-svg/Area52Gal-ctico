-- ============================================
-- Migración: Módulos Tutor IA (Clonador + Plan semanal + Auditoría)
-- Ejecutar en Supabase SQL Editor (SEGURA DE RE-EJECUTAR: todo es
-- IF NOT EXISTS / OR REPLACE, no borra datos existentes).
--
-- 1) pregunta_clones  → clonador infinito de problemas (práctica
--    deliberada, FUERA del banco anti-repetición para no bloquear
--    preguntas nuevas de simulacro).
-- 2) planes_semanales → plan de estudio lunes-domingo generado por IA
--    y visible para el profesor.
-- 3) estrategia_auditoria → auditoría de estrategia por simulacro
--    (orden de ataque, tiempo mal invertido, escenarios what-if).
-- ============================================

-- 1) CLOTADOR INFINITO DE PROBLEMAS ----------------------------
CREATE TABLE IF NOT EXISTS pregunta_clones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  universidad TEXT NOT NULL DEFAULT 'UNI',
  original_texto TEXT NOT NULL,
  texto TEXT NOT NULL,
  texto_norm TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL DEFAULT '',
  opciones JSONB DEFAULT '[]',
  respuesta_correcta INTEGER DEFAULT 0,
  explicacion TEXT DEFAULT '',
  pasos JSONB DEFAULT '[]',
  area TEXT DEFAULT '',
  subtema TEXT DEFAULT '',
  nivel TEXT DEFAULT 'igual', -- facil | igual | dificil
  estudiante_email TEXT DEFAULT 'anonimo',
  veces_usada INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clones_uni ON pregunta_clones (universidad, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clones_hash ON pregunta_clones (hash);
CREATE INDEX IF NOT EXISTS idx_clones_email ON pregunta_clones (estudiante_email);

ALTER TABLE pregunta_clones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica clones" ON pregunta_clones;
CREATE POLICY "Lectura publica clones" ON pregunta_clones FOR SELECT USING (true);
DROP POLICY IF EXISTS "Insert clones" ON pregunta_clones;
CREATE POLICY "Insert clones" ON pregunta_clones FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Update clones admin" ON pregunta_clones;
CREATE POLICY "Update clones admin" ON pregunta_clones FOR UPDATE USING (auth.role() = 'authenticated');

-- 2) PLAN SEMANAL DINÁMICO -------------------------------------
CREATE TABLE IF NOT EXISTS planes_semanales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estudiante_email TEXT NOT NULL,
  universidad TEXT NOT NULL DEFAULT 'UNI',
  semana_inicio DATE NOT NULL,          -- lunes de la semana
  plan_markdown TEXT DEFAULT '',
  areas_snapshot JSONB DEFAULT '[]',
  dias_faltan INTEGER DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (estudiante_email, semana_inicio)
);

CREATE INDEX IF NOT EXISTS idx_planes_email ON planes_semanales (estudiante_email, semana_inicio DESC);

ALTER TABLE planes_semanales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Estudiante select planes" ON planes_semanales;
CREATE POLICY "Estudiante select planes" ON planes_semanales FOR SELECT USING (estudiante_email = auth.email());
DROP POLICY IF EXISTS "Insert planes" ON planes_semanales;
CREATE POLICY "Insert planes" ON planes_semanales FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admin select planes" ON planes_semanales;
CREATE POLICY "Admin select planes" ON planes_semanales FOR SELECT USING (auth.role() = 'authenticated');

-- 3) AUDITORÍA DE ESTRATEGIA DE SIMULACRO ----------------------
CREATE TABLE IF NOT EXISTS estrategia_auditoria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estudiante_email TEXT NOT NULL DEFAULT 'anonimo',
  simulacro_id UUID REFERENCES simulacros_ien(id) ON DELETE SET NULL,
  universidad TEXT NOT NULL DEFAULT 'UNI',
  nota DECIMAL(4,2) DEFAULT 0,
  nota_sin_penalizacion DECIMAL(4,2) DEFAULT 0,
  hallazgos JSONB DEFAULT '[]',
  escenarios JSONB DEFAULT '[]',
  orden_ataque JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estrategia_email ON estrategia_auditoria (estudiante_email, created_at DESC);

ALTER TABLE estrategia_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Insert estrategia" ON estrategia_auditoria;
CREATE POLICY "Insert estrategia" ON estrategia_auditoria FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Estudiante select estrategia" ON estrategia_auditoria;
CREATE POLICY "Estudiante select estrategia" ON estrategia_auditoria FOR SELECT USING (estudiante_email = auth.email());
DROP POLICY IF EXISTS "Admin select estrategia" ON estrategia_auditoria;
CREATE POLICY "Admin select estrategia" ON estrategia_auditoria FOR SELECT USING (auth.role() = 'authenticated');

-- 4) Vistas de error por subtema (apoyo al diagnóstico del plan)
CREATE OR REPLACE VIEW errores_por_subtema AS
SELECT
  v.estudiante_email,
  COALESCE(b.subtema, b.area, 'General') AS subtema,
  COALESCE(b.area, '') AS area,
  COUNT(*) AS fallas,
  MAX(v.fecha) AS ultima_fecha
FROM pregunta_vistas v
JOIN banco_preguntas b ON b.id = v.pregunta_id
WHERE v.fue_correcta = false
GROUP BY v.estudiante_email, COALESCE(b.subtema, b.area, 'General'), COALESCE(b.area, '');

GRANT SELECT ON errores_por_subtema TO anon;
GRANT SELECT ON errores_por_subtema TO authenticated;
GRANT SELECT ON errores_por_subtema TO service_role;
