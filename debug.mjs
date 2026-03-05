import { sql } from "@vercel/postgres";
try {
  const r = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position`;
  console.log("Users table:", JSON.stringify(r.rows));
  const u = await sql`SELECT * FROM users`;
  console.log("Users:", JSON.stringify(u.rows));
} catch(e) {
  console.error("Error:", e.message);
}
process.exit(0);
