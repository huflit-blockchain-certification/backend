import Joi from 'joi';
import { JoiObjectId } from '../../../shared/helpers/validator';

export default {
  iUni: Joi.object().keys({
    identityUniversity: Joi.string()
      .required()
      .regex(/^[0-9]{12}$/),
  }),
  issue: Joi.object().keys({
    listDAC: Joi.array().items({
      _id: JoiObjectId().required(),
    }),
    idCertificate: JoiObjectId().required(),
  }),
  pagination: Joi.object().keys({
    page: Joi.number().required().integer().min(1),
    limit: Joi.number().required().integer().min(1),
  }),
};
