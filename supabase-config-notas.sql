-- ============================================
-- Migración: Interruptor global "Ocultar notas"
-- Ejecutar en Supabase SQL Editor (idempotente).
-- El admin alterna la clave 'notas_ocultas' en config_plataforma;
-- los estudiantes no ven nota, mérito, solucionario, estrategia,
-- evolución ni calculadora mientras esté en 'true'.
-- ============================================

CREATE TABLE IF NOT EXISTS config_plataforma (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estado inicial: notas visibles
INSERT INTO config_plataforma (clave, valor, updated_at)
VALUES ('notas_ocultas', 'false', NOW())
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE config_plataforma ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica config" ON config_plataforma;
CREATE POLICY "Lectura publica config" ON config_plataforma FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin update config" ON config_plataforma;
CREATE POLICY "Admin update config" ON config_plataforma FOR UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admin insert config" ON config_plataforma;
CREATE POLICY "Admin insert config" ON config_plataforma FOR INSERT WITH CHECK (auth.role() = 'authenticated');
