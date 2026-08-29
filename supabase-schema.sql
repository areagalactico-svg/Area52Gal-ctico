-- ============================================
-- Schema para Área 52 UNI - Supabase
-- Ejecuta este SQL en el SQL Editor de Supabase
-- ============================================

-- Tabla: Test Vocacionales
CREATE TABLE test_vocacionales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  preguntas JSONB DEFAULT '[]',
  fecha TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: Simulacros IEN
CREATE TABLE simulacros_ien (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  duracion INTEGER DEFAULT 60,
  preguntas JSONB DEFAULT '[]',
  archivos JSONB DEFAULT '[]',
  fecha TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: Videos
CREATE TABLE videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  url_youtube TEXT,
  categoria TEXT,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: Temarios
CREATE TABLE temarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  curso TEXT,
  contenido TEXT,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: Exámenes Pasados
CREATE TABLE examenes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  year INTEGER,
  materia TEXT,
  archivos JSONB DEFAULT '[]',
  fecha TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: Materiales de Referencia para IA
CREATE TABLE materiales_referencia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  materia TEXT,
  descripcion TEXT,
  archivos JSONB DEFAULT '[]',
  fecha TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: Contactos
CREATE TABLE contactos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT,
  email TEXT,
  telefono TEXT,
  mensaje TEXT,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: Newsletter
CREATE TABLE newsletter (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Storage Buckets (ejecutar después)
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('examenes', 'examenes', true),
  ('simulacros', 'simulacros', true),
  ('materiales', 'materiales', true);

-- ============================================
-- RLS (Row Level Security) Policies
-- ============================================

-- Permitir lectura pública a todas las tablas
ALTER TABLE test_vocacionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulacros_ien ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE temarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE examenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiales_referencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública
CREATE POLICY "Lectura pública test_vocacionales" ON test_vocacionales FOR SELECT USING (true);
CREATE POLICY "Lectura pública simulacros_ien" ON simulacros_ien FOR SELECT USING (true);
CREATE POLICY "Lectura pública videos" ON videos FOR SELECT USING (true);
CREATE POLICY "Lectura pública temarios" ON temarios FOR SELECT USING (true);
CREATE POLICY "Lectura pública examenes" ON examenes FOR SELECT USING (true);
CREATE POLICY "Lectura pública materiales_referencia" ON materiales_referencia FOR SELECT USING (true);

-- Políticas de escritura solo para autenticados (admin)
CREATE POLICY "Admin insert test_vocacionales" ON test_vocacionales FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin update test_vocacionales" ON test_vocacionales FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete test_vocacionales" ON test_vocacionales FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Admin insert simulacros_ien" ON simulacros_ien FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin update simulacros_ien" ON simulacros_ien FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete simulacros_ien" ON simulacros_ien FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Admin insert videos" ON videos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin update videos" ON videos FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete videos" ON videos FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Admin insert temarios" ON temarios FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin update temarios" ON temarios FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete temarios" ON temarios FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Admin insert examenes" ON examenes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin update examenes" ON examenes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete examenes" ON examenes FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Admin insert materiales_referencia" ON materiales_referencia FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin update materiales_referencia" ON materiales_referencia FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete materiales_referencia" ON materiales_referencia FOR DELETE USING (auth.role() = 'authenticated');

-- Contactos: cualquiera puede insertar, solo admin puede leer/borrar
CREATE POLICY "Cualquiera insert contactos" ON contactos FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin select contactos" ON contactos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin delete contactos" ON contactos FOR DELETE USING (auth.role() = 'authenticated');

-- Newsletter: cualquiera puede insertar
CREATE POLICY "Cualquiera insert newsletter" ON newsletter FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin select newsletter" ON newsletter FOR SELECT USING (auth.role() = 'authenticated');

-- Políticas de Storage
CREATE POLICY "Lectura pública archivos" ON storage.objects FOR SELECT USING (bucket_id IN ('examenes', 'simulacros', 'materiales'));
CREATE POLICY "Admin upload archivos" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('examenes', 'simulacros', 'materiales') AND auth.role() = 'authenticated');
CREATE POLICY "Admin delete archivos" ON storage.objects FOR DELETE USING (bucket_id IN ('examenes', 'simulacros', 'materiales') AND auth.role() = 'authenticated');
