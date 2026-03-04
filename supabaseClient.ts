// Fix: Use `import type` for SupabaseClient as it is used as a type, not a value. This resolves module resolution errors in some environments.
import { createClient, type SupabaseClient, AuthError } from '@supabase/supabase-js';

// Supabase credentials from environment variables.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "https://gvafdhyudvdymletqjee.supabase.co").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YWZkaHl1ZHZkeW1sZXRxamVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MzA0NzYsImV4cCI6MjA3NzUwNjQ3Nn0.PuoD-Mayi8cTscKG9CuQWA_qQU8x8lCeprI63jh5qCE").trim();

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
        
        // If hardcoded credentials are not valid, return null.
        if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('http')) {
            console.error("Supabase credentials are not defined correctly in the code.", { supabaseUrl: !!supabaseUrl, supabaseAnonKey: !!supabaseAnonKey });
            return null;
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
                global: {
                    fetch: (...args) => {
                        console.log("Supabase fetch:", args[0]);
                        return fetch(...args);
                    },
                }
            });
            console.log("Supabase client initialized successfully.");
            return supabase;
        } catch (error) {
            console.error("Error creating Supabase client:", error);
            supabase = null; // Ensure supabase is null on failure
            clientPromise = null; // Reset promise on failure
            return null;
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
