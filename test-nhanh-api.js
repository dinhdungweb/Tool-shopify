// Quick test script to check Nhanh API
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const appId = process.env.NHANH_APP_ID;
const businessId = process.env.NHANH_BUSINESS_ID;
const accessToken = process.env.NHANH_ACCESS_TOKEN;

async function testNhanhAPI() {
  try {
    console.log('Testing Nhanh API...');
    console.log('AppId:', appId);
    console.log('BusinessId:', businessId);
    
    const url = `https://pos.open.nhanh.vn/v3.0/customer/list?appId=${appId}&businessId=${businessId}`;
    
    // First request - no cursor
    console.log('\n=== Request 1 (no cursor) ===');
    const response1 = await axios.post(url, {
      filters: { type: 1 },
      paginator: { size: 100 }
    }, {
      headers: {
        'Authorization': accessToken,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Full response:', JSON.stringify(response1.data, null, 2));
    console.log('\nResponse code:', response1.data.code);
    console.log('Customers count:', response1.data.data?.data?.length || response1.data.data?.length || 0);
    console.log('Total:', response1.data.data?.paginator?.total);
    console.log('Has next:', !!response1.data.data?.paginator?.next);
    console.log('Next cursor:', JSON.stringify(response1.data.data?.paginator?.next));
    
    // Second request - with cursor
    if (response1.data.data?.paginator?.next) {
      console.log('\n=== Request 2 (with cursor) ===');
      const response2 = await axios.post(url, {
        filters: { type: 1 },
        paginator: { 
          size: 100,
          next: response1.data.data.paginator.next
        }
      }, {
        headers: {
          'Authorization': accessToken,
          'Content-Type': 'application/json',
        }
      });
      
      console.log('Response code:', response2.data.code);
      console.log('Customers count:', response2.data.data?.data?.length || 0);
      console.log('Has next:', !!response2.data.data?.paginator?.next);
    } else {
      console.log('\nNo more pages available');
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testNhanhAPI();
