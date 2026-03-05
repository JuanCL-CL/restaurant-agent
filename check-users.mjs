import { sql } from "@vercel/postgres";
const { rows } = await sql`SELECT * FROM users`;
console.log(JSON.stringify(rows, null, 2));
const { rows: restaurants } = await sql`SELECT id, slug, name, owner_email FROM restaurants`;
console.log("\nRestaurants:");
console.log(JSON.stringify(restaurants, null, 2));
process.exit(0);
