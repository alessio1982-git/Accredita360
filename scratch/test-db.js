const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dGhmbmtnZmJ4dGpna3FwYndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzkxNDQsImV4cCI6MjA5NDQ1NTE0NH0._2UzfUZqy7P7W_9S8xpFWcz0K_pAykl4D8sdXghvbLM';

async function testDB() {
  const email = `dummy.test.rls@example.com`;
  
  // 1. Inserisco utente
  console.log("Inserisco utente dummy...");
  const userResp = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      email: email,
      password: 'password123',
      name: 'Dummy',
      role: 'cliente',
      registration_status: 'active'
    })
  });
  console.log("Status inserimento utente:", userResp.status);
  const userData = await userResp.json();
  console.log("Dati utente:", userData);
  
  // 2. Inserisco struttura dummy
  console.log("\nInserisco struttura dummy...");
  const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/structures`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      user_email: email,
      type: 'poliambulatorio',
      data: { global_status: 'IN_CORSO' }
    })
  });
  
  console.log("Status inserimento struttura:", insertResp.status);
  const insertData = await insertResp.json();
  console.log("Dati struttura:", insertData);
  
  // 3. Seleziono la struttura
  console.log("\nSeleziono la struttura...");
  const selectResp = await fetch(`${SUPABASE_URL}/rest/v1/structures?user_email=eq.${encodeURIComponent(email)}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  console.log("Status selezione struttura:", selectResp.status);
  const selectData = await selectResp.json();
  console.log("Dati selezionati struttura:", selectData);
  
  // 4. Aggiorno la struttura
  console.log("\nAggiorno la struttura...");
  const updateResp = await fetch(`${SUPABASE_URL}/rest/v1/structures?user_email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      data: { global_status: 'CERTIFIED_AND_APPROVED' }
    })
  });
  console.log("Status aggiornamento struttura:", updateResp.status);
  const updateData = await updateResp.json();
  console.log("Dati aggiornati struttura:", updateData);
  
  // Cleanup
  console.log("\nElimino la struttura dummy...");
  await fetch(`${SUPABASE_URL}/rest/v1/structures?user_email=eq.${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  console.log("Elimino utente dummy...");
  await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  console.log("Fatto.");
}

testDB().catch(console.error);
