import Joi from 'joi';

export const createEmailSchema = Joi.object({
  body: Joi.object({
    subject: Joi.string().required().messages({
      'any.required': 'Subject is required',
    }),
    body: Joi.string().allow('').default(''),
    sender_email: Joi.string().email().required().messages({
      'string.email': 'Invalid sender email',
      'any.required': 'Sender email is required',
    }),
    sender_name: Joi.string().optional(),
    to_recipients: Joi.array().items(Joi.string().email()).optional(),
    cc_recipients: Joi.array().items(Joi.string().email()).optional(),
    account_id: Joi.number().integer().positive().optional(),
  }),
});

export const getEmailsSchema = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    is_unread: Joi.boolean().optional(),
    sender: Joi.string().optional(),
    search: Joi.string().optional(),
  }).optional(),
  body: Joi.object().optional(),
  params: Joi.object().optional(),
});

export const emailIdParamSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

export const markAsReadSchema = Joi.object({
  body: Joi.object({
    is_read: Joi.boolean().default(true),
  }),
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});
