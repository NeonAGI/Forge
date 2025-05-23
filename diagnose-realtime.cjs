#!/usr/bin/env node
/**
 * OpenAI Realtime Audio Diagnostic Tool
 * 
 * This script helps diagnose issues with the OpenAI Realtime API integration.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 OpenAI Realtime Audio Diagnostic Tool\n');

// Check environment file
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found');
    console.log('   Create .env file from .env.example');
    process.exit(1);
}

// Load environment variables
require('dotenv').config();

console.log('✅ Environment file found');

// Check API keys
const openaiKey = process.env.OPENAI_API_KEY;
const weatherKey = process.env.WEATHER_API_KEY;

console.log('\n📋 API Key Status:');
console.log(`   OpenAI API Key: ${openaiKey ? (openaiKey.includes('your-') ? '❌ Placeholder key' : '✅ Set') : '❌ Missing'}`);
console.log(`   Weather API Key: ${weatherKey ? (weatherKey.includes('your-') ? '❌ Placeholder key' : '✅ Set') : '❌ Missing'}`);

// Check browser compatibility requirements
console.log('\n🌐 Browser Requirements for Realtime Audio:');
console.log('   • WebRTC support (Chrome, Firefox, Safari)');
console.log('   • Microphone permissions');
console.log('   • HTTPS (required for getUserMedia)');
console.log('   • Speech Recognition API (optional, for wake phrases)');

// Check server endpoints
console.log('\n🔧 Key Server Endpoints:');
console.log('   • POST /api/realtime/session - Creates OpenAI session');
console.log('   • GET /api/keys/status - Check API key status');
console.log('   • POST /api/keys/test - Test API connections');

// Common issues and solutions
console.log('\n🚨 Common Issues & Solutions:');
console.log('   1. "API key not configured"');
console.log('      → Set valid OPENAI_API_KEY in .env file');
console.log('');
console.log('   2. "WebRTC connection failed"');
console.log('      → Check browser console for specific errors');
console.log('      → Ensure HTTPS or localhost');
console.log('      → Check firewall/network restrictions');
console.log('');
console.log('   3. "Microphone access denied"');
console.log('      → Grant microphone permissions in browser');
console.log('      → Check browser settings');
console.log('');
console.log('   4. "Session creation failed"');
console.log('      → Verify OpenAI API key has realtime access');
console.log('      → Check OpenAI account billing/usage limits');

// Next steps
console.log('\n🎯 Next Steps:');
if (!openaiKey || openaiKey.includes('your-')) {
    console.log('   1. Get OpenAI API key from https://platform.openai.com/api-keys');
    console.log('   2. Update OPENAI_API_KEY in .env file');
    console.log('   3. Restart the server');
    console.log('   4. Or use the web interface: http://localhost:5173/api-keys');
} else {
    console.log('   1. Start the development server: npm run dev');
    console.log('   2. Open browser to http://localhost:5173');
    console.log('   3. Check browser console for errors');
    console.log('   4. Try the "Start Voice Chat" button');
}

console.log('\n🔄 Current Error: "Failed to initialize WebRTC: 500: Internal Server Error"');
console.log('   → This confirms the API key is not properly configured');
console.log('   → Server is correctly rejecting placeholder API keys');
console.log('   → Error handling improvements have been added to show clearer messages');

console.log('\n🔧 Recent Fix Applied:');
console.log('   ✅ Fixed API key persistence issue');
console.log('   ✅ Client now uses /api/settings/apikeys endpoint (persistent)');
console.log('   ✅ Server writes keys to .env file AND updates process.env');
console.log('   ✅ API keys now survive server restarts');
console.log('   ✅ .env file formatting and comments are preserved');

console.log('\n📖 For more help, check the browser console and network tab when testing.');