import { client, connect } from '../config/db';
import { EmailProcessingService } from '../services/email-processing.service';
import dotenv from 'dotenv';
dotenv.config();

async function testLabelAssignment() {
  try {
    await connect();
    console.log('Connected to DB');

    // 1. Create a test email that should be classified as "Urgent" and "Escalation"
    const testSubject = "URGENT: Server Down - Immediate Attention Required";
    const testBody = "The production server is down. This is a critical issue. Please fix ASAP.";
    const testSender = "boss@example.com";
    
    const insertResult = await client.query(
      `INSERT INTO emails (subject, body, sender_email, sender_name, received_at, gmail_id, thread_id)
       VALUES ($1, $2, $3, 'The Boss', NOW(), $4, $5)
       RETURNING id`,
      [testSubject, testBody, testSender, `test-msg-${Date.now()}`, `test-thread-${Date.now()}`]
    );
    
    const emailId = insertResult.rows[0].id;
    console.log(`Created test email with ID: ${emailId}`);

    // 2. Process the email
    const processor = new EmailProcessingService();
    await processor.processEmail(emailId);

    // 3. Verify results
    const metaResult = await client.query('SELECT * FROM email_meta WHERE email_id = $1', [emailId]);
    const labelsResult = await client.query(
      `SELECT l.name, el.confidence_score 
       FROM labels l 
       JOIN email_labels el ON l.id = el.label_id 
       WHERE el.email_id = $1`, 
      [emailId]
    );

    console.log('\n--- Verification Results ---');
    console.log('Meta:', {
      is_urgent: metaResult.rows[0].is_urgent,
      is_escalation: metaResult.rows[0].is_escalation,
      has_embedding: !!metaResult.rows[0].embedding
    });
    
    console.log('Assigned Labels:', labelsResult.rows);

    if (metaResult.rows[0].is_urgent && labelsResult.rows.some(l => l.name === 'Urgent')) {
      console.log('✅ SUCCESS: Email correctly classified and labeled as Urgent');
    } else {
      console.error('❌ FAILURE: Email not correctly labeled');
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await client.end();
  }
}

testLabelAssignment();
