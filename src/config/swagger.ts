import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Email RAG System API',
      version: '1.0.0',
      description: 'AI-Powered Email Management System with Smart Reminders and Classification',
      contact: {
        name: 'API Support',
        email: 'support@emailrag.com'
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
    ],
    tags: [
      {
        name: 'Auth',
        description: 'OAuth and authentication endpoints'
      },
      {
        name: 'Emails',
        description: 'Email management and fetching'
      },
      {
        name: 'Reminders',
        description: 'Smart reminder system'
      },
      {
        name: 'Classification',
        description: 'Email classification endpoints'
      }
    ],
    components: {
      schemas: {
        Email: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Email ID'
            },
            gmail_id: {
              type: 'string',
              description: 'Gmail message ID'
            },
            thread_id: {
              type: 'string',
              description: 'Gmail thread ID'
            },
            subject: {
              type: 'string',
              description: 'Email subject'
            },
            sender_email: {
              type: 'string',
              description: 'Sender email address'
            },
            to_recipients: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'To recipients'
            },
            cc_recipients: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'CC recipients'
            },
            body: {
              type: 'string',
              description: 'Email body content'
            },
            is_unread: {
              type: 'boolean',
              description: 'Unread status'
            },
            labels: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Gmail labels'
            },
            received_at: {
              type: 'string',
              format: 'date-time',
              description: 'Received timestamp'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Created timestamp'
            }
          }
        },
        EmailMeta: {
          type: 'object',
          properties: {
            is_hierarchy: {
              type: 'boolean',
              description: 'Email from hierarchy/management'
            },
            is_client: {
              type: 'boolean',
              description: 'Email from client'
            },
            is_meeting: {
              type: 'boolean',
              description: 'Meeting-related email'
            },
            is_escalation: {
              type: 'boolean',
              description: 'Escalation email'
            },
            is_urgent: {
              type: 'boolean',
              description: 'Urgent email'
            },
            is_mom: {
              type: 'boolean',
              description: 'Minutes of Meeting email'
            }
          }
        },
        Reminder: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Reminder ID'
            },
            email_id: {
              type: 'integer',
              description: 'Associated email ID'
            },
            reminder_text: {
              type: 'string',
              description: 'Reminder message'
            },
            reason: {
              type: 'string',
              enum: ['unread_hierarchy', 'unread_client', 'missing_mom', 'escalation', 'urgent_client'],
              description: 'Reminder reason'
            },
            priority: {
              type: 'integer',
              description: 'Priority (7-10, higher is more urgent)'
            },
            resolved: {
              type: 'boolean',
              description: 'Resolution status'
            },
            subject: {
              type: 'string',
              description: 'Email subject'
            },
            sender_email: {
              type: 'string',
              description: 'Email sender'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Created timestamp'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            }
          }
        }
      }
    }
  },
  apis: ['./src/modules/*/*.routes.ts', './src/modules/*/*.controller.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
