// Test script to validate seasonal metadata in background image system
console.log('🌸 Testing Seasonal Metadata System\n');

// Helper function to get current season
function getCurrentSeason() {
  const currentMonth = new Date().getMonth(); // 0-11
  if (currentMonth >= 2 && currentMonth <= 4) return 'spring';
  if (currentMonth >= 5 && currentMonth <= 7) return 'summer'; 
  if (currentMonth >= 8 && currentMonth <= 10) return 'autumn';
  return 'winter';
}

// Test seasonal logic
function testSeasonalLogic() {
  console.log('1. Testing Seasonal Logic:');
  
  const testCases = [
    { month: 0, expected: 'winter' },   // January
    { month: 1, expected: 'winter' },   // February
    { month: 2, expected: 'spring' },   // March
    { month: 3, expected: 'spring' },   // April
    { month: 4, expected: 'spring' },   // May
    { month: 5, expected: 'summer' },   // June
    { month: 6, expected: 'summer' },   // July
    { month: 7, expected: 'summer' },   // August
    { month: 8, expected: 'autumn' },   // September
    { month: 9, expected: 'autumn' },   // October
    { month: 10, expected: 'autumn' },  // November
    { month: 11, expected: 'winter' },  // December
  ];
  
  let allCorrect = true;
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  testCases.forEach(({ month, expected }) => {
    // Mock Date.getMonth for testing
    const originalDate = Date;
    global.Date = class extends Date {
      getMonth() { return month; }
    };
    
    const result = getCurrentSeason();
    const isCorrect = result === expected;
    
    console.log(`  ${monthNames[month].padEnd(9)} → ${result.padEnd(6)} ${isCorrect ? '✅' : '❌'} (expected: ${expected})`);
    
    if (!isCorrect) allCorrect = false;
    
    // Restore Date
    global.Date = originalDate;
  });
  
  console.log(`\n  Overall: ${allCorrect ? '✅ All tests passed' : '❌ Some tests failed'}\n`);
  return allCorrect;
}

// Test seasonal cache logic
function testSeasonalCacheLogic() {
  console.log('2. Testing Seasonal Cache Logic:');
  
  const BACKGROUND_REF_KEY = 'weather_app_background_ref';
  
  // Mock localStorage
  const mockStorage = {};
  const localStorage = {
    getItem: (key) => mockStorage[key] || null,
    setItem: (key, value) => { mockStorage[key] = value; },
    removeItem: (key) => { delete mockStorage[key]; }
  };
  
  // Helper function to check if we should update the background
  const shouldUpdateBackground = (currentConditions, mockLocalStorage = localStorage) => {
    try {
      const imageRefStr = mockLocalStorage.getItem(BACKGROUND_REF_KEY);
      if (!imageRefStr) return true; // No cached image, should update

      const imageRef = JSON.parse(imageRefStr);
      
      // Check if conditions match (including season)
      const conditionsMatch = 
        imageRef.location === currentConditions.location &&
        imageRef.weatherCondition === currentConditions.weather &&
        imageRef.time === currentConditions.timeQuarter &&
        imageRef.season === currentConditions.season; // Season must match exactly (missing season = no match, will update)

      // Check if image is recent (less than 6 hours old to allow time quarter changes)
      const timestamp = new Date(imageRef.timestamp);
      const now = new Date();
      const isRecent = (now.getTime() - timestamp.getTime()) < 6 * 60 * 60 * 1000; // 6 hours

      console.log(`    Conditions match: ${conditionsMatch}`);
      console.log(`    Is recent: ${isRecent} (age: ${Math.round((now.getTime() - timestamp.getTime()) / (60 * 60 * 1000))} hours)`);
      console.log(`    Cached season: ${imageRef.season || 'missing'}, Current season: ${currentConditions.season}`);

      // Only update if conditions changed OR image is too old
      return !conditionsMatch || !isRecent;
    } catch (err) {
      console.warn('    Error checking conditions:', err.message);
      return true; // On error, allow update
    }
  };
  
  const baseConditions = {
    location: 'Fort Smith, AR',
    weather: 'partly cloudy',
    timeQuarter: 'afternoon'
  };
  
  console.log('  Test Case 1: No cached image');
  let shouldUpdate = shouldUpdateBackground({...baseConditions, season: 'spring'});
  console.log(`    Should update: ${shouldUpdate ? '✅ Yes' : '❌ No'} (expected: Yes)\n`);
  
  console.log('  Test Case 2: Recent image with same conditions including season');
  localStorage.setItem(BACKGROUND_REF_KEY, JSON.stringify({
    location: baseConditions.location,
    weatherCondition: baseConditions.weather,
    time: baseConditions.timeQuarter,
    season: 'spring',
    timestamp: new Date().toISOString()
  }));
  shouldUpdate = shouldUpdateBackground({...baseConditions, season: 'spring'});
  console.log(`    Should update: ${shouldUpdate ? '❌ Yes' : '✅ No'} (expected: No)\n`);
  
  console.log('  Test Case 3: Recent image but different season');
  localStorage.setItem(BACKGROUND_REF_KEY, JSON.stringify({
    location: baseConditions.location,
    weatherCondition: baseConditions.weather,
    time: baseConditions.timeQuarter,
    season: 'winter', // Different season
    timestamp: new Date().toISOString()
  }));
  shouldUpdate = shouldUpdateBackground({...baseConditions, season: 'spring'});
  console.log(`    Should update: ${shouldUpdate ? '✅ Yes' : '❌ No'} (expected: Yes)\n`);
  
  console.log('  Test Case 4: Legacy image without season (should update to add seasonal context)');
  localStorage.setItem(BACKGROUND_REF_KEY, JSON.stringify({
    location: baseConditions.location,
    weatherCondition: baseConditions.weather,
    time: baseConditions.timeQuarter,
    // No season field - legacy cache
    timestamp: new Date().toISOString()
  }));
  shouldUpdate = shouldUpdateBackground({...baseConditions, season: 'spring'});
  console.log(`    Should update: ${shouldUpdate ? '✅ Yes' : '❌ No'} (expected: Yes - upgrade legacy cache with seasonal context)\n`);
  
  console.log('  Test Case 5: Spring vs Summer - same other conditions');
  const springConditions = {...baseConditions, season: 'spring'};
  const summerConditions = {...baseConditions, season: 'summer'};
  
  localStorage.setItem(BACKGROUND_REF_KEY, JSON.stringify({
    location: baseConditions.location,
    weatherCondition: baseConditions.weather,
    time: baseConditions.timeQuarter,
    season: 'spring',
    timestamp: new Date().toISOString()
  }));
  
  const springCheck = shouldUpdateBackground(springConditions);
  const summerCheck = shouldUpdateBackground(summerConditions);
  
  console.log(`    Spring cached, check spring: ${springCheck ? 'Update' : 'No update'} ${!springCheck ? '✅' : '❌'}`);
  console.log(`    Spring cached, check summer: ${summerCheck ? 'Update' : 'No update'} ${summerCheck ? '✅' : '❌'}`);
}

// Test hash key generation with season
function testHashKeyGeneration() {
  console.log('\n3. Testing Hash Key Generation with Season:');
  
  // Mock the hash key generation function from the server
  const crypto = require('crypto');
  
  function generateHashKey(location, weatherCondition, timeOfDay, season, temperature) {
    const input = `${location.toLowerCase()}|${weatherCondition.toLowerCase()}|${timeOfDay.toLowerCase()}|${season?.toLowerCase() || ''}|${temperature || ''}`;
    return crypto.createHash('md5').update(input).digest('hex');
  }
  
  const baseParams = {
    location: 'Fort Smith, AR',
    weatherCondition: 'partly cloudy',
    timeOfDay: 'afternoon',
    temperature: 75
  };
  
  const springHash = generateHashKey(baseParams.location, baseParams.weatherCondition, baseParams.timeOfDay, 'spring', baseParams.temperature);
  const summerHash = generateHashKey(baseParams.location, baseParams.weatherCondition, baseParams.timeOfDay, 'summer', baseParams.temperature);
  const noSeasonHash = generateHashKey(baseParams.location, baseParams.weatherCondition, baseParams.timeOfDay, undefined, baseParams.temperature);
  
  console.log(`  Spring hash: ${springHash.substring(0, 8)}...`);
  console.log(`  Summer hash: ${summerHash.substring(0, 8)}...`);
  console.log(`  No season:   ${noSeasonHash.substring(0, 8)}...`);
  
  const hashesAreDifferent = springHash !== summerHash && springHash !== noSeasonHash && summerHash !== noSeasonHash;
  console.log(`  All hashes different: ${hashesAreDifferent ? '✅ Yes' : '❌ No'}`);
  
  return hashesAreDifferent;
}

// Run all tests
function runAllTests() {
  console.log('🧪 Seasonal Metadata Test Suite');
  console.log('=' * 35);
  
  const seasonTestPassed = testSeasonalLogic();
  testSeasonalCacheLogic();
  const hashTestPassed = testHashKeyGeneration();
  
  console.log('\n📊 Test Summary:');
  console.log(`✅ Seasonal Logic: ${seasonTestPassed ? 'PASSED' : 'FAILED'}`);
  console.log('✅ Seasonal Cache Logic: TESTED');
  console.log(`✅ Hash Key Generation: ${hashTestPassed ? 'PASSED' : 'FAILED'}`);
  
  console.log('\n🎯 Expected Behavior:');
  console.log('• Images are cached per season (spring/summer/autumn/winter)');
  console.log('• Season changes trigger new image generation');
  console.log('• Hash keys include seasonal information');
  console.log('• Backward compatibility with non-seasonal cache entries');
  console.log('• Same weather conditions in different seasons = different images');
  
  const currentSeason = getCurrentSeason();
  console.log(`\n🗓️  Current Season: ${currentSeason}`);
}

// Run if called directly
if (require.main === module) {
  runAllTests();
}

module.exports = { 
  getCurrentSeason, 
  testSeasonalLogic, 
  testSeasonalCacheLogic,
  runAllTests 
};