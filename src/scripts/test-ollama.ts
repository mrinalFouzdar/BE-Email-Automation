import dotenv from 'dotenv';
import { testOllamaConnection, classifyEmailLocal } from '../services/local-classifier.service';

dotenv.config();

async function testOllama() {
  console.log('🧪 Testing Ollama Local LLM Setup\n');
  console.log('=' .repeat(60));

  // Step 1: Test connection
  console.log('Step 1: Testing Ollama connection...');
  const isConnected = await testOllamaConnection();

  if (!isConnected) {
    console.log('\n❌ Ollama connection failed!');
    console.log('\nTroubleshooting:');
    console.log('1. Install Ollama: https://ollama.com/download/windows');
    console.log('2. Pull the model: ollama pull llama3.2:3b');
    console.log('3. Check if Ollama is running: http://localhost:11434');
    process.exit(1);
  }

  console.log('✓ Ollama connection successful!\n');

  // Step 2: Test classification
  console.log('=' .repeat(60));
  console.log('Step 2: Testing email classification...\n');

  const testEmail = {
    subject: 'Invoice #12345 - Payment Due',
    body: 'Dear Customer, Your invoice #12345 for $500 is due on January 31st. Please make payment by the deadline to avoid late fees.',
    sender: 'billing@company.com'
  };

  console.log('Test Email:');
  console.log(`  From: ${testEmail.sender}`);
  console.log(`  Subject: ${testEmail.subject}`);
  console.log(`  Body: ${testEmail.body.substring(0, 100)}...\n`);

  console.log('Classifying...');
  const result = await classifyEmailLocal(
    testEmail.subject,
    testEmail.body,
    testEmail.sender
  );

  console.log('\n✓ Classification Result:');
  console.log('  ' + '='.repeat(58));
  console.log(`  Label: ${result.suggested_label}`);
  console.log(`  Hierarchy: ${result.is_hierarchy}`);
  console.log(`  Client: ${result.is_client}`);
  console.log(`  Meeting: ${result.is_meeting}`);
  console.log(`  Escalation: ${result.is_escalation}`);
  console.log(`  Urgent: ${result.is_urgent}`);
  console.log(`  Reasoning: ${result.reasoning}`);
  console.log('  ' + '='.repeat(58));

  console.log('\n✅ Local LLM is working correctly!');
  console.log('You can now use it for email classification.\n');
}

testOllama()
  .then(() => {
    console.log('Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
