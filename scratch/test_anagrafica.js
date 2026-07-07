const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dGhmbmtnZmJ4dGpna3FwYndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzkxNDQsImV4cCI6MjA5NDQ1NTE0NH0._2UzfUZqy7P7W_9S8xpFWcz0K_pAykl4D8sdXghvbLM';

async function testAnagrafica() {
    const userEmail = 'struttura@demo.it';
    const payload = {
        user_email: userEmail,
        tipo_titolare: 'fisica',
        codice_fiscale: 'RSSMRA80A01H501A',
        nome_struttura: 'POLIMEC',
        indirizzo_op: 'VIA LUCANIA',
        comune: 'PATTI',
        cap: '98066',
        pec: 'struttura.demo@pec.it',
        updated_at: new Date().toISOString()
    };

    console.log("Upserting anagrafica for structure@demo.it...");
    const resUpsert = await fetch(`${SUPABASE_URL}/rest/v1/anagrafiche`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal',
            'x-user-email': userEmail
        },
        body: JSON.stringify(payload)
    });
    console.log("Upsert status:", resUpsert.status);
    if (resUpsert.status >= 400) {
        console.error("Upsert error:", await resUpsert.text());
    }

    console.log("\nSelecting anagrafica for structure@demo.it...");
    const resSelect = await fetch(`${SUPABASE_URL}/rest/v1/anagrafiche?select=*&user_email=eq.${userEmail}`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'x-user-email': userEmail
        }
    });
    console.log("Select status:", resSelect.status);
    console.log("Select data:", await resSelect.text());
}

testAnagrafica().catch(console.error);
