// Test script to simulate Nhanh.vn webhook
const axios = require('axios');

const webhookUrl = 'http://localhost:3000/api/sync/webhook';

async function testWebhook() {
  console.log('Testing webhook endpoint...\n');

  // Test 1: Customer Updated Event
  console.log('=== Test 1: Customer Updated ===');
  try {
    const response1 = await axios.post(webhookUrl, {
      event: 'customer.updated',
      data: {
        customerId: 7,
        name: 'Mịn',
        mobile: '0789834300',
        totalAmount: 69735300
      },
      timestamp: new Date().toISOString()
    });
    console.log('Status:', response1.status);
    console.log('Response:', response1.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }

  console.log('\n=== Test 2: Order Completed ===');
  try {
    const response2 = await axios.post(webhookUrl, {
      event: 'order.completed',
      data: {
        customerId: 7,
        orderId: 12345,
        orderAmount: 925000
      },
      timestamp: new Date().toISOString()
    });
    console.log('Status:', response2.status);
    console.log('Response:', response2.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }

  console.log('\n=== Test 3: Invalid Payload ===');
  try {
    const response3 = await axios.post(webhookUrl, {
      event: 'customer.updated',
      // Missing data.customerId
      data: {
        name: 'Test'
      }
    });
    console.log('Status:', response3.status);
    console.log('Response:', response3.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }

  console.log('\n=== Test 4: Unmapped Customer ===');
  try {
    const response4 = await axios.post(webhookUrl, {
      event: 'customer.updated',
      data: {
        customerId: 99999, // Customer not mapped
        name: 'Unmapped Customer'
      }
    });
    console.log('Status:', response4.status);
    console.log('Response:', response4.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testWebhook();
