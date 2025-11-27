import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from './error.middleware';

/**
 * Validation middleware factory for Joi
 */
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate request data
      const { error, value } = schema.validate(
        {
          body: req.body,
          query: req.query,
          params: req.params,
        },
        { abortEarly: false }
      );

      if (error) {
        const message = error.details.map((detail) => detail.message).join(', ');
        throw new ValidationError(message);
      }

      // Replace request data with validated data
      req.body = value.body || req.body;
      req.query = value.query || req.query;
      req.params = value.params || req.params;

      next();
    } catch (error) {
      next(error);
    }
  };
};
