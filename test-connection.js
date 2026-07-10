const postgres = require('postgres');
require('dotenv').config();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Please add it to your .env file.');
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });

  try {
    const result = await sql`SELECT NOW() AS current_time`;
    console.log('Connection successful.');
    console.log(result[0]);
  } catch (error) {
    console.error('Connection failed.');
    console.error(error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
