import { supabase } from './supabase'

export async function signUpNewUser() {
    const { data, error } = await supabase.auth.signUp({
        email: 'valid.email@supabase.io',
        password: 'example-password',
        options: {
            emailRedirectTo: 'https://example.com/welcome',
        },
    })
}

export async function signInWithEmail(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw error;
    return data;
}

export async function signOutUser() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}
