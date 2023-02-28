import { Router } from 'express';
import { authentication, authorization } from '../../shared/middlewares';
import {
  DACRepository,
  InfoUserRepository,
  UserRepository,
  GraduationCourseRepository,
  GraduationYearRepository,
  CertificateTypeRepository,
} from '../../shared/database/repository';
import { Role } from '../../shared/database/model';
import { role } from '../../shared/helpers/utils';
import validator, { ValidationSource } from '../../shared/helpers/validator';
import schema from './schema';
import schemaPagi from '../graduationYear/schema';
import RecipentProfileService from './recipientProfile.service';
import RecipentProfileController from './recipientProfile.controller';

const dacRepository = new DACRepository();
const infoUserRepository = new InfoUserRepository();
const userRepository = new UserRepository();
const graduationCourseRepository = new GraduationCourseRepository();
const graduationYearRepository = new GraduationYearRepository();
const certificateTypeRepository = new CertificateTypeRepository();
const recipentProfileService = new RecipentProfileService(
  dacRepository,
  infoUserRepository,
  userRepository,
  graduationCourseRepository,
  graduationYearRepository,
  certificateTypeRepository,
);
const recipentProfileController = new RecipentProfileController(
  recipentProfileService,
);

const router = Router();

// GET DAC OF UNIVERSITY
router.get(
  '/:identity',
  authentication,
  role(Role.UNIVERSITY,Role.DOET),
  authorization,
  validator(schemaPagi.pagination, ValidationSource.QUERY),
  validator(schema.iUni, ValidationSource.PARAM),
  recipentProfileController.getList,
);

//CREATE
router.post(
  '/',
  authentication,
  role(Role.UNIVERSITY),
  authorization,
  validator(schema.recipentProfile),
  recipentProfileController.create,
);

// DOET UPDATE INFO DAC
router.patch(
  '/:iU/:idDAC',
  authentication,
  role(Role.DOET),
  authorization,
  validator(schema.iUniAndIdDAC, ValidationSource.PARAM),
  validator(schema.updateDAC),
  recipentProfileController.updateDAC,
);

export default router;
