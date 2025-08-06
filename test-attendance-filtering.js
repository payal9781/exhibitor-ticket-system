// Test script for attendance-based filtering
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

// You'll need to replace this with a valid JWT token from an organizer login
const ORGANIZER_TOKEN = 'your-organizer-jwt-token-here';

async function testAttendanceFiltering() {
  console.log('Testing attendance-based filtering...\n');

  const headers = {
    'Authorization': `Bearer ${ORGANIZER_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // Test 1: Get exhibitors (filtered by organizer's events)
    console.log('1. Testing filtered exhibitors list...');
    const exhibitorsResponse = await axios.post(`${BASE_URL}/exhibitors/list`, {
      page: 1,
      limit: 10
    }, { headers });
    
    console.log(`✓ Found ${exhibitorsResponse.data.data.exhibitors.length} exhibitors who attended organizer's events`);
    
    // Test 2: Get visitors (filtered by organizer's events)
    console.log('2. Testing filtered visitors list...');
    const visitorsResponse = await axios.post(`${BASE_URL}/visitors/list`, {
      page: 1,
      limit: 10
    }, { headers });
    
    console.log(`✓ Found ${visitorsResponse.data.data.visitors.length} visitors who attended organizer's events`);
    
    // Test 3: Get exhibitors with attendance details
    console.log('3. Testing exhibitors with attendance details...');
    const exhibitorsWithAttendanceResponse = await axios.post(`${BASE_URL}/exhibitors/list-with-attendance`, {
      page: 1,
      limit: 10
    }, { headers });
    
    console.log(`✓ Found ${exhibitorsWithAttendanceResponse.data.data.exhibitors.length} exhibitors with detailed attendance info`);
    
    // Test 4: Get visitors with attendance details
    console.log('4. Testing visitors with attendance details...');
    const visitorsWithAttendanceResponse = await axios.post(`${BASE_URL}/visitors/list-with-attendance`, {
      page: 1,
      limit: 10
    }, { headers });
    
    console.log(`✓ Found ${visitorsWithAttendanceResponse.data.data.visitors.length} visitors with detailed attendance info`);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    if (error.response) {
      console.log(`❌ Error: ${error.response.status} - ${error.response.data.message || error.response.statusText}`);
    } else {
      console.log(`❌ Network Error: ${error.message}`);
    }
  }
}

console.log('📝 Instructions:');
console.log('1. Make sure the server is running on port 3000');
console.log('2. Replace ORGANIZER_TOKEN with a valid JWT token from organizer login');
console.log('3. Run: node test-attendance-filtering.js\n');

// Uncomment the line below to run the test (after setting up the token)
// testAttendanceFiltering();