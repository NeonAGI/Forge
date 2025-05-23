// test-openai.js - Simple test script to verify OpenAI configuration
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get directory path in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('OpenAI Configuration Test');
console.log('------------------------');

// Check for .env file
const envPath = path.join(__dirname, '.env');
console.log(`Checking for .env file at: ${envPath}`);
if (fs.existsSync(envPath)) {
  console.log('✅ .env file exists');
} else {
  console.log('❌ .env file not found');
}

// Load environment variables
console.log('\nLoading environment variables...');
const result = dotenv.config();
if (result.error) {
  console.log(`❌ Error loading .env file: ${result.error.message}`);
} else {
  console.log('✅ Environment variables loaded successfully');
}

// Check for API key
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.log('❌ OPENAI_API_KEY not found in environment variables');
  process.exit(1);
}

console.log(`✅ OPENAI_API_KEY found with length: ${apiKey.length}`);
console.log(`✅ OPENAI_API_KEY starts with: ${apiKey.substring(0, 7)}...`);

// Initialize OpenAI client
console.log('\nInitializing OpenAI client...');
const openai = new OpenAI({
  apiKey: apiKey
});

// Test a simple API call
console.log('\nTesting API with a simple call...');
async function testApi() {
  try {
    const result = await openai.models.list();
    console.log('✅ API call successful!');
    console.log(`✅ Found ${result.data.length} models available`);
    
    // Try the image generation API specifically
    console.log('\nTesting image generation API...');
    const prompt = 'A simple test image of a blue sky';
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: "1024x1024",
      quality: "standard",
      response_format: "b64_json",
    });
    
    if (imageResponse.data && imageResponse.data.length > 0) {
      console.log('✅ Image generation successful!');
      console.log(`✅ Generated image with prompt: "${prompt}"`);
      console.log(`✅ Revised prompt: "${imageResponse.data[0].revised_prompt.substring(0, 50)}..."`);
      console.log(`✅ Image data (base64) length: ${imageResponse.data[0].b64_json.length} characters`);
    } else {
      console.log('❌ Image generation failed - no data returned');
    }
    
  } catch (error) {
    console.log(`❌ API call failed: ${error.message}`);
    console.error(error);
  }
}

testApi(); 