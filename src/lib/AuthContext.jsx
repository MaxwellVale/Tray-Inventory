import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const AuthContext = createContext(null); // create a React context so that any component in the Provider can access the auth state (user login)

export function AuthProvider({ children }) {
    const [authUser, setAuthUser] = useState(null); // Tracking current user
    const [authLoading, setAuthLoading] = useState(true); // Tracking loading state

    useEffect( () => {
        async function loadSession() {
            const {
                data: { session },
            } = await supabase.auth.getSession(); // Check whether the browser already has a saved session

            setAuthUser(session?.user ?? null);
            setAuthLoading(false);
        }

        loadSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setAuthUser(session?.user ?? null);
            setAuthLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ authUser, authLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}