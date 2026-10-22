# Filo Voice Lab - esperimento separato dalla versione stabile

Questo pacchetto e' una **copia sperimentale** di Filo v5, con microfono e assistente AI, e **non sostituisce Filo online**.

La versione stabile resta: https://gst-23.github.io/filo/

La prova (quando pubblicata in un repository separato) avra' un indirizzo come: https://gst-23.github.io/filo-voice-lab/

## Cosa puo' fare il laboratorio

- Registra dal microfono (con autorizzazione del browser; per la pubblicazione serve HTTPS, come GitHub Pages).
- Trascrive l'italiano con Whisper e interpreta il testo con un modello AI tramite Groq, usando una Supabase Edge Function.
- Propone **esclusivamente**: creare un'attivita', spostare la scadenza a una data precisa, rinviare di 1-30 giorni lavorativi, aggiungere sotto-attivita'.
- Mostra un'anteprima delle modifiche e richiede esplicitamente **Conferma modifiche** prima di salvarle.
- Non accetta comandi per eliminare task, eliminare sotto-attivita', cancellare allegati o eseguire codice.
- Offre una dimostrazione locale tramite **Esempio** anche prima di configurare un provider AI; questa dimostrazione **NON** chiama un modello.
- Conserva i dati nella memoria locale del browser, su chiavi diverse da quelle del Filo stabile. La configurazione inclusa contiene `labLocalOnly: true` per evitare accessi al database reale.

## 1 - Prova l'interfaccia senza collegare nulla

1. Estrai lo ZIP.
2. Crea **un nuovo repository GitHub, distinto da `filo`**, per esempio `filo-voice-lab`.
3. Carica nella radice del nuovo repository i file `index.html`, `app-voice-lab.js`, `voice-lab.js`, `styles-voice-lab.css`, `config.js`, `favicon.svg`, `.nojekyll` e `README.md`. La cartella `supabase` serve per il backend, puoi caricarla nello stesso repository.
4. In `Settings > Pages` imposta `Deploy from a branch`, branch `main`, cartella `/(root)`.
5. Apri `https://gst-23.github.io/filo-voice-lab/`. Premi il pulsante microfono e poi **Esempio**. Controlla l'anteprima e prova **Conferma modifiche**.

Nota: aprire `index.html` direttamente in un file locale non e' una prova affidabile delle API del microfono e del salvataggio. Usa GitHub Pages con HTTPS.

**Non caricare il contenuto dello ZIP nel repository `gst-23/filo`.**

## 2 - Attiva la parte AI gratuita (con limiti d'uso)

### Groq

1. Accedi a https://console.groq.com e crea un account.
2. Vai in `API Keys` e crea una chiave API Groq. Non incollarla in GitHub, `config.js` o nel browser.
3. Sul piano gratuito valgono i limiti di richieste e durata audio pubblicati da Groq; possono cambiare nel tempo: https://console.groq.com/docs/rate-limits.

### Supabase (meglio usare un progetto di prova distinto)

1. Dalla dashboard crea un **progetto Supabase separato**, per esempio `filo-voice-lab`.
2. Apri `Edge Functions > Deploy a new function > Via Editor` e crea una funzione chiamata **`filo-voice`**.
3. Incolla il contenuto di `supabase/functions/filo-voice/index.ts` nel suo editor e pubblicala. La funzione serve solo a trascrivere e interpretare: **non effettua scritture nel database**.
4. In `Edge Functions > Secrets` imposta due segreti:
   - `GROQ_API_KEY`: la chiave privata ricevuta da Groq.
   - `VOICE_ACCESS_CODE`: un codice casuale **lungo almeno 16-20 caratteri**, diverso da qualunque tua password.
5. La funzione deve essere distribuita con `verify_jwt = false` in quanto Filo e' senza autenticazione; il servizio AI e' comunque protetto dal codice vocale separato. Verifica che il setting sia effettivamente disattivato; il pacchetto include `supabase/config.toml` per la distribuzione tramite CLI. Non esporre il codice nel repository.
6. Alternativamente, con Supabase CLI (dopo `supabase login` e `supabase link --project-ref <LAB_PROJECT_REF>`), dalla cartella del progetto esegui `supabase functions deploy filo-voice --no-verify-jwt`. I segreti devono essere configurati nel progetto remoto prima della prova.
7. Copia l'URL della funzione, con la forma `https://<LAB_PROJECT_REF>.supabase.co/functions/v1/filo-voice`.

### Collegamento al sito Lab

1. Modifica **solo `config.js` del nuovo repository laboratorio**:

   ```js
   window.FILO_CONFIG = { supabaseUrl: '', supabasePublishableKey: '', labLocalOnly: true };
   window.FILO_VOICE_SETTINGS = {
     functionUrl: 'https://<LAB_PROJECT_REF>.supabase.co/functions/v1/filo-voice'
   };
   ```

2. Pubblica con `Commit changes` e apri il sito Lab.
3. Premi il microfono, autorizza la registrazione, premi **Ferma** e poi **Interpreta comando**.
4. Alla prima richiesta inserisci **il codice VOICE_ACCESS_CODE**, mai la chiave API Groq. Il codice rimane nella memoria della scheda fino alla fine della sessione.
5. Controlla la trascrizione e il piano proposto. Se non e' corretto, annulla o modifica il testo e rielaboralo.

## Esempi di comandi vocali

- "Crea un'attivita' chiamata chiamare il commercialista per domani."
- "Sposta la scadenza di inviare report a venerdi' prossimo."
- "Posticipa l'attivita' verificare il progetto di 3 giorni lavorativi."
- "Aggiungi una sotto-attivita' chiamata inviare preventivo alla voce chiamare cliente."
- "Crea un'attivita' chiamata preparare riunione per lunedi' prossimo e aggiungi una sotto-attivita' preparare la scaletta."

## Sicurezza e limitazioni

- Il sito Lab e' pubblico, ma i **dati demo sono locali**, in una chiave di memorizzazione distinta. Non inserire dati riservati: la piattaforma di partenza Filo senza login non e' progettata per quelli.
- L'audio registrato, il comando e alcuni **titoli e scadenze delle attivita'** vengono inviati al provider Groq tramite la Edge Function; **non** vengono inviati i file allegati o i contenuti delle note.
- Il codice vocale protegge il servizio AI da richieste anonime, ma **non sostituisce l'autenticazione completa**. Se usato da persone non autorizzate o diffuso accidentalmente, puo' consumare la quota gratuita. Non pubblicarlo.
- L'interpretazione puo' sbagliare: il passaggio di conferma umana e' obbligatorio. Se i titoli sono ambigui, l'assistente dovrebbe chiedere chiarimenti.
- I giorni lavorativi sono lunedi'-venerdi'; **non** sono escluse le festivita'.
- Massimo 45 secondi di registrazione, 8 MB di audio, 5 modifiche per comando; massimo 120 titoli nel contesto AI.
- Il backend non esegue direttamente azioni sul database: restituisce un piano JSON; il codice del sito valida operazioni e ID e poi usa gli stessi salvataggi di Filo.
- Le azioni multiple **non sono una transazione atomica**: un errore di connessione durante il salvataggio puo' lasciarne alcune applicate e le restanti no.
- Il piano gratuito di Groq e le quote Edge Functions Supabase sono soggetti a limiti e politiche correnti. Non garantiamo gratuità illimitata.
- Se dopo i test vuoi portare l'assistente nel Filo stabile, prima fai un backup ed esegui la migrazione in un aggiornamento distinto e controllato.

Documentazione: https://console.groq.com/docs/speech-to-text , https://console.groq.com/docs/structured-outputs , https://supabase.com/docs/guides/functions/quickstart-dashboard , https://supabase.com/docs/guides/functions/secrets.
