import Joi from 'joi';

export const createLabelSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(1).max(100).required().messages({
      'any.required': 'Label name is required',
      'string.max': 'Label name cannot exceed 100 characters',
    }),
    color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).default('#3B82F6').messages({
      'string.pattern.base': 'Invalid color format (use hex format like #3B82F6)',
    }),
    description: Joi.string().optional(),
  }),
});

export const assignLabelSchema = Joi.object({
  body: Joi.object({
    email_id: Joi.number().integer().positive().required(),
    label_id: Joi.number().integer().positive().required(),
    confidence_score: Joi.number().min(0).max(1).optional(),
  }),
});

export const labelIdParamSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});
