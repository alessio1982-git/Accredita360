const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dGhmbmtnZmJ4dGpna3FwYndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzkxNDQsImV4cCI6MjA5NDQ1NTE0NH0._2UzfUZqy7P7W_9S8xpFWcz0K_pAykl4D8sdXghvbLM';

async function run() {
    try {
        console.log("Registering new admin/consulente user...");
        const registerResp = await fetch(`${SUPABASE_URL}/functions/v1/register-user`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nome: 'Consulente',
                cognome: 'Demo',
                email: 'consulente.demo@accredita360.it',
                password: 'password123',
                telefono: '3331234567',
                role: 'admin'
            })
        });

        const regData = await registerResp.json();
        console.log("Registration Response:", regData);

        if (!regData.success || !regData.userId) {
            console.error("Registration failed:", regData.message);
            return;
        }

        const userId = regData.userId;
        console.log(`Approving user with ID: ${userId}...`);
        
        const approveResp = await fetch(`${SUPABASE_URL}/functions/v1/approve-user?userId=${userId}`, {
            method: 'GET'
        });

        const approveText = await approveResp.text();
        console.log("Approve response status:", approveResp.status);
        if (approveText.includes("success") || approveText.includes("Approvato")) {
            console.log("Admin user approved successfully!");
        } else {
            console.warn("Approve response did not contain success message. Response:", approveText);
        }

        // Set totp_enabled to false for the new admin user
        console.log("Updating totp_enabled to false for new admin user...");
        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.consulente.demo@accredita360.it`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'x-user-email': 'consulente.demo@accredita360.it',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                totp_enabled: false
            })
        });
        console.log("Patch Status:", patchRes.status);
        console.log("Patch Response:", await patchRes.text());

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
