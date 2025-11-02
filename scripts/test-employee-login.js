/**
 * Test script to diagnose employee login issue
 * Tests store lookup and employee authentication
 * 
 * Usage: node scripts/test-employee-login.js
 * 
 * Credentials:
 * - Store Name: demostore
 * - Employee ID: DE01
 * - Password: DE013097
 */

const fs = require('fs');
const path = require('path');

// Load .env file
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  
  let envContent = '';
  
  if (fs.existsSync(envLocalPath)) {
    envContent = fs.readFileSync(envLocalPath, 'utf8');
  } else if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value.replace(/^["']|["']$/g, ''); // Remove quotes
      }
    }
  });
}

// Load environment variables
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'

async function testStoresAPI() {
  console.log('\n=== Testing Stores API ===')
  try {
    const response = await fetch('http://localhost:3000/api/stores?all=true')
    const data = await response.json()
    
    console.log('✅ Stores API Response:', JSON.stringify(data, null, 2))
    
    if (data.error) {
      console.error('❌ Stores API Error:', data.error)
      return null
    }
    
    return data.stores || []
  } catch (error) {
    console.error('❌ Failed to fetch stores API:', error.message)
    return null
  }
}

async function testSupabaseDirect(stores) {
  console.log('\n=== Testing Supabase Direct Queries ===')
  
  // Mock Supabase client (we'll use fetch instead)
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  }
  
  // Test 1: Find store by code
  console.log('\n--- Test 1: Find store by code "DEMO" ---')
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/stores?store_code=eq.DEMO&select=*`,
      { headers }
    )
    
    const storeData = await response.json()
    console.log('Response status:', response.status)
    console.log('Store found:', JSON.stringify(storeData, null, 2))
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error:', errorText)
      return null
    }
    
    return storeData[0] || null
  } catch (error) {
    console.error('❌ Failed:', error.message)
    return null
  }
}

async function testStoreByName(name) {
  console.log(`\n--- Test 2: Find store by name "${name}" ---`)
  
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }
  
  try {
    // Use ilike for case-insensitive search
    const encodedName = encodeURIComponent(`%${name}%`)
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/stores?name=ilike.${encodedName}&select=*`,
      { headers }
    )
    
    const storeData = await response.json()
    console.log('Response status:', response.status)
    console.log('Stores found:', JSON.stringify(storeData, null, 2))
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error:', errorText)
      return null
    }
    
    return storeData
  } catch (error) {
    console.error('❌ Failed:', error.message)
    return null
  }
}

async function testEmployeeLookup(storeId, employeeId) {
  console.log(`\n=== Testing Employee Lookup ===`)
  console.log(`Store ID: ${storeId}, Employee ID: ${employeeId}`)
  
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  }
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/employees?employee_id=eq.${employeeId}&store_id=eq.${storeId}&select=*`,
      { headers }
    )
    
    const employeeData = await response.json()
    console.log('Response status:', response.status)
    console.log('Employee found:', JSON.stringify(employeeData, null, 2))
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error:', errorText)
      
      // Try to get error details
      try {
        const errorJson = JSON.parse(errorText)
        console.error('Error details:', JSON.stringify(errorJson, null, 2))
      } catch {
        // Not JSON
      }
      return null
    }
    
    return employeeData[0] || null
  } catch (error) {
    console.error('❌ Failed:', error.message)
    return null
  }
}

async function testFullLoginFlow() {
  console.log('\n=== Testing Full Login Flow ===')
  console.log('Credentials:')
  console.log('  Store Name: demostore')
  console.log('  Employee ID: DE01')
  console.log('  Password: DE013097')
  
  // Step 1: Test stores API
  const stores = await testStoresAPI()
  
  if (!stores || stores.length === 0) {
    console.error('\n❌ CRITICAL: No stores found via API')
    console.log('This suggests RLS is blocking store reads')
    return
  }
  
  console.log(`\n✅ Found ${stores.length} store(s) via API`)
  
  // Step 2: Find the specific store
  let targetStore = stores.find(s => 
    s.name?.toLowerCase() === 'demostore' || 
    s.store_code === 'DEMO'
  )
  
  if (!targetStore) {
    console.error('\n❌ Store "demostore" not found in API results')
    console.log('Available stores:', stores.map(s => `${s.name} (${s.store_code})`).join(', '))
    
    // Try direct Supabase query
    console.log('\n--- Trying direct Supabase query ---')
    targetStore = await testStoreByName('demostore')
    if (targetStore && targetStore.length > 0) {
      targetStore = targetStore[0]
    }
  }
  
  if (!targetStore) {
    console.error('\n❌ Store lookup failed completely')
    return
  }
  
  console.log(`\n✅ Store found:`, {
    id: targetStore.id,
    name: targetStore.name,
    store_code: targetStore.store_code,
    admin_user_id: targetStore.admin_user_id
  })
  
  // Step 3: Test employee lookup
  const employee = await testEmployeeLookup(targetStore.id, 'DE01')
  
  if (!employee) {
    console.error('\n❌ Employee DE01 not found in store')
    return
  }
  
  console.log(`\n✅ Employee found:`, {
    id: employee.id,
    employee_id: employee.employee_id,
    name: employee.name,
    store_id: employee.store_id,
    has_password: !!employee.password,
    password_length: employee.password?.length
  })
  
  // Step 4: Verify password
  const passwordMatches = employee.password === 'DE013097' || employee.employee_id === 'DE013097'
  
  if (!passwordMatches) {
    console.error('\n❌ Password mismatch!')
    console.log('  Expected: DE013097')
    console.log('  Stored password length:', employee.password?.length || 0)
    console.log('  Employee ID fallback:', employee.employee_id)
  } else {
    console.log('\n✅ Password matches!')
  }
  
  // Summary
  console.log('\n=== SUMMARY ===')
  console.log('✅ Store lookup: SUCCESS')
  console.log('✅ Employee lookup: SUCCESS')
  console.log(passwordMatches ? '✅ Password: VALID' : '❌ Password: INVALID')
}

// Check if environment variables are set
if (!SUPABASE_URL || SUPABASE_URL.includes('your-project')) {
  console.error('\n❌ ERROR: Supabase credentials not set!')
  console.log('Please set environment variables:')
  console.log('  NEXT_PUBLIC_SUPABASE_URL')
  console.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY')
  console.log('\nYou can find these in your .env.local file')
  process.exit(1)
}

// Run tests
console.log('Starting employee login diagnostic tests...')
console.log('Supabase URL:', SUPABASE_URL.substring(0, 30) + '...')

testFullLoginFlow()
  .then(() => {
    console.log('\n✅ Tests completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test failed with error:', error)
    process.exit(1)
  })

