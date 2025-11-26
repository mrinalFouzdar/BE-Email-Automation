import { client } from '../../config/db';
export async function listReminders() {
    const r = await client.query(`
    SELECT r.*, e.subject, e.sender_email, e.is_unread,
           m.is_hierarchy, m.is_client, m.is_meeting, m.is_escalation, m.is_urgent
    FROM reminders r
    JOIN emails e ON r.email_id = e.id
    LEFT JOIN email_meta m ON m.email_id = e.id
    WHERE r.resolved = false
    ORDER BY r.priority DESC, r.created_at DESC
  `);
    return r.rows;
}
export async function resolveReminder(id) {
    await client.query('UPDATE reminders SET resolved = true WHERE id = $1', [id]);
}
export async function generateRemindersFromMeta() {
    console.log('🔔 Generating reminders...');
    // Get current user email from OAuth (simplified - you may need to adjust this)
    const userEmailQuery = await client.query('SELECT scope FROM oauth_tokens ORDER BY id DESC LIMIT 1');
    const userEmail = userEmailQuery.rows[0]?.scope || null; // This is a placeholder - ideally get actual user email
    // 1. UNREAD EMAILS FROM HIERARCHY/CLIENTS WHERE USER IS IN "TO"
    console.log('Checking unread hierarchy/client emails...');
    const unreadImportant = await client.query(`
    SELECT e.id, e.subject, e.sender_email,
           m.is_hierarchy, m.is_client
    FROM emails e
    JOIN email_meta m ON m.email_id = e.id
    WHERE e.is_unread = true
      AND (m.is_hierarchy = true OR m.is_client = true)
      AND array_length(e.to_recipients, 1) > 0
  `);
    for (const email of unreadImportant.rows) {
        const reason = email.is_hierarchy ? 'unread_hierarchy' : 'unread_client';
        const reminderText = email.is_hierarchy
            ? `Unread email from Hierarchy: ${email.sender_email}`
            : `Unread email from Client: ${email.sender_email}`;
        const exists = await client.query('SELECT 1 FROM reminders WHERE email_id = $1 AND reason = $2 AND resolved = false', [email.id, reason]);
        if (exists.rowCount === 0) {
            await client.query('INSERT INTO reminders(email_id, reminder_text, reason, priority) VALUES($1,$2,$3,$4)', [email.id, reminderText, reason, email.is_hierarchy ? 8 : 7]);
            console.log(`✓ Created reminder for unread ${email.is_hierarchy ? 'hierarchy' : 'client'} email: ${email.id}`);
        }
    }
    // 2. MISSING MoM FOR HIERARCHY OR CLIENT MEETINGS
    console.log('Checking missing MoM...');
    const missingMoM = await client.query(`
    SELECT e.id, e.subject, m.is_hierarchy, m.is_client
    FROM emails e
    JOIN email_meta m ON m.email_id = e.id
    WHERE m.is_meeting = true
      AND m.has_mom_received = false
      AND (m.is_hierarchy = true OR m.is_client = true)
  `);
    for (const meeting of missingMoM.rows) {
        const meetingType = meeting.is_hierarchy ? 'Hierarchy' : meeting.is_client ? 'Client' : 'Team';
        const reminderText = `Minutes of Meeting not received for ${meetingType} meeting: "${meeting.subject}"`;
        const exists = await client.query('SELECT 1 FROM reminders WHERE email_id = $1 AND reason = $2 AND resolved = false', [meeting.id, 'missing_mom']);
        if (exists.rowCount === 0) {
            await client.query('INSERT INTO reminders(email_id, reminder_text, reason, priority) VALUES($1,$2,$3,$4)', [meeting.id, reminderText, 'missing_mom', 8]);
            console.log(`✓ Created reminder for missing MoM: ${meeting.id}`);
        }
    }
    // 3. ESCALATION EMAILS
    console.log('Checking escalation emails...');
    const escalations = await client.query(`
    SELECT e.id, e.subject, e.sender_email, e.is_unread
    FROM emails e
    JOIN email_meta m ON m.email_id = e.id
    WHERE m.is_escalation = true
      AND e.is_unread = true
  `);
    for (const esc of escalations.rows) {
        const exists = await client.query('SELECT 1 FROM reminders WHERE email_id = $1 AND reason = $2 AND resolved = false', [esc.id, 'escalation']);
        if (exists.rowCount === 0) {
            await client.query('INSERT INTO reminders(email_id, reminder_text, reason, priority) VALUES($1,$2,$3,$4)', [esc.id, `Escalation detected from ${esc.sender_email}: "${esc.subject}"`, 'escalation', 10]);
            console.log(`✓ Created reminder for escalation: ${esc.id}`);
        }
    }
    // 4. URGENT CLIENT REQUESTS
    console.log('Checking urgent client requests...');
    const urgentClients = await client.query(`
    SELECT e.id, e.subject, e.sender_email, e.is_unread
    FROM emails e
    JOIN email_meta m ON m.email_id = e.id
    WHERE m.is_urgent = true
      AND m.is_client = true
      AND e.is_unread = true
  `);
    for (const urgent of urgentClients.rows) {
        const exists = await client.query('SELECT 1 FROM reminders WHERE email_id = $1 AND reason = $2 AND resolved = false', [urgent.id, 'urgent_client']);
        if (exists.rowCount === 0) {
            await client.query('INSERT INTO reminders(email_id, reminder_text, reason, priority) VALUES($1,$2,$3,$4)', [urgent.id, `Urgent request from client ${urgent.sender_email}: "${urgent.subject}"`, 'urgent_client', 9]);
            console.log(`✓ Created reminder for urgent client request: ${urgent.id}`);
        }
    }
    console.log('✅ Reminder generation complete');
}
