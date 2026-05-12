import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// 🔐 CONFIG SUPABASE
const supabaseUrl = "https://smibbddmwgdmqpwsuaqr.supabase.co";

const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtaWJiZGRtd2dkbXFwd3N1YXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzODc1NzYsImV4cCI6MjA4NTk2MzU3Nn0.S3Z4m8s_nHa_reulKMFH1RtqoUgh9Cqzj69H0WTbghk";

// 🚀 CLIENTE
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
