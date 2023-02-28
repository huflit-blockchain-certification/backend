import { Router } from 'express';
import {
  user,
  auth,
  certificateType,
  graduationCourse,
  graduationYear,
  dac,
  recipentProfile,
} from './services/index';
import permission from './shared/middlewares/permission';
import { Permission } from './shared/database/model/ApiKey';
import apiKey from './shared/middlewares/apiKey';

const router = Router();

/*---------------------------------------------------------*/
router.use(apiKey);
/*---------------------------------------------------------*/
/*---------------------------------------------------------*/
router.use(permission(Permission.GENERAL));
/*---------------------------------------------------------*/
router.use('/user', user);
router.use('/auth', auth);
router.use('/certType', certificateType);
router.use('/graduationCourse', graduationCourse);
router.use('/graduationYear', graduationYear);
router.use('/dac', dac);
router.use('/recipentProfile', recipentProfile);
export default router;
