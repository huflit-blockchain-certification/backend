import {
  DACRepository,
  InfoUserRepository,
  UserRepository,
  GraduationCourseRepository,
  GraduationYearRepository,
  CertificateTypeRepository,
} from '../../shared/database/repository';
import { DAC, Role } from '../../shared/database/model';
import { hasDuplicateAndMustDuplicateIU } from './utils';
import { BadRequestError } from '../../shared/core/apiError';
import { Types } from 'mongoose';
import {
  PaginationGetList,
  DTORegistrationNumber,
  DTORegistrationIdNumber,
} from './interface';
export default class RecipentProfileService {
  private dacRepository: DACRepository;
  private infoUserRepository: InfoUserRepository;
  private userRepository: UserRepository;
  private graduationCourseRepository: GraduationCourseRepository;
  private graduationYearRepository: GraduationYearRepository;
  private certificateTypeRepository: CertificateTypeRepository;

  constructor(
    dacRepository: DACRepository,
    infoUserRepository: InfoUserRepository,
    userRepository: UserRepository,
    graduationCourseRepository: GraduationCourseRepository,
    graduationYearRepository: GraduationYearRepository,
    certificateTypeRepository: CertificateTypeRepository,
  ) {
    this.dacRepository = dacRepository;
    this.infoUserRepository = infoUserRepository;
    this.userRepository = userRepository;
    this.graduationCourseRepository = graduationCourseRepository;
    this.graduationYearRepository = graduationYearRepository;
    this.certificateTypeRepository = certificateTypeRepository;
  }

  public async getList(
    pagination: PaginationGetList,
    identityUniversity: string,
  ): Promise<DAC[] | null> {
    return await this.dacRepository.findByIUniAndPagination(
      pagination,
      identityUniversity,
    );
  }

  public async updateInfo(idDAC: Types.ObjectId, body: any): Promise<void> {
    const dac = await this.detail(idDAC);
    await this.checkExistedCourseAndYear(body.year, body.nameCourse);

    switch (true) {
      case Boolean(dac?.dispensingStatus):
        throw new BadRequestError('Data up to blockchain, cannot update');
      case Boolean(dac?.idNumber):
        throw new BadRequestError(
          'IdNumber existed cannot edit info. Can delete if DAC cannot upto blockchain',
        );
    }

    await this.dacRepository.update(idDAC, body);
  }

  public async delete(
    id: Types.ObjectId,
    identityUniversity: string,
  ): Promise<void> {
    const dac = await this.detail(id);
    if (dac?.dispensingStatus)
      throw new BadRequestError('Certificate have up to blockchain');
    if (identityUniversity !== dac?.iU)
      throw new BadRequestError('Param identityUniversity not manage this DAC');
      
    await this.dacRepository.deleteById(id);
  }

  public async registrationNum(
    listRegistrationNum: DTORegistrationNumber[],
    identityUniversity: string,
  ): Promise<DAC[]> {
    for (let i = 0; i < listRegistrationNum.length; i++) {
      const regisNum = listRegistrationNum[i];
      const dac = await this.dacRepository.findById(regisNum._id);

      switch (true) {
        case !(await this.dacRepository.isExisted(regisNum._id)):
          throw new BadRequestError('Invalid DAC at ' + dac?.id);

        case !(await this.dacRepository.isValidRegistrationNumber(
          regisNum.registrationNumber,
        )):
          throw new BadRequestError(
            'Invalid dac at ' +
              dac?.id +
              ' registration number existed in list',
          );

        case Boolean(dac?.registrationNum):
          throw new BadRequestError(
            'Have Registration Number. Cannot Registration number again ',
          );

        case dac?.iU !== identityUniversity:
          throw new BadRequestError(
            'field iU of DAC invalid identityUniversityParam ' +
              identityUniversity +
              'at' +
              dac?.id,
          );

        case dac?.dispensingStatus:
          throw new BadRequestError(
            `Dispensing Status must false at ${dac?.id}`,
          );

        default:
        // handle the case where none of the above conditions are true
      }
    }
    const promises: DAC[] = [];
    await Promise.all(
      listRegistrationNum.map(
        async (registrationNumber: DTORegistrationNumber) => {
          const dac = await this.updateRegistrationNumber(registrationNumber);
          dac && promises.push(dac);
        },
      ),
    ).catch((err) => {
      throw new BadRequestError(err);
    });

    return promises;
  }

  public async regisIdNumber(
    listIdNumber: DTORegistrationIdNumber[],
    identityUniversity: string,
  ): Promise<DAC[]> {
    for (let i = 0; i < listIdNumber.length; i++) {
      const entityIdNumber = listIdNumber[i];
      const dac = await this.detail(entityIdNumber._id);
      switch (true) {
        case !(await this.dacRepository.isExisted(entityIdNumber._id)):
          throw new BadRequestError('Invalid DAC at ' + dac?.id);

        case !(await this.dacRepository.isValidRegisIdNumber(
          entityIdNumber.idNumber,
        )):
          throw new BadRequestError(
            'Invalid dac at ' +
              dac?.id +
              ' registration number existed in list',
          );

        case !dac?.registrationNum:
          throw new BadRequestError(
            ' Must have a registration number at _id' + dac?.id,
          );

        case Boolean(dac?.idNumber):
          throw new BadRequestError(
            `DAC idNumber have already at ID ${dac?.id}`,
          );

        case dac?.dispensingStatus:
          throw new BadRequestError(
            `Dispensing Status must false at ${dac?.id}`,
          );

        case identityUniversity !== dac?.iU:
          throw new BadRequestError(
            'field iU of DAC invalid identityUniversityParam ' +
              identityUniversity +
              'at' +
              dac?.id,
          );

        default:
        // handle the case where none of the above conditions are true
      }
    }

    const promises: DAC[] = [];
    await Promise.all(
      listIdNumber.map(async (entityIdNumber: DTORegistrationIdNumber) => {
        const dac = await this.updateRegistrationIdNumber(entityIdNumber);
        dac && promises.push(dac);
      }),
    ).catch((err) => {
      throw new BadRequestError(err);
    });

    return promises;
  }
  public async detail(id: Types.ObjectId): Promise<DAC | null> {
    return await this.dacRepository.findById(id);
  }

  public async create(
    listDAC: DAC[],
    identityUniversity: string,
  ): Promise<void> {
    if (hasDuplicateAndMustDuplicateIU(listDAC))
      throw new BadRequestError(
        'Have duplicate data in list or must iU duplicate',
      );
    if (!listDAC.length) throw new BadRequestError('Not data in list');

    for (let i = 0; i < listDAC.length; i++) {
      const dac = listDAC[i];
      if (dac.iU !== identityUniversity)
        throw new BadRequestError(
          `Must Identity University ${identityUniversity} at identityStudent ${dac.iSt}`,
        );
      await this.isValid(dac, Role.UNIVERSITY);
      await this.isValid(dac);
    }
    const promises = [];
    await Promise.all(
      listDAC.map(async (dac: DAC) => {
        dac.dateOfIssuing = null;
        dac.nameTypeCertificate = null;
        dac.idNumber = null;
        dac.registrationNum = null;
        dac.typeCertificate = null;
        dac.levelCertificate = null
        dac.dispensingStatus = false;
        promises.push(this.dacRepository.create(dac));
      }),
    ).catch((err) => {
      throw new BadRequestError(err);
    });
  }

  private async isValid(dac: DAC, role: Role = Role.STUDENT): Promise<void> {
    const entityValidate = (({
      studentName,
      universityName,
      iU,
      iSt,
      placeOfBirth,
      nation,
      dateOfBirth,
      gender,
      year,
      nameCourse,
    }: DAC) => ({
      name: role === Role.STUDENT ? studentName : universityName,
      identity: role === Role.STUDENT ? iSt : iU,
      placeOfBirth,
      nation,
      dateOfBirth,
      gender,
      year,
      nameCourse,
    }))(dac);

    const infoUser = await this.infoUserRepository.findByIdentity(
      entityValidate.identity,
    );
    if (!infoUser)
      throw new BadRequestError(
        `Identity ${entityValidate.identity} not existed , create user student`,
      );

    const dateBirthInfo = new Date(
      infoUser.dateOfBirth || new Date(),
    ).getTime();
    const dateBirthEntity = new Date(
      entityValidate.dateOfBirth || '',
    ).getTime();
    if (role === Role.STUDENT) {
      switch (true) {
        case infoUser.name !== entityValidate.name:
          throw new BadRequestError(
            `Info User not match from ${infoUser.identity} at name ${entityValidate.name}`,
          );
        case infoUser.identity !== entityValidate.identity:
          throw new BadRequestError(
            `Info User not match from ${infoUser.identity} at identity ${entityValidate.identity}`,
          );
        case infoUser.address !== entityValidate.placeOfBirth:
          throw new BadRequestError(
            `Info User not match from ${infoUser.identity} at address ${entityValidate.placeOfBirth}`,
          );
        case infoUser.gender !== entityValidate.gender:
          throw new BadRequestError(
            `Info User not match from ${infoUser.identity} at gender ${entityValidate.gender}`,
          );
        case dateBirthInfo !== dateBirthEntity:
          throw new BadRequestError(
            `Info User not match from ${infoUser.identity} at placeOfBirth ${dateBirthEntity}`,
          );
        default:
          break;
      }
    }

    const isValidOfRole = await this.userRepository.isValidRole(
      infoUser.identity,
      role,
    );
    if (!isValidOfRole)
      throw new BadRequestError(
        `Invalid identifier: ${infoUser.identity} not of role ${role}`,
      );

    await this.checkExistedCourseAndYear(
      entityValidate.year || '',
      entityValidate.nameCourse || '',
    );
  }

  private async checkExistedCourseAndYear(
    year: string,
    nameCourse: string,
  ): Promise<void> {
    const isExistedYear = await this.graduationYearRepository.findByYear(year);
    if (!isExistedYear)
      throw new BadRequestError(`Not match graduation year ${year}`);

    const isExistedCourse = await this.graduationCourseRepository.findByCourse(
      nameCourse,
    );
    if (!isExistedCourse)
      throw new BadRequestError(`Not match graduation course ${nameCourse}`);
  }

  private async updateRegistrationNumber({
    _id,
    registrationNumber,
  }: DTORegistrationNumber): Promise<DAC | null> {
    const body = {
      registrationNum: registrationNumber,
    };
    await this.dacRepository.update(_id, body);
    const dac = await this.detail(_id);
    return dac;
  }

  private async updateRegistrationIdNumber({
    _id,
    idNumber,
  }: DTORegistrationIdNumber): Promise<DAC | null> {
    const body = {
      idNumber,
    };
    await this.dacRepository.update(_id, body);
    const dac = await this.detail(_id);
    return dac;
  }
}
