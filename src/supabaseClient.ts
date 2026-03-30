import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gvafdhyudvdymletqjee.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YWZkaHl1ZHZkeW1sZXRxamVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MzA0NzYsImV4cCI6MjA3NzUwNjQ3Nn0.PuoD-Mayi8cTscKG9CuQWA_qQU8x8lCeprI63jh5qCE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
