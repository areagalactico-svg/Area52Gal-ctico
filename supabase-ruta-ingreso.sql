-- ============================================
-- Migración: Ruta de ingreso por universidad
-- Ejecutar en Supabase SQL Editor (idempotente).
-- El admin carga fecha de examen, vacantes y puntaje referencial;
-- el estudiante los ve en la pestaña Ingreso con checklist y
-- calculadora de probabilidad.
-- ============================================

CREATE TABLE IF NOT EXISTS datos_ingreso (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  universidad TEXT NOT NULL UNIQUE,
  fecha_examen DATE DEFAULT NULL,
  vacantes TEXT DEFAULT '',
  puntaje_referencial NUMERIC(5,2) DEFAULT NULL,
  fecha_limite_pago DATE DEFAULT NULL,
  link_info TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE datos_ingreso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública ingreso" ON datos_ingreso;
CREATE POLICY "Lectura pública ingreso" ON datos_ingreso FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin insert ingreso" ON datos_ingreso;
CREATE POLICY "Admin insert ingreso" ON datos_ingreso FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admin update ingreso" ON datos_ingreso;
CREATE POLICY "Admin update ingreso" ON datos_ingreso FOR UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admin delete ingreso" ON datos_ingreso;
CREATE POLICY "Admin delete ingreso" ON datos_ingreso FOR DELETE USING (auth.role() = 'authenticated');
