import {
  UserRepository,
  InfoUserRepository,
  KeyStoreRepository,
} from '../../shared/database/repository';
import { User, Role, Gender } from '../../shared/database/model';
import { BadRequestError, AuthFailureError } from '../../shared/core/apiError';
import crypto from 'crypto';
import { registerUser } from '../../shared/fabric/enrollment';
import { Types } from 'mongoose';
import { invokeChaincode } from '../../shared/fabric/chaincode';
import { getUserData } from './utils';
import { createTokens } from '../../shared/helpers/jwt.utils';
export interface newUser {
  userName: string;
  password: string;
  roles: Role[];
  name: string;
  phone: string;
  dateOfBirth: Date;
  gender: Gender;
  nation: string;
  address: string;
  identity: string;
  email: string;
}

export interface userLogin {
  userName: string;
  password: string;
}
export default class AuthService {
  private userRepository: UserRepository;
  private infoUserRepository: InfoUserRepository;
  private keyStoreRepository: KeyStoreRepository;

  constructor(
    userRepository: UserRepository,
    infoUserRepository: InfoUserRepository,
    keyStoreRepository: KeyStoreRepository,
  ) {
    this.userRepository = userRepository;
    this.infoUserRepository = infoUserRepository;
    this.keyStoreRepository = keyStoreRepository;
  }

  public async login({ userName, password }: userLogin) {
    const user = await this.userRepository.findByUserName(userName);
    if (!user) throw new BadRequestError('User does not exist');

    const isValidPassword = await user.isValidPassword(password);
    if (!isValidPassword) throw new AuthFailureError('Invalid password');

    const accessTokenKey = crypto.randomBytes(64).toString('hex');
    const refreshTokenKey = crypto.randomBytes(64).toString('hex');

    await this.keyStoreRepository.create(user, accessTokenKey, refreshTokenKey);
    const tokens = await createTokens(user, accessTokenKey, refreshTokenKey);
    const userData = await getUserData(user);
    
    return {
      tokens,
      userData,
    };
  }

  public async register(listUser: newUser[]): Promise<void> {
    if (this.hasDuplicate(listUser)) {
      throw new BadRequestError(
        'Duplicate field in list . Check identity, userName, email, phone ',
      );
    }

    for (let i = 0; i < listUser.length; i++) {
      const user: newUser = listUser[i];
      await this.checkRegister(user);
    }

    const promises: Promise<void>[] = [];
    await Promise.all(
      listUser.map(async (user: newUser) => {
        promises.push(this.createUser(user));
      }),
    ).catch((err) => {
      throw new BadRequestError(err);
    });
  }

  private async createUser(newUser: newUser): Promise<any> {
    const [user, infoUser] = await Promise.all([
      (async () => ({
        userName: newUser.userName,
        password: newUser.password,
        roles: newUser.roles,
        publicKey: '',
      }))(),
      (async () => ({
        identity: newUser.identity,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        address: newUser.address,
        dateOfBirth: newUser.dateOfBirth,
        gender: newUser.gender,
        nation: newUser.nation,
        idUser: new Types.ObjectId(),
      }))(),
    ]);

    const keys = await registerUser(infoUser.identity);
    user.publicKey = keys.publicKey;

    // CHECK REGISTER  have UNIVERSITY WILL REGISTER UP BLOCKCHAIN
    const checkRegisterUNI = await user.roles.includes(Role.UNIVERSITY);
    if (checkRegisterUNI) {
      const argsCallFunction = {
        func: 'registerUniversity',
        args: [infoUser.name, user.publicKey, infoUser.address],
        isQuery: false,
        identity: infoUser.identity,
      };
      await invokeChaincode(argsCallFunction);
    }

    const createdUser = await this.userRepository.create(user as User);
    infoUser.idUser = createdUser._id;
    await this.infoUserRepository.create(infoUser);
  }

  private async checkRegister({
    userName,
    email,
    identity,
    phone,
  }: newUser): Promise<void> {
    const userExisted = await this.userRepository.findByUserName(userName);
    if (userExisted) throw new BadRequestError('User exists already');

    const identityExisted = await this.infoUserRepository.findByIdentity(
      identity,
    );

    if (identityExisted) throw new BadRequestError('Identity exists already');

    const emailExisted = await this.infoUserRepository.findByEmail(email);
    if (emailExisted) throw new BadRequestError('Email already exists');

    const phoneExisted = await this.infoUserRepository.findByPhone(phone);
    if (phoneExisted) throw new BadRequestError('Phone already exists');
  }

  private hasDuplicate(users: newUser[]): boolean {
    const seenFields = new Set<string>();

    for (const { userName, email, phone, identity } of users) {
      if (
        seenFields.has(userName) ||
        seenFields.has(email) ||
        seenFields.has(phone) ||
        seenFields.has(identity)
      ) {
        return true;
      }

      seenFields.add(userName);
      seenFields.add(email);
      seenFields.add(phone);
      seenFields.add(identity);
    }

    return false;
  }
}
