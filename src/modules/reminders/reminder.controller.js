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
exports.list = list;
exports.resolve = resolve;
exports.generate = generate;
const service = __importStar(require("./reminder.service"));
/**
 * @swagger
 * /api/reminders:
 *   get:
 *     summary: List all active reminders
 *     description: Get all unresolved reminders sorted by priority (highest first)
 *     tags: [Reminders]
 *     responses:
 *       200:
 *         description: List of active reminders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Reminder'
 */
async function list(req, res) {
    res.json(await service.listReminders());
}
/**
 * @swagger
 * /api/reminders/{id}/resolve:
 *   post:
 *     summary: Resolve a reminder
 *     description: Mark a reminder as resolved
 *     tags: [Reminders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Reminder ID
 *     responses:
 *       200:
 *         description: Reminder resolved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 */
async function resolve(req, res) {
    const id = parseInt(req.params.id, 10);
    await service.resolveReminder(id);
    res.json({ ok: true });
}
/**
 * @swagger
 * /api/reminders/generate:
 *   post:
 *     summary: Generate new reminders
 *     description: Analyze emails and generate reminders for unread hierarchy/client emails, missing MoMs, escalations, and urgent client requests
 *     tags: [Reminders]
 *     responses:
 *       200:
 *         description: Reminders generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 */
async function generate(req, res) {
    await service.generateRemindersFromMeta();
    res.json({ ok: true });
}
