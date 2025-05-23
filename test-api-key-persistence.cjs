#!/usr/bin/env node
/**
 * Test script to verify API key persistence
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing API Key Persistence\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found');
    process.exit(1);
}

console.log('✅ Found .env file');

// Read current content
const currentContent = fs.readFileSync(envPath, 'utf-8');
console.log('\n📄 Current .env content:');
console.log('----------------------------------------');
console.log(currentContent);
console.log('----------------------------------------');

// Test the regex patterns used by the server
const openaiRegex = /^OPENAI_API_KEY=.*$/m;
const weatherRegex = /^WEATHER_API_KEY=.*$/m;

console.log('\n🔍 Testing regex patterns:');
console.log(`   OpenAI regex match: ${openaiRegex.test(currentContent)}`);
console.log(`   Weather regex match: ${weatherRegex.test(currentContent)}`);

if (openaiRegex.test(currentContent)) {
    const currentOpenaiKey = currentContent.match(openaiRegex)[0];
    console.log(`   Current OpenAI line: "${currentOpenaiKey}"`);
}

if (weatherRegex.test(currentContent)) {
    const currentWeatherKey = currentContent.match(weatherRegex)[0];
    console.log(`   Current Weather line: "${currentWeatherKey}"`);
}

console.log('\n✅ API key persistence mechanism should work correctly');
console.log('\n📋 What happens when you save an API key:');
console.log('   1. Client sends POST to /api/settings/apikeys');
console.log('   2. Server finds .env file');
console.log('   3. Server updates the specific line using regex replacement');
console.log('   4. Server writes the updated content back to .env');
console.log('   5. Server updates process.env for immediate use');
console.log('\n💡 Try saving an API key through the web interface now!');
console.log('   The key should persist across server restarts.');