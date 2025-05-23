const fetch = require('node-fetch');

// Test script to validate background image metadata system
async function testBackgroundMetadata() {
  console.log('🧪 Testing Background Image Metadata System');
  console.log('=' * 50);
  
  const baseUrl = 'http://localhost:3001/api';
  
  // Test data
  const testLocation = 'Fort Smith, AR';
  const testWeatherCondition = 'partly cloudy';
  const testTime = 'afternoon';
  
  try {
    console.log('\n1. Testing image generation with metadata...');
    console.log(`Location: ${testLocation}`);
    console.log(`Weather: ${testWeatherCondition}`);
    console.log(`Time: ${testTime}`);
    
    // Generate a new background
    const generateResponse = await fetch(`${baseUrl}/weather/background`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        location: testLocation,
        weatherCondition: testWeatherCondition,
        time: testTime,
        forceRefresh: true // Force new generation for testing
      })
    });
    
    if (!generateResponse.ok) {
      const errorData = await generateResponse.json();
      console.error('❌ Failed to generate background:', errorData);
      return;
    }
    
    const generateData = await generateResponse.json();
    console.log('✅ Background generated successfully');
    console.log(`Image ID: ${generateData.imageId}`);
    console.log(`Cached: ${generateData.cached}`);
    console.log(`Prompt: ${generateData.prompt}`);
    
    if (!generateData.imageId || generateData.imageId === 'mock-image-id') {
      console.log('⚠️  No valid image ID received, cannot test retrieval');
      return;
    }
    
    console.log('\n2. Testing image retrieval with metadata...');
    
    // Wait a moment for storage to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Retrieve the image by ID
    const retrieveResponse = await fetch(`${baseUrl}/images/${generateData.imageId}`);
    
    if (!retrieveResponse.ok) {
      const errorData = await retrieveResponse.json();
      console.error('❌ Failed to retrieve image:', errorData);
      return;
    }
    
    const retrieveData = await retrieveResponse.json();
    console.log('✅ Image retrieved successfully');
    console.log('Metadata comparison:');
    
    // Compare metadata
    const metadata = retrieveData.metadata;
    const isLocationMatch = metadata.location === testLocation;
    const isWeatherMatch = metadata.weatherCondition === testWeatherCondition;
    const isTimeMatch = metadata.timeOfDay === testTime;
    
    console.log(`  Location: ${metadata.location} ${isLocationMatch ? '✅' : '❌'} (expected: ${testLocation})`);
    console.log(`  Weather: ${metadata.weatherCondition} ${isWeatherMatch ? '✅' : '❌'} (expected: ${testWeatherCondition})`);
    console.log(`  Time: ${metadata.timeOfDay} ${isTimeMatch ? '✅' : '❌'} (expected: ${testTime})`);
    console.log(`  Created: ${metadata.createdAt}`);
    console.log(`  Use Count: ${metadata.useCount}`);
    
    console.log('\n3. Testing cache retrieval...');
    
    // Test cache retrieval (should return cached version)
    const cacheResponse = await fetch(`${baseUrl}/weather/background`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        location: testLocation,
        weatherCondition: testWeatherCondition,
        time: testTime,
        forceRefresh: false // Should use cache
      })
    });
    
    if (!cacheResponse.ok) {
      const errorData = await cacheResponse.json();
      console.error('❌ Failed to get cached background:', errorData);
      return;
    }
    
    const cacheData = await cacheResponse.json();
    console.log(`✅ Cache retrieval: ${cacheData.cached ? 'Used cached image' : 'Generated new image'}`);
    console.log(`Cache Image ID: ${cacheData.imageId}`);
    
    // Check if IDs match
    const cacheMatch = cacheData.imageId === generateData.imageId;
    console.log(`ID Match: ${cacheMatch ? '✅' : '❌'} (${cacheData.imageId} vs ${generateData.imageId})`);
    
    console.log('\n4. Testing time-based cache logic...');
    
    // Test with different time (should generate new image)
    const differentTimeResponse = await fetch(`${baseUrl}/weather/background`, {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        location: testLocation,
        weatherCondition: testWeatherCondition,
        time: 'morning', // Different time
        forceRefresh: false
      })
    });
    
    if (differentTimeResponse.ok) {
      const differentTimeData = await differentTimeResponse.json();
      const isDifferentImage = differentTimeData.imageId !== generateData.imageId;
      console.log(`Different time generates new image: ${isDifferentImage ? '✅' : '❌'}`);
      console.log(`New Image ID: ${differentTimeData.imageId}`);
    }
    
    console.log('\n🎉 Metadata test completed!');
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`✅ Metadata saved correctly: ${isLocationMatch && isWeatherMatch && isTimeMatch}`);
    console.log(`✅ Cache system working: ${cacheData.cached}`);
    console.log(`✅ Image retrieval working: ${retrieveData.imageId === generateData.imageId}`);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Helper function to get current time quarter
function getCurrentTimeQuarter() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon'; 
  if (hour >= 18 && hour <= 23) return 'evening';
  return 'night'; // 0-5 hours
}

// Test time quarter logic
function testTimeQuarters() {
  console.log('\n🕐 Testing Time Quarter Logic:');
  
  const testHours = [3, 6, 9, 12, 15, 18, 21, 23];
  const expectedQuarters = ['night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night'];
  
  testHours.forEach((hour, index) => {
    // Mock the hour
    const originalHour = new Date().getHours;
    Date.prototype.getHours = () => hour;
    
    const quarter = getCurrentTimeQuarter();
    const expected = expectedQuarters[index];
    const isCorrect = quarter === expected;
    
    console.log(`Hour ${hour}:00 → ${quarter} ${isCorrect ? '✅' : '❌'} (expected: ${expected})`);
    
    // Restore original function
    Date.prototype.getHours = originalHour;
  });
}

// Run the tests
async function runAllTests() {
  console.log('🚀 Starting Background Metadata Tests\n');
  
  testTimeQuarters();
  await testBackgroundMetadata();
  
  console.log('\n✨ All tests completed!');
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testBackgroundMetadata, testTimeQuarters, getCurrentTimeQuarter };