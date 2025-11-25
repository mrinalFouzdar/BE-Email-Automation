// import express from 'express';
// import cors from 'cors';
// import bodyParser from 'body-parser';
// import { client } from './config/db';
// import { createAuthUrl, handleCallback } from './oauth';
// import dotenv from 'dotenv';
// import fetch from 'node-fetch';
// dotenv.config();

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
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import authRoutes from './modules/auth/auth.routes';
import emailRoutes from './modules/emails/email.routes';
import reminderRoutes from './modules/reminders/reminder.routes';
import classifyRoutes from './modules/classify/classify.routes';
import accountRoutes from './modules/accounts/account.routes';
import { errorHandler } from './core/error';

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/', (_req, res) => res.send('Email RAG Backend is running'));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Email RAG API Docs'
}));

// API Routes
app.use('/oauth2', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/classify', classifyRoutes);
app.use('/api/accounts', accountRoutes);

app.use(errorHandler);

export default app;