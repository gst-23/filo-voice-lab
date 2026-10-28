// Solo laboratorio: non incollare qui le credenziali del Filo stabile.
window.FILO_CONFIG = { supabaseUrl: '', supabasePublishableKey: '', labLocalOnly: true };
// Funzione vocale deployata separatamente su Supabase Edge Functions.
// Per ragioni di sicurezza qui va solo l'URL pubblico della funzione, MAI la chiave Groq e MAI il codice d'accesso.
window.FILO_VOICE_SETTINGS = { functionUrl: 'https://gkkmqhpmkjwqjfkoxeka.supabase.co/functions/v1/filo-voice' };
