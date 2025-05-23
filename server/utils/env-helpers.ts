/**
 * Helper functions for environment variable handling
 */

/**
 * Checks if the provided API key is a placeholder/example value rather than a real key
 * 
 * @param key - The API key to check
 * @returns boolean - True if the key is a placeholder, false otherwise
 */
export function isPlaceholderKey(key: string): boolean {
  if (!key) return true; // Empty/null keys are considered placeholders
  
  // Exact placeholder matches (case insensitive)
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
  
  // Check for exact matches first
  if (exactPlaceholders.some(placeholder => key.toLowerCase() === placeholder)) {
    return true;
  }
  
  // Pattern-based checks for placeholder-like strings
  const placeholderPatterns = [
    /your[-_]?.*[-_]?key/i,      // "your-something-key", "your_api_key"
    /key[-_]?here/i,             // "key-here", "key_here"
    /example.*key/i,             // "example-key", "examplekey"
    /demo.*key/i,                // "demo-key", "demokey"
    /^sk[-_]?your[-_]/i,         // OpenAI format: "sk-your-" or "sk_your_"
    /^<.*>$/,                    // Anything in angle brackets: "<your_api_key>"
    /placeholder/i,              // Contains "placeholder"
    /test.*key/i,                // "test-key", "testkey"
    /sample.*key/i,              // "sample-key", "samplekey"
    /dummy.*key/i,               // "dummy-key", "dummykey"
    /insert.*key/i,              // "insert-key", "insertkey"
    /replace.*with/i,            // "replace-with-your-key"
    /^xxx+$/i,                   // "xxx", "XXXX", etc.
    /^000+$/,                    // "000", "0000", etc.
  ];
  
  // Check if the key matches any placeholder pattern
  return placeholderPatterns.some(pattern => pattern.test(key));
} 