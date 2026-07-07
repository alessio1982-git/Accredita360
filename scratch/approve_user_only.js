const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dGhmbmtnZmJ4dGpna3FwYndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzkxNDQsImV4cCI6MjA5NDQ1NTE0NH0._2UzfUZqy7P7W_9S8xpFWcz0K_pAykl4D8sdXghvbLM';

async function run() {
    try {
        const userId = 'cfb2562a-da6d-4eff-a208-f4e1f3eaea90'; // User ID of consulente.demo@accredita360.it
        console.log(`Approving user with ID: ${userId}...`);
        
        const approveResp = await fetch(`${SUPABASE_URL}/functions/v1/approve-user?userId=${userId}`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        const approveText = await approveResp.text();
        console.log("Approve response status:", approveResp.status);
        console.log("Approve response body:", approveText);

        // Verify user state
        console.log("Verifying user state in DB...");
        const res = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.consulente.demo@accredita360.it&select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'x-user-email': 'consulente.demo@accredita360.it'
            }
        });
        console.log("User in DB:", await res.text());

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
