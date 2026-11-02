import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gvafdhyudvdymletqjee.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YWZkaHl1ZHZkeW1sZXRxamVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkzMDQ3NiwiZXhwIjoyMDc3NTA2NDc2fQ.y_D64FZILeOCFwAbZZaN0TqFVcpD3VSE9nJWPt_ypCc";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  console.log("Checking tables...");
  const tables = ["documents", "case_documents", "profiles", "clients"];
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true });
      if (error) {
        console.log(`Table ${table}: Error ${error.code} - ${error.message}`);
      } else {
        console.log(`Table ${table}: EXISTS, Count: ${count}`);
      }
    } catch (e: any) {
      console.log(`Table ${table}: EXCEPTION ${e.message}`);
    }
  }

  console.log("\nChecking storage buckets...");
  const { data: buckets, error: b_error } =
    await supabase.storage.listBuckets();
  if (b_error) {
    console.log(`Buckets: Error ${b_error.message}`);
  } else {
    console.log(`Buckets: ${buckets.map((b) => b.name).join(", ")}`);
  }
}

checkTables();
