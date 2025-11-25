"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyUnprocessed = classifyUnprocessed;
const db_1 = require("../../config/db");
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
async function classifyUnprocessed() {
    const emails = await db_1.client.query(`
    SELECT e.* FROM emails e
    LEFT JOIN email_meta m ON m.email_id = e.id
    WHERE m.id IS NULL
    LIMIT 20
  `);
    for (const e of emails.rows) {
        const subject = e.subject || '';
        const body = e.body || '';
        const is_meeting = /meeting|meet|call/i.test(subject + body);
        const is_escalation = /asap|urgent|immediately|escalation/i.test(subject + body);
        const is_hierarchy = /boss|manager|director|ceo/i.test(subject + body);
        const is_client = /client|customer|vendor/i.test(subject + body);
        const is_urgent = is_escalation || /urgent/i.test(subject + body);
        // get embedding
        let embedding = null;
        try {
            const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: subject + '\n\n' + body });
            embedding = resp.data[0].embedding;
            console.log("🚀 ~ classifyUnprocessed ~ embedding:", embedding);
        }
        catch (err) {
            console.warn('Embedding failed', err);
        }
        await db_1.client.query(`INSERT INTO email_meta(email_id, is_meeting, is_escalation, is_hierarchy, is_client, is_urgent, classification, embedding)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [e.id, is_meeting, is_escalation, is_hierarchy, is_client, is_urgent, JSON.stringify({ subject }), embedding]);
    }
    return emails.rowCount;
}
