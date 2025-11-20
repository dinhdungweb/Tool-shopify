// Test script to check customer detail API
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const appId = process.env.NHANH_APP_ID;
const businessId = process.env.NHANH_BUSINESS_ID;
const accessToken = process.env.NHANH_ACCESS_TOKEN;

async function testCustomerDetail() {
  try {
    const customerId = 7; // Customer ID from your screenshot
    
    console.log('Testing customer list API with specific ID...');
    console.log('Customer ID:', customerId);
    
    const url = `https://pos.open.nhanh.vn/v3.0/customer/list?appId=${appId}&businessId=${businessId}`;
    
    // Try to get specific customer from list
    const response = await axios.post(url, {
      filters: {
        type: 1,
        id: customerId // Try filtering by ID
      },
      paginator: {
        size: 1
      }
    }, {
      headers: {
        'Authorization': accessToken,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('\n=== Full Response ===');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.code === 1 && response.data.data) {
      const customers = response.data.data;
      if (customers.length > 0) {
        const customer = customers[0];
        console.log('\n=== Customer Found ===');
        console.log('ID:', customer.id);
        console.log('Name:', customer.name);
        console.log('Total Amount:', customer.totalAmount);
        console.log('Mobile:', customer.mobile);
      } else {
        console.log('\n=== No customer found with that ID ===');
        console.log('Trying to get from full list...');
        
        // Get from full list and find by ID
        const response2 = await axios.post(url, {
          filters: { type: 1 },
          paginator: { size: 100 }
        }, {
          headers: {
            'Authorization': accessToken,
            'Content-Type': 'application/json',
          }
        });
        
        const allCustomers = response2.data.data || [];
        const foundCustomer = allCustomers.find(c => c.id === customerId);
        
        if (foundCustomer) {
          console.log('\n=== Customer Found in List ===');
          console.log('ID:', foundCustomer.id);
          console.log('Name:', foundCustomer.name);
          console.log('Total Amount:', foundCustomer.totalAmount);
          console.log('Mobile:', foundCustomer.mobile);
        } else {
          console.log('Customer not found in list either');
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testCustomerDetail();
