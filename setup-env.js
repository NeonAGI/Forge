import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

// Define __filename and __dirname equivalents for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Path to .env file
const envPath = path.join(__dirname, '.env');

// Check if .env file already exists
const checkEnvFile = () => {
  console.log(`Looking for .env file at: ${envPath}`);
  
  try {
    if (fs.existsSync(envPath)) {
      console.log('.env file already exists.');
      rl.question('Do you want to overwrite it? (y/n): ', (answer) => {
        if (answer.toLowerCase() === 'y') {
          promptForApiKey();
        } else {
          console.log('Setup cancelled. Keeping existing .env file.');
          rl.close();
        }
      });
    } else {
      console.log('No existing .env file found. Creating new file...');
      promptForApiKey();
    }
  } catch (err) {
    console.error('Error checking for .env file:', err);
    rl.close();
  }
};

// Prompt user for OpenAI API key
const promptForApiKey = () => {
  rl.question('Enter your OpenAI API key (starts with sk-): ', (apiKey) => {
    if (!apiKey || !apiKey.trim()) {
      console.log('API key cannot be empty. Please try again.');
      promptForApiKey();
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      console.log('Warning: OpenAI API keys typically start with "sk-". Your key might be invalid.');
      rl.question('Continue anyway? (y/n): ', (answer) => {
        if (answer.toLowerCase() === 'y') {
          createEnvFile(apiKey);
        } else {
          promptForApiKey();
        }
      });
    } else {
      createEnvFile(apiKey);
    }
  });
};

// Create .env file with the provided API key
const createEnvFile = (apiKey) => {
  const envContent = `# OpenAI API Key for DALL-E image generation and Realtime audio features
OPENAI_API_KEY=${apiKey}
`;

  try {
    fs.writeFileSync(envPath, envContent);
    console.log(`.env file created successfully at ${envPath}`);
    console.log('You can now run the application with your OpenAI API key configured.');
    rl.close();
  } catch (err) {
    console.error('Error creating .env file:', err);
    console.log('Try creating the .env file manually with the following content:');
    console.log(envContent);
    rl.close();
  }
};

// Start the setup process
console.log('Setting up OpenAI API key for your Forge project...');
checkEnvFile();

// Handle readline close
rl.on('close', () => {
  console.log('Setup process completed.');
}); 