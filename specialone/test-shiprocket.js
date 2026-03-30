const axios = require('./server/node_modules/axios');
require('./server/node_modules/dotenv').config({ path: 'server/.env' });

console.log('🔍 Testing Shiprocket with email:', process.env.SHIPROCKET_EMAIL);

axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
  email:    process.env.SHIPROCKET_EMAIL,
  password: process.env.SHIPROCKET_PASSWORD
})
.then(r => {
  console.log('✅ Shiprocket login SUCCESS');
  console.log('   Token (preview):', r.data.token.substring(0, 50) + '...');
  return axios.get('https://apiv2.shiprocket.in/v1/external/channels', {
    headers: { Authorization: 'Bearer ' + r.data.token }
  });
})
.then(r => {
  const channels = r.data.data || [];
  if (channels.length === 0) {
    console.log('   ⚠️  No channels found. You may need to create a channel on app.shiprocket.in');
  } else {
    console.log('   📦 Available Channels:');
    channels.forEach(ch => console.log(`      ID: ${ch.id} | Name: ${ch.name} | Type: ${ch.channel_name}`));
    console.log('\n👉 Copy the Channel ID above into SHIPROCKET_CHANNEL_ID in server/.env');
  }
})
.catch(e => {
  console.error('❌ FAILED:', e.response?.data || e.message);
  if (e.response?.status === 403 || e.response?.status === 401) {
    console.log('\n💡 Tip: Make sure you created an API user at:');
    console.log('   app.shiprocket.in → Settings → API → Create API User');
    console.log('   The API user email/password is different from your Shiprocket dashboard login.');
  }
});
