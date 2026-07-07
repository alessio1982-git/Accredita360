const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dGhmbmtnZmJ4dGpna3FwYndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzkxNDQsImV4cCI6MjA5NDQ1NTE0NH0._2UzfUZqy7P7W_9S8xpFWcz0K_pAykl4D8sdXghvbLM';

async function run() {
    try {
        console.log("Fetching users with RLS header (struttura@demo.it)...");
        const resUser = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.struttura@demo.it&select=email,role,stato_assegnazione,consulente_email_fk`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'x-user-email': 'struttura@demo.it'
            }
        });
        console.log("User Row:", await resUser.text());

        console.log("\nFetching consultants_public view...");
        const resView = await fetch(`${SUPABASE_URL}/rest/v1/consultants_public?select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        console.log("View Rows:", await resView.text());
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
