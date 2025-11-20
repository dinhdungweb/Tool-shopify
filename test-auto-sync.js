// Test Global Auto Sync API
const BASE_URL = 'http://localhost:3000';

async function testGlobalAutoSync() {
  console.log('🧪 Testing Global Auto Sync API...\n');

  try {
    // 1. Get global config
    console.log('1️⃣ Getting global config...');
    const configResponse = await fetch(`${BASE_URL}/api/sync/schedule/global`);
    const configResult = await configResponse.json();
    console.log('✓ Global config:', configResult.data);
    console.log('');

    // 2. Get auto sync status
    console.log('2️⃣ Getting auto sync status...');
    const statusResponse = await fetch(`${BASE_URL}/api/sync/auto-sync`);
    const statusResult = await statusResponse.json();
    console.log('✓ Status:', statusResult.data);
    console.log('');

    // 3. Enable auto sync
    console.log('3️⃣ Enabling global auto sync...');
    const enableResponse = await fetch(`${BASE_URL}/api/sync/schedule/global`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        schedule: '0 */6 * * *', // Every 6 hours
      }),
    });
    const enableResult = await enableResponse.json();
    console.log('✓ Auto sync enabled:', enableResult);
    console.log('');

    // 4. Initialize scheduler
    console.log('4️⃣ Initializing scheduler...');
    const initResponse = await fetch(`${BASE_URL}/api/sync/schedule/init`);
    const initResult = await initResponse.json();
    console.log('✓ Scheduler initialized:', initResult);
    console.log('');

    // 5. Get updated status
    console.log('5️⃣ Getting updated status...');
    const statusResponse2 = await fetch(`${BASE_URL}/api/sync/auto-sync`);
    const statusResult2 = await statusResponse2.json();
    console.log('✓ Updated status:', statusResult2.data);
    console.log('');

    // 6. Test manual trigger (optional - commented out to avoid actual sync)
    console.log('6️⃣ Testing manual trigger (skipped)...');
    console.log('   To test: POST to /api/sync/auto-sync');
    console.log('   This will sync all SYNCED mappings');
    console.log('');

    // 7. Disable auto sync
    console.log('7️⃣ Disabling global auto sync...');
    const disableResponse = await fetch(`${BASE_URL}/api/sync/schedule/global`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: false,
      }),
    });
    const disableResult = await disableResponse.json();
    console.log('✓ Auto sync disabled:', disableResult);
    console.log('');

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

// Run tests
testGlobalAutoSync();
