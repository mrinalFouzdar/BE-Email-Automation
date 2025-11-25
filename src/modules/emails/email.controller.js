"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetch = fetch;
exports.list = list;
exports.getEmailMeta = getEmailMeta;
const service = __importStar(require("./email.service"));
const db_1 = require("../../config/db");
/**
 * @swagger
 * /api/emails/fetch:
 *   get:
 *     summary: Fetch new emails from Gmail
 *     description: Connects to Gmail via OAuth and fetches the latest emails (max 20)
 *     tags: [Emails]
 *     responses:
 *       200:
 *         description: Emails fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fetched:
 *                   type: integer
 *                   description: Number of emails fetched
 *       500:
 *         description: Fetch failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function fetch(req, res) {
    try {
        const n = await service.fetchFromGmail();
        res.json({ fetched: n });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'fetch failed' });
    }
}
/**
 * @swagger
 * /api/emails/list:
 *   get:
 *     summary: List all emails
 *     description: Retrieve all emails ordered by received date (limit 100)
 *     tags: [Emails]
 *     responses:
 *       200:
 *         description: List of emails
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Email'
 */
async function list(req, res) {
    const r = await db_1.client.query('SELECT * FROM emails ORDER BY received_at DESC LIMIT 100');
    res.json(r.rows);
}
/**
 * @swagger
 * /api/emails/{id}/meta:
 *   get:
 *     summary: Get email metadata/classification
 *     description: Retrieve AI-powered classification metadata for a specific email
 *     tags: [Emails]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Email ID
 *     responses:
 *       200:
 *         description: Email metadata
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmailMeta'
 *       500:
 *         description: Failed to get metadata
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
async function getEmailMeta(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        const r = await db_1.client.query('SELECT is_hierarchy, is_client, is_meeting, is_escalation, is_urgent, is_mom FROM email_meta WHERE email_id = $1', [id]);
        if (r.rows.length === 0) {
            return res.json({
                is_hierarchy: false,
                is_client: false,
                is_meeting: false,
                is_escalation: false,
                is_urgent: false,
                is_mom: false
            });
        }
        res.json(r.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'failed to get meta' });
    }
}
