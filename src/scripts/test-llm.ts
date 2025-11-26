import dotenv from 'dotenv';
import { classifyEmailDynamic, getLLMStatus } from '../services/dynamic-classifier.service';

dotenv.config();

async function testLLM() {
  console.log('🧪 Testing Dynamic LLM Selection\n');
  console.log('=' .repeat(60));

  // Check LLM status
  const status = getLLMStatus();
  console.log('📊 LLM Configuration:');
  console.log(`   Gemini API Key: ${status.gemini.configured ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`   Gemini Rate Limited: ${status.gemini.rateLimited ? 'YES' : 'NO'}`);
  console.log(`   Ollama: ${status.ollama.configured ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`   Ollama URL: ${status.ollama.baseUrl}`);
  console.log(`   Ollama Model: ${status.ollama.model}`);
  console.log(`   Current Provider: ${status.currentProvider.toUpperCase()}\n`);

  console.log('=' .repeat(60));
  console.log('Testing email classification...\n');

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
  const result = await classifyEmailDynamic(
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

  // Check which provider was used
  const finalStatus = getLLMStatus();
  console.log(`\n✅ Used Provider: ${finalStatus.currentProvider.toUpperCase()}`);

  if (status.gemini.configured && finalStatus.gemini.rateLimited) {
    console.log('⚠️  Note: Gemini hit rate limit during this test');
  }

  console.log('\n✅ Dynamic LLM is working correctly!\n');
}

testLLM()
  .then(() => {
    console.log('Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
