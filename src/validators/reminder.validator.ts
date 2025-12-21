import Joi from 'joi';

export const createReminderSchema = Joi.object({
  body: Joi.object({
    email_id: Joi.number().integer().positive().required(),
    reminder_text: Joi.string().min(1).required().messages({
      'any.required': 'Reminder text is required',
    }),
    reason: Joi.string().optional(),
    priority: Joi.number().integer().min(1).max(5).default(1),
  }),
});

export const updateReminderSchema = Joi.object({
  body: Joi.object({
    reminder_text: Joi.string().min(1).optional(),
    reason: Joi.string().optional(),
    priority: Joi.number().integer().min(1).max(5).optional(),
    resolved: Joi.boolean().optional(),
  }),
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

export const reminderIdParamSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

export const getReminderQuerySchema = Joi.object({
  query: Joi.object({
    resolved: Joi.boolean().optional(),
    priority: Joi.number().integer().min(1).max(5).optional(),
    limit: Joi.number().integer().min(1).max(100).default(50),
    userId: Joi.number().integer().positive().optional(),
  }),
}).unknown(true); // Allow body and params (they'll be ignored)
