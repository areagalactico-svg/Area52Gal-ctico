import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://tnqjjydmlruzcxlzeurt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWpqeWRtbHJ1emN4bHpldXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njc1NjIsImV4cCI6MjEwMzU0MzU2Mn0.RHWZx-PKCf-ekJ501T1VXkHzEynMXrx2Irc0e0K3FlE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_EMAIL = "areagalactico@gmail.com";

export { supabase, ADMIN_EMAIL };
