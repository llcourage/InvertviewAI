// Simple script to copy preload.ts to preload.js after TypeScript compilation
// This is a workaround for Electron's preload script requirement
const fs = require('fs');
const path = require('path');

const preloadTs = path.join(__dirname, 'preload.ts');
const preloadJs = path.join(__dirname, 'preload.js');

// In a real setup, this would be handled by the TypeScript compiler
// For now, we'll compile it manually or use a build script
console.log('Note: Preload script should be compiled by TypeScript');




