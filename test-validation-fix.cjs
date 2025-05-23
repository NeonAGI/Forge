#!/usr/bin/env node
/**
 * Test the API key validation fix
 */

// Import the validation function (simulated for testing)
function isPlaceholderKey(key) {
  if (!key) return true;
  
  const exactPlaceholders = [
    'your-openai-api-key',
    'your-api-key',
    'your-weather-api-key', 
    'api-key-here',
    'placeholder',
    'test-key',
    'sample-key',
    'dummy-key',
    'example-key',
    'demo-key'
  ];
  
  if (exactPlaceholders.some(placeholder => key.toLowerCase() === placeholder)) {
    return true;
  }
  
  const placeholderPatterns = [
    /your[-_]?.*[-_]?key/i,
    /key[-_]?here/i,
    /example.*key/i,
    /demo.*key/i,
    /^sk[-_]?your[-_]/i,
    /^<.*>$/,
    /placeholder/i,
    /test.*key/i,
    /sample.*key/i,
    /dummy.*key/i,
    /insert.*key/i,
    /replace.*with/i,
    /^xxx+$/i,
    /^000+$/,
  ];
  
  return placeholderPatterns.some(pattern => pattern.test(key));
}

console.log('🧪 API Key Validation Fix Test\n');

// Test cases
const testCases = [
  // Real keys (should return false)
  { key: 'sk-1234567890abcdef', expected: false, description: 'Real OpenAI key format' },
  { key: 'sk-proj-abcd1234', expected: false, description: 'Real OpenAI project key' },
  { key: 'sk-yfD8x7YGtuM2p3qL', expected: false, description: 'Real key starting with sk-y' },
  { key: 'abc123def456ghi789', expected: false, description: 'Generic API key' },
  
  // Placeholder keys (should return true)
  { key: 'your-openai-api-key', expected: true, description: 'Exact placeholder' },
  { key: 'sk-your-key-here', expected: true, description: 'OpenAI placeholder format' },
  { key: 'api-key-here', expected: true, description: 'Generic placeholder' },
  { key: 'placeholder', expected: true, description: 'Literal placeholder' },
  { key: '', expected: true, description: 'Empty key' },
  { key: null, expected: true, description: 'Null key' },
];

console.log('Running test cases...\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = isPlaceholderKey(test.key);
  const status = result === test.expected ? '✅ PASS' : '❌ FAIL';
  
  console.log(`${index + 1}. ${status} - ${test.description}`);
  console.log(`   Key: "${test.key || 'null'}"`);
  console.log(`   Expected: ${test.expected}, Got: ${result}`);
  console.log('');
  
  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }
});

console.log(`📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('🎉 All tests passed! The validation fix should work correctly.');
  console.log('\n💡 Expected behavior:');
  console.log('   • Real API keys starting with "sk-y..." will NOT be flagged as placeholders');
  console.log('   • Only actual placeholder values will be detected');
  console.log('   • Startup tests should now pass with your real API key');
} else {
  console.log('⚠️ Some tests failed. Review the validation logic.');
}