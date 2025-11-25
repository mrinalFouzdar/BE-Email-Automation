import { client } from '../../config/db';
export async function searchSimilar(vec:any[], limit=5) {
  const r = await client.query('SELECT e.id, e.subject, e.body, m.embedding <-> $1::vector AS distance FROM email_meta m JOIN emails e ON m.email_id = e.id WHERE m.embedding IS NOT NULL ORDER BY m.embedding <-> $1::vector LIMIT $2', [vec, limit]);
  return r.rows;
}
