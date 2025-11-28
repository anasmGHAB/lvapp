const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Read API key from .env.local
const envPath = path.join(__dirname, '.env.local');
let apiKey = '';

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GOOGLE_API_KEY=(.+)/);
    if (match) {
        apiKey = match[1].trim();
    }
} catch (error) {
    console.error('❌ Could not read .env.local file:', error.message);
}

if (!apiKey) {
    console.error('❌ GOOGLE_API_KEY not found in .env.local');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listAvailableModels() {
    try {
        console.log('🔍 Fetching available Gemini models...\n');

        const models = await genAI.listModels();

        console.log('✅ Available models:\n');
        for await (const model of models) {
            console.log(`📌 ${model.name}`);
            console.log(`   Display Name: ${model.displayName}`);
            console.log(`   Description: ${model.description || 'N/A'}`);
            console.log(`   Supported Methods: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}\n`);
        }
    } catch (error) {
        console.error('❌ Error fetching models:', error.message);
        console.error('Full error:', error);
    }
}

listAvailableModels();
