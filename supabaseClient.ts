// Fix: Use `import type` for SupabaseClient as it is used as a type, not a value. This resolves module resolution errors in some environments.
import { createClient, type SupabaseClient, AuthError } from '@supabase/supabase-js';

// Supabase credentials from environment variables.
const envUrlRaw = import.meta.env.VITE_SUPABASE_URL;
const envKeyRaw = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Use hardcoded fallbacks if environment variables are missing, empty, or clearly invalid
const envUrl = (envUrlRaw && envUrlRaw.trim() !== "" && envUrlRaw !== "undefined" && envUrlRaw.startsWith('http')) 
    ? envUrlRaw.trim() 
    : "https://htmuszgpxjkibeoygqns.supabase.co";

const envKey = (envKeyRaw && envKeyRaw.trim() !== "" && envKeyRaw !== "undefined") 
    ? envKeyRaw.trim() 
    : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0bXVzemdweGpraWJlb3lncW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjgyODEsImV4cCI6MjA4ODc0NDI4MX0.SlpkVqhLm_SsE2DQJjNy-TRmPx5giPgSXYyzygXYtYI";

console.log("[DEBUG] Using Supabase URL:", envUrl);
console.log("[DEBUG] Using Supabase Key:", envKey ? "Present" : "Missing");

const supabaseUrl = envUrl;
const supabaseAnonKey = envKey;

console.log("Supabase Config Source:", envUrl ? "Environment Variables" : "Hardcoded Fallback");
console.log("Supabase URL:", supabaseUrl);

// Singleton instance of the Supabase client.
let supabase: SupabaseClient | null = null;
let clientPromise: Promise<SupabaseClient | null> | null = null;

/**
 * Creates or retrieves a singleton Supabase client instance using hardcoded credentials.
 * @returns A Supabase client instance. Returns null if initialization fails.
 */
export async function getSupabaseClient(): Promise<SupabaseClient | null> {
    if (clientPromise) {
        return clientPromise;
    }

    clientPromise = (async () => {
        if (supabase) {
            // Check if the current session is still valid
            if (!supabase.auth) {
                console.warn("Supabase auth not available on existing client, re-initializing.");
                supabase = null;
            } else {
                let sessionResult;
                try {
                    sessionResult = await supabase.auth.getSession();
                    const { data: { session }, error } = sessionResult;
                    
                    if (error) {
                        console.warn("Supabase session error:", error.message);
                        // If the refresh token is invalid, we must clear it to allow a clean login
                        if (error.message.includes('Refresh Token Not Found') || error.message.includes('invalid_refresh_token')) {
                            console.error("Critical Auth Error: Refresh token is missing or invalid. Clearing storage.");
                            window.localStorage.removeItem('lawyer-app-auth-token');
                            supabase = null;
                            clientPromise = null;
                            return null;
                        }
                        supabase = null; // Force re-initialization for other errors
                    } else if (!session) {
                        console.warn("No active Supabase session found.");
                        supabase = null;
                    } else {
                        return supabase;
                    }
                } catch (sessionErr: any) {
                    console.error("Failed to get Supabase session:", sessionErr);
                    if (sessionErr.message?.includes('Refresh Token Not Found')) {
                        window.localStorage.removeItem('lawyer-app-auth-token');
                    }
                    supabase = null;
                    return null;
                }
            }
        }
        
        // If hardcoded credentials are not valid, throw an error.
        if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('http')) {
            const errorMsg = `Supabase credentials missing or invalid. URL: '${supabaseUrl}', Key: '${supabaseAnonKey ? '***' : 'MISSING'}'. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.`;
            console.error(errorMsg, { supabaseUrl: !!supabaseUrl, supabaseAnonKey: !!supabaseAnonKey });
            throw new Error(errorMsg);
        }

        if (supabaseUrl === "https://htmuszgpxjkibeoygqns.supabase.co") {
            console.warn("WARNING: Using hardcoded Supabase URL. This is likely not your project.");
        }

        // Create a new client instance.
        try {
            console.log("Initializing new Supabase client...");
            supabase = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    storageKey: 'lawyer-app-auth-token',
                    storage: {
                        getItem: (key: string) => {
                            if (typeof window === 'undefined') return null;
                            return window.localStorage.getItem(key);
                        },
                        setItem: (key: string, value: string) => {
                            if (typeof window === 'undefined') return;
                            window.localStorage.setItem(key, value);
                        },
                        removeItem: (key: string) => {
                            if (typeof window === 'undefined') return;
                            window.localStorage.removeItem(key);
                        },
                    },
                },
            });
            console.log("Supabase client initialized successfully.");
            return supabase;
        } catch (error: any) {
            console.error("Error creating Supabase client:", error);
            supabase = null; // Ensure supabase is null on failure
            clientPromise = null; // Reset promise on failure
            throw new Error(`فشل في تهيئة عميل Supabase: ${error.message || 'خطأ غير معروف'}`);
        }
    })();

    return clientPromise;
}

/**
 * Synchronously retrieves the singleton Supabase client instance.
 * Note: This may return null if the client hasn't been initialized yet via getSupabaseClient().
 * @returns The Supabase client instance or null.
 */
export function getSupabaseClientSync(): SupabaseClient | null {
    return supabase;
}
