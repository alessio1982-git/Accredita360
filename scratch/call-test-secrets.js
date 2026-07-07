const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dGhmbmtnZmJ4dGpna3FwYndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzkxNDQsImV4cCI6MjA5NDQ1NTE0NH0._2UzfUZqy7P7W_9S8xpFWcz0K_pAykl4D8sdXghvbLM';

async function callTestSecrets() {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/test-secrets`, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Diagnostic Data:", JSON.stringify(data, null, 2));
}

callTestSecrets().catch(console.error);
