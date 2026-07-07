const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dGhmbmtnZmJ4dGpna3FwYndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzkxNDQsImV4cCI6MjA5NDQ1NTE0NH0._2UzfUZqy7P7W_9S8xpFWcz0K_pAykl4D8sdXghvbLM';

async function testPendingBlock() {
  const email = 'struttura@demo.it';
  const id = '8df7edbf-23c9-420c-9ad4-85766f8c5770';

  console.log("1. Imposto lo stato su pending...");
  // Nota: usiamo l'Edge function approve-user? No, approve-user la imposta ad active.
  // Possiamo impostarla a pending via REST? C'è la policy RLS per fare update?
  // C'è solo la policy per structures/requirements, ma proviamo via approve-user?
  // No, approve-user la imposta ad active. 
  // Per impostarla a pending possiamo scrivere una riga o provare un update REST.
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${email}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ registration_status: 'pending' })
  });
  console.log("Patch status:", patchRes.status);

  // Dal momento che RLS potrebbe bloccare l'update da anon, facciamo un tentativo.
  // Se non funziona, testiamo l'errore registrando un nuovo utente finto.
  const fintoEmail = `test.finto.${Date.now()}@example.com`;
  console.log(`2. Registro un utente finto di test: ${fintoEmail}`);
  const regRes = await fetch(`${SUPABASE_URL}/functions/v1/register-user`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      nome: 'Finto',
      cognome: 'Test',
      email: fintoEmail,
      password: 'password123',
      telefono: '3331234567',
      role: 'cliente'
    })
  });
  console.log("Reg status:", regRes.status);
  const regData = await regRes.json();
  console.log("Reg data:", regData);

  console.log("3. Tenterò il login con l'utente appena registrato (che nasce in stato pending)...");
  const loginRes = await fetch(`${SUPABASE_URL}/functions/v1/login`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: fintoEmail,
      password: 'password123'
    })
  });
  console.log("Login Status:", loginRes.status);
  const loginData = await loginRes.json();
  console.log("Login Response (dovrebbe essere bloccato):", loginData);
}

testPendingBlock().catch(console.error);
