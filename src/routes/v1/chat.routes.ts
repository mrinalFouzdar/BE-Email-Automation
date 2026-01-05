import { Router } from 'express';
import { chatController } from '../../controllers/chat.controller.js';
import { authenticateJWT } from '../../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /api/v1/chat:
 *   post:
 *     summary: Ask a question using AI chat with RAG
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *             properties:
 *               question:
 *                 type: string
 *                 description: The question to ask
 *                 example: "What is the company dress policy?"
 *               conversationHistory:
 *                 type: array
 *                 description: Previous conversation messages
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant, system]
 *                     content:
 *                       type: string
 *               useLocalLLM:
 *                 type: boolean
 *                 description: Use local Ollama LLM instead of Gemini
 *                 default: false
 *               searchThreshold:
 *                 type: number
 *                 description: Similarity threshold for search (0-1)
 *                 default: 0.5
 *               maxResults:
 *                 type: number
 *                 description: Maximum number of search results to use
 *                 default: 5
 *     responses:
 *       200:
 *         description: AI-generated answer with sources
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 answer:
 *                   type: string
 *                 sources:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [email, pdf]
 *                       subject:
 *                         type: string
 *                       source:
 *                         type: string
 *                       date:
 *                         type: string
 *                       similarity:
 *                         type: number
 *                       filename:
 *                         type: string
 *                 conversationHistory:
 *                   type: array
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', authenticateJWT, (req, res) => chatController.chat(req, res));

/**
 * @swagger
 * /api/v1/chat/history:
 *   get:
 *     summary: Get chat history
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Chat history
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/history', authenticateJWT, (req, res) =>
  chatController.getChatHistory(req, res)
);

export default router;
