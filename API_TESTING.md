# LangChain Multi-Agent Email Processing API

## Overview
This API endpoint receives email data from a browser extension, processes it using a LangChain-powered multi-agent system, stores it in a vector database, and returns AI-powered classification labels.

## Endpoint

**POST** `/api/extension/process-email`

## Multi-Agent System Architecture

The system uses three specialized agents:

1. **Classifier Agent**: Uses GPT-4o-mini to analyze and classify emails into categories
2. **Embedding Agent**: Generates vector embeddings using OpenAI's text-embedding-3-small model
3. **Storage Agent**: Stores email data and metadata in PostgreSQL with pgvector

## Request Format

```json
{
  "subject": "Urgent: Client Meeting Tomorrow",
  "body": "Hi team,\n\nWe have an urgent client meeting scheduled for tomorrow at 10 AM. Please prepare the quarterly reports and be ready to discuss the project timeline.\n\nRegards,\nJohn Smith\nCEO",
  "sender": "john.smith@company.com",
  "senderName": "John Smith",
  "receivedAt": "2024-01-15T09:30:00Z"
}
```

### Required Fields
- `subject` (string): Email subject line
- `body` (string): Email body content
- `sender` (string): Sender email address

### Optional Fields
- `senderName` (string): Sender display name (defaults to sender email)
- `receivedAt` (string): ISO 8601 timestamp (defaults to current time)

## Response Format

```json
{
  "success": true,
  "emailId": 123,
  "labels": {
    "is_hierarchy": true,
    "is_client": true,
    "is_meeting": true,
    "is_escalation": false,
    "is_urgent": true
  },
  "reasoning": "This email is from a CEO (hierarchy), discusses a client meeting (client and meeting), and contains urgent language requesting immediate action (urgent).",
  "message": "Email processed and stored successfully"
}
```

## Classification Categories

| Label | Description |
|-------|-------------|
| `is_hierarchy` | Email from management/leadership (boss, manager, director, CEO, VP, C-level) |
| `is_client` | Email from external client, customer, vendor, or business partner |
| `is_meeting` | Email discusses or schedules a meeting, call, or discussion |
| `is_escalation` | Email has escalation tone (urgent concerns, issues, problems) |
| `is_urgent` | Email requests urgent action or immediate response (ASAP, deadline) |

## Testing Examples

### Example 1: Client Meeting Request

```bash
curl -X POST http://localhost:4000/api/extension/process-email \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Q4 Review Meeting",
    "body": "Hello, I would like to schedule a meeting to review the Q4 performance metrics with your team. Are you available next Tuesday?",
    "sender": "client@partner-company.com",
    "senderName": "Sarah Johnson"
  }'
```

Expected labels: `is_client: true`, `is_meeting: true`

### Example 2: Urgent Issue from Manager

```bash
curl -X POST http://localhost:4000/api/extension/process-email \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "URGENT: Production Server Down",
    "body": "Team, the production server is down and customers are unable to access our service. We need to fix this ASAP!",
    "sender": "manager@company.com",
    "senderName": "Engineering Manager"
  }'
```

Expected labels: `is_hierarchy: true`, `is_urgent: true`, `is_escalation: true`

### Example 3: Regular Internal Email

```bash
curl -X POST http://localhost:4000/api/extension/process-email \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Team Lunch Update",
    "body": "Hey everyone, just a reminder that team lunch is moved to Friday instead of Thursday this week.",
    "sender": "colleague@company.com",
    "senderName": "Alex"
  }'
```

Expected labels: Most labels should be `false`

## Environment Setup

Make sure these environment variables are set in your `.env` file:

```bash
# OpenAI API Key for LangChain
OPENAI_API_KEY=your_openai_api_key_here

# Database connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/email_rag
```

## How It Works

1. **Browser extension sends email data** → POST to `/api/extension/process-email`
2. **Classifier Agent analyzes email** → Uses GPT-4o-mini to classify into categories
3. **Embedding Agent creates vector** → Generates embedding using text-embedding-3-small
4. **Storage Agent saves data** → Stores email and metadata with vector in PostgreSQL
5. **API returns labels** → Extension receives classification results

## API Documentation

Full Swagger API documentation available at: `http://localhost:4000/api-docs`
