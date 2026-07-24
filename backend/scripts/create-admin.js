'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const pool = require('../db');

async function main() {
  if (!['1', 'true'].includes(process.env.ALLOW_SCHEMA_MIGRATION || '')) {
    throw new Error('Explicit bootstrap acknowledgement is required');
  }
  const email = (process.env.PROVISION_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.PROVISION_ADMIN_PASSWORD || '';
  if (!email || password.length < 12) {
    throw new Error('Admin email and a 12+ character password are required');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (email, password, full_name, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE SET
       password = EXCLUDED.password,
       full_name = EXCLUDED.full_name,
       role = EXCLUDED.role`,
    [email, passwordHash, 'Runtime Administrator']
  );
  console.log('Administrator provisioned.');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
