// Fix: Use `import type` for SupabaseClient as it is used as a type, not a value. This resolves module resolution errors in some environments.
import { createClient, type SupabaseClient, AuthError } from '@supabase/supabase-js';
import { isNetworkError } from './hooks/useOnlineData.ts';

// Hardcoded Supabase credentials provided by the user.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Singleton instance of the Supabase client.
let supabase: SupabaseClient | null = null;
let clientPromise: Promise<SupabaseClient | null> | null = null;

/**
 * Creates or retrieves a singleton Supabase client instance using hardcoded credentials.
 * @returns A Supabase client instance. Returns null if initialization fails.
 */
export async function getSupabaseClient(): Promise<SupabaseClient | null> {
    if (clientPromise) {
        const client = await clientPromise;
        if (client) {
            // Check if the current session is still valid
            try {
                const { data: { session }, error } = await client.auth.getSession();
                if (!error && session) {
                    return client;
                }
                console.warn("Supabase session invalid or expired, clearing client promise.");
            } catch (e) {
                console.warn("Error checking Supabase session:", e);
            }
        }
        clientPromise = null; // Force re-initialization on next call
    }

    clientPromise = (async () => {
        // If hardcoded credentials are not valid, return null.
        if (!supabaseUrl || !supabaseAnonKey) {
            console.error("Supabase credentials are not defined in the code.");
            return null;
        }
 
        // Create a new client instance.
        try {
            console.log("Creating new Supabase client instance...");
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
                }
            });
            return supabase;
        } catch (error) {
            if (!isNetworkError(error)) {
                console.error("Error creating Supabase client:", error);
            } else {
                console.warn("Error creating Supabase client due to network issues.");
            }
            supabase = null; // Ensure supabase is null on failure
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
