"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchSimilar = searchSimilar;
const db_1 = require("../../config/db");
async function searchSimilar(vec, limit = 5) {
    const r = await db_1.client.query('SELECT e.id, e.subject, e.body, m.embedding <-> $1::vector AS distance FROM email_meta m JOIN emails e ON m.email_id = e.id WHERE m.embedding IS NOT NULL ORDER BY m.embedding <-> $1::vector LIMIT $2', [vec, limit]);
    return r.rows;
}
