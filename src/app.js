"use strict";
// import express from 'express';
// import cors from 'cors';
// import bodyParser from 'body-parser';
// import { client } from './config/db';
// import { createAuthUrl, handleCallback } from './oauth';
// import dotenv from 'dotenv';
// import fetch from 'node-fetch';
// dotenv.config();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// const app = express();
// app.use(cors());
// app.use(bodyParser.json());
// app.get("/", (req, res) => {
//   res.send("Email RAG Backend is running ✔️");
// });
// // OAuth start
// app.get('/auth/google', (_req, res) => {
//   const url = createAuthUrl();
//   res.redirect(url);
// });
// // OAuth callback
// app.get('/oauth2/callback', async (req, res) => {
//   const code = req.query.code as string;
//   if (!code) return res.status(400).send('Missing code');
//   try {
//     const tokens = await handleCallback(code);
//     res.send('OAuth success. Tokens stored.');
//   } catch (err) {
//     console.error('OAuth callback error', err);
//     res.status(500).send('OAuth failed');
//   }
// });
// // similarity endpoint — accepts ?q=some text and returns top matches
// app.get('/api/similar', async (req, res) => {
//   try {
//     const q = req.query.q as string;
//     if (!q) return res.status(400).json({ error: 'q required' });
//     // create embedding via OpenAI
//     const OpenAI = require('openai').OpenAI;
//     const clientOpen = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
//     const embResp = await clientOpen.embeddings.create({
//       model: 'text-embedding-3-small',
//       input: q
//     });
//     const vec = embResp.data[0].embedding;
//     // run similarity search
//     const sql = `SELECT e.id, e.subject, e.body, (m.embedding <-> $1::vector) AS distance
//                  FROM email_meta m JOIN emails e ON m.email_id = e.id
//                  WHERE m.embedding IS NOT NULL
//                  ORDER BY m.embedding <-> $1::vector
//                  LIMIT 5`;
//     const r = await client.query(sql, [vec]);
//     res.json(r.rows);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'similarity failed' });
//   }
// });
// export default app;
// import { processAndEmbed } from './process_with_embeddings';
// app.post('/api/process-with-embeddings', async (_req, res) => {
//   try {
//     const n = await processAndEmbed();
//     res.json({ processed: n });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'processing failed' });
//   }
// });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./config/swagger");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const email_routes_1 = __importDefault(require("./modules/emails/email.routes"));
const reminder_routes_1 = __importDefault(require("./modules/reminders/reminder.routes"));
const classify_routes_1 = __importDefault(require("./modules/classify/classify.routes"));
const account_routes_1 = __importDefault(require("./modules/accounts/account.routes"));
const extension_routes_1 = __importDefault(require("./modules/extension/extension.routes"));
const error_1 = require("./core/error");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
app.get('/', (_req, res) => res.send('Email RAG Backend is running'));
// Swagger Documentation
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Email RAG API Docs'
}));
// API Routes
app.use('/oauth2', auth_routes_1.default);
app.use('/api/emails', email_routes_1.default);
app.use('/api/reminders', reminder_routes_1.default);
app.use('/api/classify', classify_routes_1.default);
app.use('/api/accounts', account_routes_1.default);
app.use('/api/extension', extension_routes_1.default);
app.use(error_1.errorHandler);
exports.default = app;
