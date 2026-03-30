// Test multiple credential combinations
require('dotenv').config({ path: __dirname + '/.env' });
const axios = require('axios');

const BASE = 'https://apiv2.shiprocket.in/v1/external';

const credSets = [
  { label: 'API user (new)',      email: 'pranaypal08@gmail.com', password: 'H2tmYxR#DfJ$7gJWFweeXfRJ2caSljtG' },
  { label: 'Dashboard original',  email: 'specialonepranay@gmail.com', password: 'Pranay@808' },
];

(async () => {
  for (const cred of credSets) {
    process.stdout.write(`\nTesting [${cred.label}] ${cred.email} ... `);
    try {
      const r = await axios.post(`${BASE}/auth/login`, { email: cred.email, password: cred.password });
      console.log('✅ SUCCESS! Token:', r.data.token.substring(0,40) + '...');
    } catch (e) {
      const code   = e.response?.status;
      const detail = e.response?.data?.message || e.message;
      console.log(`❌ HTTP ${code}: ${detail}`);
    }
  }
})();
