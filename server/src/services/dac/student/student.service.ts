import {
  CryptoVerifyRepository,
  DACRepository,
} from '../../../shared/database/repository';
import { Pagination } from '../manage/interface';
import { InfoUserRepository } from '../../../shared/database/repository/infoUser.repository';
import { BadRequestError } from '../../../shared/core/apiError';
import { getAllCertificateByStudent, queryCertificateByUUID } from '../../../shared/fabric/callFuncChainCode/index';
import { InfoProof, Proof } from './interfaces';
import { generateDACProof } from '../../../shared/fabric';
import { Types } from 'mongoose';
import { CryptoVerify, DAC } from '../../../shared/database/model';
import { formatSchemaDisclosedData, formatStringToDate, randomKey } from './utils';
import { paginationManual } from '../../../shared/helpers/utils';
import { ADMIN_ID } from '../../../common/constant';

export default class DACStudentService {
  private dacRepository: DACRepository;
  private infoUserRepository: InfoUserRepository;
  private cryptoVerifyRepository: CryptoVerifyRepository;
  constructor(
    dacRepository: DACRepository,
    infoUserRepository: InfoUserRepository,
    cryptoVerifyRepository: CryptoVerifyRepository,
  ) {
    this.dacRepository = dacRepository;
    this.infoUserRepository = infoUserRepository;
    this.cryptoVerifyRepository = cryptoVerifyRepository;
  }

  public async getListDACOfStudent(
    identity: string,
    pagination: Pagination,
  ): Promise<any> {

    const student =
      await this.infoUserRepository.findByIdentityAndAccountUserFromStudent(
        identity,
      );
    if (!student) throw new BadRequestError('Student not exist');

    const dacLedgerDataList = await getAllCertificateByStudent(
      student.idUser.publicKey,
      student.identity,
    );

    const listDAC = await dacLedgerDataList.map((el: any) => {
      return JSON.parse(el.properties);
    });

    return {
      listDAC:  await paginationManual(listDAC, pagination),
      totalPage: dacLedgerDataList.length
    };
  }

  public async generateProof(
    { sharedFields, idDAC }: InfoProof,
    identityStudent: string,
  ): Promise<Proof> {

    const certBlockchain = await queryCertificateByUUID(idDAC.toString(), ADMIN_ID);

    const infoProofEncryption = {
      sharedFields,
      idDAC,
      dac : await formatStringToDate(JSON.parse(certBlockchain.properties)) 
    };


    const infoDACProof = await generateDACProof(
      infoProofEncryption,
      identityStudent,
    );

    const disclosedData : DAC | null= await this.dacRepository.findByIdSelectField(
      idDAC,
      sharedFields,
    );
    if(!disclosedData) throw new BadRequestError(`DAC is not found ${idDAC}`);

    const key = await randomKey();
    const proofResponse = {
      proof: infoDACProof.multiProofs,
      disclosedData: formatSchemaDisclosedData(disclosedData),
      dacID: idDAC,
      identityStudent: identityStudent,
      mTreeRootBlockchain: infoDACProof.rootHash,
      key,
    };

    const modelCryptoVerify: CryptoVerify = {
      key,
      properties: JSON.stringify(proofResponse),
    };
    await this.cryptoVerifyRepository.create(modelCryptoVerify);

    return proofResponse;
  }

  public async count(): Promise<number> {
    return this.dacRepository.count();
  }


  public async detail(id: Types.ObjectId): Promise<DAC | null> {
    return await this.dacRepository.findById(id);
  }


}
