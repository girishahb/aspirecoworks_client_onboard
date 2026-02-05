import fetch from 'node-fetch';

const API_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function testLoginFlow() {
  console.log('Testing CLIENT login flow...\n');

  // Step 1: Login
  console.log('1. Logging in...');
  const loginResponse = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'client@example.com',
      password: 'Client123!',
    }),
  });

  if (!loginResponse.ok) {
    const error = await loginResponse.json().catch(() => ({ message: loginResponse.statusText }));
    console.error('❌ Login failed:', error);
    return;
  }

  const loginData = await loginResponse.json();
  console.log('✅ Login successful');
  console.log('   User:', JSON.stringify(loginData.user, null, 2));
  console.log('   Token:', loginData.access_token.substring(0, 50) + '...');
  console.log('');

  if (!loginData.access_token) {
    console.error('❌ No access token received');
    return;
  }

  // Step 2: Get current user profile
  console.log('2. Getting current user profile (/users/me)...');
  const userResponse = await fetch(`${API_URL}/users/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${loginData.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!userResponse.ok) {
    const error = await userResponse.json().catch(() => ({ message: userResponse.statusText }));
    console.error('❌ Failed to get user profile:', error);
    console.log('   Status:', userResponse.status);
  } else {
    const userData = await userResponse.json();
    console.log('✅ User profile retrieved');
    console.log('   User data:', JSON.stringify(userData, null, 2));
    console.log('');
  }

  // Step 3: Get company
  console.log('3. Getting company (/companies/me)...');
  const companyResponse = await fetch(`${API_URL}/companies/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${loginData.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!companyResponse.ok) {
    const error = await companyResponse.json().catch(() => ({ message: companyResponse.statusText }));
    console.error('❌ Failed to get company:', error);
    console.log('   Status:', companyResponse.status);
    console.log('   Error details:', JSON.stringify(error, null, 2));
  } else {
    const companyData = await companyResponse.json();
    console.log('✅ Company retrieved');
    console.log('   Company:', companyData.companyName);
  }
}

testLoginFlow().catch(console.error);
