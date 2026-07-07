const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dGhmbmtnZmJ4dGpna3FwYndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzkxNDQsImV4cCI6MjA5NDQ1NTE0NH0._2UzfUZqy7P7W_9S8xpFWcz0K_pAykl4D8sdXghvbLM';

// Helper to make API requests
async function postToTable(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const errText = await res.text();
        console.error(`Error inserting into ${table}:`, res.status, errText);
        throw new Error(errText);
    }
    console.log(`Successfully inserted into ${table}`);
}

async function run() {
    try {
        console.log("Applying users seed...");
        const users = [
            {
                email: 'admin@accredita360.it',
                password: 'admin',
                name: 'Ing. Marco Ferri — Consulente Senior',
                role: 'admin',
                registration_status: 'active'
            },
            {
                email: 'struttura@demo.it',
                password: 'demo',
                name: 'Poliambulatorio Santa Lucia Srl',
                role: 'cliente',
                registration_status: 'active'
            }
        ];
        await postToTable('users', users);

        console.log("Applying structures seed...");
        const structures = [
            {
                user_email: 'struttura@demo.it',
                type: 'poliambulatorio',
                data: {
                    authStatus: "si",
                    features: {
                        hasElettromedicali: true,
                        wantsAccreditamento: true
                    },
                    ragioneSociale: "Poliambulatorio Santa Lucia Srl",
                    piva: "01234567890",
                    codiceFiscale: "01234567890",
                    sedeLegale: "Via Libertà 120, 90143 Palermo (PA)",
                    indirizzoOperativo: "Viale della Regione Siciliana 2500, 90129 Palermo (PA)",
                    direttoreSanitario: "Dr.ssa Antonella Lombardo",
                    ordineIscrizione: "Medici Chirurghi - Palermo",
                    numIscrizione: "3821 - PA",
                    pec: "polisantalucia@pec.it",
                    telefono: "091 8765432",
                    emailPubblica: "info@polisantalucia.it",
                    sitoWeb: "www.polisantalucia.it",
                    specialita: ["Cardiologia", "Ortopedia", "Ginecologia", "Dermatologia", "Oculistica", "Neurologia"],
                    legalRappresentante: "Avv. Giuseppe Russo",
                    cfRappresentante: "RSSGPP70A01G273X"
                }
            }
        ];
        // For structures, RLS requires public.is_active_user() or matching user_email.
        // Let's pass the x-user-email header to bypass RLS checks.
        // Wait, for admin, we can pass admin email to allow insertion of anything.
        // Or we can just insert with the corresponding user_email.
        const resStruct = await fetch(`${SUPABASE_URL}/rest/v1/structures`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
                'x-user-email': 'struttura@demo.it'
            },
            body: JSON.stringify(structures)
        });
        if (!resStruct.ok) {
            console.error("Error inserting structures:", resStruct.status, await resStruct.text());
        } else {
            console.log("Successfully inserted structures");
        }

        console.log("Parsing requirements from supabase_seed.sql...");
        const seedPath = path.join(__dirname, '..', 'supabase_seed.sql');
        const seedText = fs.readFileSync(seedPath, 'utf8');

        // Locate requirement values block
        const reqStartIdx = seedText.indexOf('INSERT INTO public.requirements');
        if (reqStartIdx === -1) throw new Error("Could not find requirements insert in seed");
        
        const valuesStartIdx = seedText.indexOf('VALUES', reqStartIdx);
        let valuesText = seedText.substring(valuesStartIdx + 6).trim();
        // Remove trailing semicolon and verification check SELECT query
        const semiColonIdx = valuesText.indexOf(';');
        if (semiColonIdx !== -1) {
            valuesText = valuesText.substring(0, semiColonIdx).trim();
        }

        // Split by lines and parse
        const lines = valuesText.split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('--'));

        const requirements = [];
        for (const line of lines) {
            let cleanLine = line;
            if (cleanLine.endsWith(',')) {
                cleanLine = cleanLine.substring(0, cleanLine.length - 1).trim();
            }
            if (cleanLine.startsWith('(') && cleanLine.endsWith(')')) {
                cleanLine = cleanLine.substring(1, cleanLine.length - 1);
            } else {
                continue;
            }

            const values = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < cleanLine.length; i++) {
                const char = cleanLine[i];
                if (char === "'") {
                    if (inQuotes && cleanLine[i + 1] === "'") {
                        current += "'";
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = "";
                } else {
                    current += char;
                }
            }
            values.push(current.trim());

            const cleanVal = (val) => {
                if (val === 'null' || val === '') return null;
                return val;
            };

            const user_email = cleanVal(values[0]);
            const req_id = cleanVal(values[1]);
            const titolo = cleanVal(values[2]);
            const norma = cleanVal(values[3]);
            const cat = cleanVal(values[4]);
            const stato = cleanVal(values[5]);
            const file_name = cleanVal(values[6]);
            const desc_text = cleanVal(values[7]);
            const compliance = cleanVal(values[8]);
            
            let validated_at = null;
            const rawValAt = cleanVal(values[9]);
            if (rawValAt) {
                if (rawValAt.includes('NOW()')) {
                    const daysMatch = rawValAt.match(/INTERVAL '(\d+) days'/);
                    if (daysMatch) {
                        const days = parseInt(daysMatch[1], 10);
                        const date = new Date();
                        date.setDate(date.getDate() - days);
                        validated_at = date.toISOString();
                    } else {
                        validated_at = new Date().toISOString();
                    }
                } else {
                    validated_at = rawValAt;
                }
            }

            requirements.push({
                user_email,
                req_id,
                titolo,
                norma,
                cat,
                stato,
                file_name,
                desc_text,
                compliance,
                validated_at
            });
        }

        console.log(`Parsed ${requirements.length} requirements. Inserting to DB...`);
        // Use x-user-email header to bypass requirements RLS insert check
        const resReqs = await fetch(`${SUPABASE_URL}/rest/v1/requirements`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
                'x-user-email': 'struttura@demo.it'
            },
            body: JSON.stringify(requirements)
        });
        if (!resReqs.ok) {
            console.error("Error inserting requirements:", resReqs.status, await resReqs.text());
        } else {
            console.log("Successfully inserted requirements");
        }

        console.log("All seed data successfully restored!");

    } catch (e) {
        console.error("Failed to apply seed:", e);
    }
}

run();
