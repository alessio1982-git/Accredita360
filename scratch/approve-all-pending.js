const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dGhmbmtnZmJ4dGpna3FwYndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzkxNDQsImV4cCI6MjA5NDQ1NTE0NH0._2UzfUZqy7P7W_9S8xpFWcz0K_pAykl4D8sdXghvbLM';

async function approveAll() {
  // 1. Prendi tutti i pending
  const selectResp = await fetch(`${SUPABASE_URL}/rest/v1/users?registration_status=eq.pending`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const pendingUsers = await selectResp.json();
  console.log(`Trovati ${pendingUsers.length} utenti pendenti.`);

  // 2. Chiama l'Edge Function approve-user per ciascuno
  for (const user of pendingUsers) {
    console.log(`Approvazione utente: ${user.email} (ID: ${user.id})...`);
    const approveResp = await fetch(`${SUPABASE_URL}/functions/v1/approve-user?userId=${user.id}`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    console.log(`Risultato per ${user.email}: ${approveResp.status}`);
  }
  console.log("Completato.");
}

approveAll().catch(console.error);
