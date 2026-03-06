const fs = require('fs');
const { neon } = require('@neondatabase/serverless');
const envContent = fs.readFileSync('.env.local', 'utf-8');
const pgUrl = envContent.match(/^POSTGRES_URL=(.+)$/m)[1].replace(/"/g, '');
const sql = neon(pgUrl);
sql`UPDATE restaurants SET vapi_assistant_id = ${"18eca676-2b0c-4963-be5f-8f9a8b9e72d9"} WHERE id = ${"test-for-template"}`.then(() => console.log("Updated ✓")).catch(console.error);
