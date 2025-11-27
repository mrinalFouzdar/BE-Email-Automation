import Joi from 'joi';

export const createAccountSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Invalid email address',
      'any.required': 'Email is required',
    }),
    provider: Joi.string().valid('gmail', 'imap').required().messages({
      'any.only': 'Provider must be either gmail or imap',
      'any.required': 'Provider is required',
    }),
    imap_host: Joi.string().when('provider', {
      is: 'imap',
      then: Joi.string().required(),
      otherwise: Joi.string().optional(),
    }),
    imap_port: Joi.number().integer().min(1).max(65535).when('provider', {
      is: 'imap',
      then: Joi.number().required(),
      otherwise: Joi.number().optional(),
    }),
    imap_user: Joi.string().when('provider', {
      is: 'imap',
      then: Joi.string().required(),
      otherwise: Joi.string().optional(),
    }),
    imap_password: Joi.string().when('provider', {
      is: 'imap',
      then: Joi.string().required(),
      otherwise: Joi.string().optional(),
    }),
    imap_tls: Joi.boolean().default(true),
  }),
});

export const updateAccountSchema = Joi.object({
  body: Joi.object({
    is_active: Joi.boolean().optional(),
    imap_host: Joi.string().optional(),
    imap_port: Joi.number().integer().min(1).max(65535).optional(),
    imap_user: Joi.string().optional(),
    imap_password: Joi.string().optional(),
    imap_tls: Joi.boolean().optional(),
  }),
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});

export const accountIdParamSchema = Joi.object({
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
});
