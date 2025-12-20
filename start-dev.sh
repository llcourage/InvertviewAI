#!/bin/bash
# Bash script to start both API server and Electron

echo "Starting Interview AI Development Environment..."

# Check if website dependencies are installed
if [ ! -d "website/node_modules" ]; then
    echo "Installing website dependencies..."
    cd website
    npm install
    cd ..
fi

# Check if electron dependencies are installed
if [ ! -d "electron/node_modules" ]; then
    echo "Installing electron dependencies..."
    cd electron
    npm install
    cd ..
fi

# Build Electron
echo "Building Electron..."
cd electron
npm run build
cd ..

# Start API server in background
echo "Starting API server..."
cd website
npm run dev &
API_PID=$!
cd ..

# Wait a bit for server to start
sleep 5

# Start Electron
echo "Starting Electron..."
cd electron
npm start

# Cleanup on exit
trap "kill $API_PID" EXIT


