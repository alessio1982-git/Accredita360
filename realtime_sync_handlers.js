/**
 * ACCREDITA360 — Logica JavaScript di Sincronizzazione Realtime
 * Integrazione per i 3 Pannelli (Utente, Consulente, Admin)
 */

/**
 * 1. FUNZIONE PANNELLO UTENTE: Listener Realtime per Cambio di Stato
 * Si mette in ascolto sulla tabella 'structures' in tempo reale.
 * Quando lo stato cambia in 'assegnata', esegue la callback di sblocco.
 * 
 * @param {string} userEmail - L'email dell'utente corrente (chiave per filtrare)
 * @param {function} onUnlocked - Callback eseguita quando lo stato diventa 'assegnata'
 */
function setupUserRealtimeListener(userEmail, onUnlocked) {
    if (!supabase) {
        console.error("Supabase client non inizializzato.");
        return;
    }

    console.log(`[Realtime] Sottoscrizione avviata per la struttura di: ${userEmail}`);

    const channel = supabase
        .channel('structures-status-changes')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'structures',
                filter: `user_email=eq.${userEmail}`
            },
            (payload) => {
                const updatedStruct = payload.new;
                console.log("[Realtime] Ricevuto aggiornamento struttura:", updatedStruct);

                if (updatedStruct && updatedStruct.stato === 'assegnata') {
                    console.log("[Realtime] 🎉 Pratica assegnata! Sblocco la Gap Analysis.");
                    if (typeof onUnlocked === 'function') {
                        onUnlocked(updatedStruct);
                    }
                    // Rimuove la sottoscrizione al canale una volta avvenuto lo sblocco per pulizia
                    supabase.removeChannel(channel);
                }
            }
        )
        .subscribe((status) => {
            console.log(`[Realtime] Stato canale structures: ${status}`);
        });

    return channel;
}

/**
 * 2. FUNZIONE PANNELLO AMMINISTRATORE: Assegnazione Pratica a Consulente
 * Aggiorna il consulente_id e sposta lo stato della pratica su 'assegnata'.
 * Gestisce la persistenza e intercetta gli errori.
 * 
 * @param {string} structureId - L'ID UUID della struttura da assegnare
 * @param {string} consultantId - L'ID UUID del consulente selezionato
 * @returns {Promise<boolean>}
 */
async function assignStructureToConsultant(structureId, consultantId) {
    try {
        if (!structureId || !consultantId) {
            throw new Error("ID struttura o ID consulente non validi.");
        }

        const { data, error } = await supabase
            .from('structures')
            .update({
                consulente_id: consultantId,
                stato: 'assegnata',
                updated_at: new Date().toISOString()
            })
            .eq('id', structureId)
            .select(); // Restituisce i dati salvati per conferma

        if (error) {
            console.error("[Backend Admin] Errore update assegnazione:", error);
            throw new Error(error.message || "Errore nel salvataggio dei dati su Supabase.");
        }

        if (!data || data.length === 0) {
            throw new Error("Nessuna struttura trovata con l'ID fornito per effettuare l'assegnazione.");
        }

        console.log("[Backend Admin] ✅ Assegnazione salvata con successo:", data[0]);
        return true;
    } catch (err) {
        console.error("[Backend Admin] ❌ Operazione fallita:", err.message);
        throw err; // Rigetta l'errore al frontend per mostrare la notifica
    }
}

/**
 * 3. FUNZIONE PANNELLO CONSULENTE: Recupero Strutture Assegnate
 * Seleziona le pratiche dal database filtrando in base all'ID del consulente loggato.
 * 
 * @param {string} loggedConsultantId - L'ID UUID del consulente attualmente loggato (auth.user().id)
 * @returns {Promise<Array>} Lista delle strutture assegnate
 */
async function getAssignedStructures(loggedConsultantId) {
    try {
        if (!loggedConsultantId) {
            throw new Error("ID consulente non valido o non autenticato.");
        }

        const { data, error } = await supabase
            .from('structures')
            .select('*')
            .eq('consulente_id', loggedConsultantId)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error("[Backend Consulente] Errore selezione strutture:", error);
            throw new Error(error.message || "Impossibile caricare le pratiche in carico.");
        }

        return data || [];
    } catch (err) {
        console.error("[Backend Consulente] ❌ Caricamento fallito:", err.message);
        return [];
    }
}
