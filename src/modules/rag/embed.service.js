"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.embedText = embedText;
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
async function embedText(text) {
    const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
    return resp.data[0].embedding;
}
