const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dGhmbmtnZmJ4dGpna3FwYndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzkxNDQsImV4cCI6MjA5NDQ1NTE0NH0._2UzfUZqy7P7W_9S8xpFWcz0K_pAykl4D8sdXghvbLM';

async function runTest() {
  console.log("=== TEST 1: Login admin ===");
  const loginRes = await fetch(`${SUPABASE_URL}/functions/v1/login`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'admin@accredita360.it',
      password: 'admin'
    })
  });
  console.log("Login Status:", loginRes.status);
  const loginData = await loginRes.json();
  console.log("Login Data:", JSON.stringify(loginData, null, 2));

  console.log("\n=== TEST 2: Send OTP (Resend) ===");
  const sendOtpRes = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'admin@accredita360.it',
      name: 'Ing. Marco Ferri'
    })
  });
  console.log("Send OTP Status:", sendOtpRes.status);
  const sendOtpData = await sendOtpRes.json();
  console.log("Send OTP Data:", JSON.stringify(sendOtpData, null, 2));
}

runTest().catch(console.error);
