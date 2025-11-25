import request from 'supertest';
import app from '../src/app';
import { client, connect } from '../src/db';

beforeAll(async () => {
  await connect();
  // ensure migrations applied (assume init.sql present)
  const sql = require('fs').readFileSync(require('path').resolve(__dirname, '../migrations/init.sql'),'utf8');
  await client.query(sql);
  // clear test data
  await client.query('DELETE FROM reminders; DELETE FROM email_meta; DELETE FROM emails;');
});

afterAll(async () => {
  await client.end();
});

test('process-with-embeddings creates reminders for samples', async () => {
  // insert sample emails
  await client.query(`INSERT INTO emails(gmail_id, sender_email, subject, body) VALUES($1,$2,$3,$4)`, ['t1','boss@example.com','Please do ASAP','This is urgent']);
  await client.query(`INSERT INTO emails(gmail_id, sender_email, subject, body) VALUES($1,$2,$3,$4)`, ['t2','client@x.com','Meeting tomorrow','Discuss project']);
  // call processing
  const res = await request(app).post('/api/process-with-embeddings');
  expect(res.status).toBe(200);
  // check reminders exist
  const r = await client.query('SELECT * FROM reminders');
  expect(r.rowCount).toBeGreaterThanOrEqual(1);
}, 20000);
