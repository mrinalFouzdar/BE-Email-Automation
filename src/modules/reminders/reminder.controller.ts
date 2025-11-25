import { Request, Response } from 'express';
import * as service from './reminder.service';

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
export async function list(req: Request, res: Response) {
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
export async function resolve(req: Request, res: Response) {
  const id = parseInt(req.params.id,10);
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
export async function generate(req: Request, res: Response) {
  await service.generateRemindersFromMeta();
  res.json({ ok: true });
}
