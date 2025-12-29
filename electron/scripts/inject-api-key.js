const fs = require('fs');
const path = require('path');

// This script injects API key into the built main.js file
// It should be run after build but before packaging

const API_KEY = process.env.OPENAI_API_KEY || '';

if (!API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable is not set');
  process.exit(1);
}

const mainJsPath = path.join(__dirname, '../dist/main.js');

if (!fs.existsSync(mainJsPath)) {
  console.error('ERROR: dist/main.js not found. Run npm run build first.');
  process.exit(1);
}

let mainJsContent = fs.readFileSync(mainJsPath, 'utf-8');

// Replace the loadApiKey function to return the hardcoded key
const replacement = `function loadApiKey() {
  // Injected API key for distribution
  const HARDCODED_API_KEY = '${API_KEY}';
  return HARDCODED_API_KEY;
}`;

// Find and replace the loadApiKey function
mainJsContent = mainJsContent.replace(
  /function loadApiKey\(\)[^}]*\{[^}]*\}/s,
  replacement
);

fs.writeFileSync(mainJsPath, mainJsContent, 'utf-8');
console.log('API key injected successfully');

