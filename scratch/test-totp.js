const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dGhmbmtnZmJ4dGpna3FwYndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzkxNDQsImV4cCI6MjA5NDQ1NTE0NH0._2UzfUZqy7P7W_9S8xpFWcz0K_pAykl4D8sdXghvbLM';

// Utilizziamo un'importazione dinamica di otpauth (che installeremo a runtime)
async function testTOTPFlow() {
  let OTPAuth;
  try {
    OTPAuth = require('otpauth');
  } catch (e) {
    console.log("Installazione di otpauth in corso...");
    const { execSync } = require('child_process');
    execSync('npm install otpauth', { stdio: 'inherit' });
    OTPAuth = require('otpauth');
  }

  const email = 'admin@accredita360.it';
  const password = 'admin';

  console.log("\n=== STEP 1: Richiesta di Login ===");
  const loginRes = await fetch(`${SUPABASE_URL}/functions/v1/login`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  console.log("Login Status:", loginRes.status);
  const loginData = await loginRes.json();
  console.log("Login Data:", JSON.stringify(loginData, null, 2));

  if (!loginData.requires_totp_setup) {
    console.error("Errore: ci si aspettava requires_totp_setup = true!");
    return;
  }

  const secret = loginData.secret;
  console.log(`Secret ottenuto: ${secret}`);

  console.log("\n=== STEP 2: Generazione Token TOTP ===");
  const totp = new OTPAuth.TOTP({
    issuer: 'Accredita360',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret)
  });
  const token = totp.generate();
  console.log(`Token generato per l'orario corrente: ${token}`);

  console.log("\n=== STEP 3: Verifica OTP per attivazione 2FA ===");
  const verifyRes = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, otp: token })
  });
  console.log("Verify Status:", verifyRes.status);
  const verifyData = await verifyRes.json();
  console.log("Verify Response:", JSON.stringify(verifyData, null, 2));

  console.log("\n=== STEP 4: Secondo Login (Dovrebbe richiedere totp standard, non setup) ===");
  const secondLoginRes = await fetch(`${SUPABASE_URL}/functions/v1/login`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  console.log("Second Login Status:", secondLoginRes.status);
  const secondLoginData = await secondLoginRes.json();
  console.log("Second Login Data:", JSON.stringify(secondLoginData, null, 2));
}

testTOTPFlow().catch(console.error);
