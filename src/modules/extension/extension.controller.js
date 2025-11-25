"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEmail = processEmail;
const langchain_service_1 = require("./langchain.service");
/**
 * @swagger
 * /api/extension/process-email:
 *   post:
 *     summary: Process email from browser extension
 *     description: Receives email data from browser extension, stores in vector DB, and returns AI classification
 *     tags: [Extension]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - body
 *               - sender
 *             properties:
 *               subject:
 *                 type: string
 *                 description: Email subject
 *               body:
 *                 type: string
 *                 description: Email body content
 *               sender:
 *                 type: string
 *                 description: Sender email address
 *               senderName:
 *                 type: string
 *                 description: Sender name
 *               receivedAt:
 *                 type: string
 *                 format: date-time
 *                 description: When the email was received
 *     responses:
 *       200:
 *         description: Email processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 emailId:
 *                   type: integer
 *                 labels:
 *                   type: object
 *                   properties:
 *                     is_hierarchy:
 *                       type: boolean
 *                     is_client:
 *                       type: boolean
 *                     is_meeting:
 *                       type: boolean
 *                     is_escalation:
 *                       type: boolean
 *                     is_urgent:
 *                       type: boolean
 *                 reasoning:
 *                   type: string
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Processing failed
 */
async function processEmail(req, res) {
    try {
        const { subject, body, sender, senderName, receivedAt } = req.body;
        // Validate required fields
        if (!subject || !body || !sender) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: subject, body, and sender are required'
            });
        }
        // Process email with LangChain multi-agent system
        const result = await (0, langchain_service_1.processEmailWithLangChain)({
            subject,
            body,
            sender,
            senderName: senderName || sender,
            receivedAt: receivedAt || new Date().toISOString()
        });
        res.json({
            success: true,
            emailId: result.emailId,
            labels: result.labels,
            reasoning: result.reasoning,
            message: 'Email processed and stored successfully'
        });
    }
    catch (err) {
        console.error('Extension email processing error:', err);
        res.status(500).json({
            success: false,
            error: err.message || 'Failed to process email'
        });
    }
}
