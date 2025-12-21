import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not configured');
    process.exit(1);
  }

  try {
    console.log('🔍 Fetching available Gemini models...\n');

    const genAI = new GoogleGenerativeAI(apiKey);

    // Use the REST API to list models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    const data = await response.json();

    if (data.models) {
      console.log(`Found ${data.models.length} models:\n`);

      // Filter for models that support generateContent
      const contentGenerationModels = data.models.filter((model: any) =>
        model.supportedGenerationMethods?.includes('generateContent')
      );

      console.log(`Models that support generateContent (${contentGenerationModels.length}):`);
      contentGenerationModels.forEach((model: any) => {
        console.log(`  ✓ ${model.name.replace('models/', '')}`);
      });
    } else {
      console.error('❌ Failed to fetch models:', data);
    }
  } catch (error: any) {
    console.error('❌ Error listing models:', error.message);
  }
}

listModels();
