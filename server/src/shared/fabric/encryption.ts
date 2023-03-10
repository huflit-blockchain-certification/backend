import { MerkleTree } from 'merkletreejs';
import CryptoJS, { SHA256 } from 'crypto-js';
import { invokeChaincode } from './chaincode';
import { loadHexKeysFromWallet } from './wallet-utils';
import { queryCertificateSchema } from './callFuncChainCode';
import { KJUR } from 'jsrsasign';
import { InfoProof } from '../../services/dac/student/interface';
import { DAC } from '../database/model';
import { VerifyProof } from '../../services/dac/general/interface';
import { fabric } from '../../config';
interface InfoProofEncryption extends InfoProof {
  dac: DAC;
}

interface InfoVerifyProof extends VerifyProof {
  dac: DAC;
}
const ecdsa = new KJUR.crypto.ECDSA({ curve: 'secp256r1' });

/**

 * Generate merkle tree from certificate data using a pre-defined schema
 * @param {certificates} certData
 * @returns {Promise<MerkleTree>}
 */
async function generateMerkleTree(certData: any): Promise<MerkleTree> {
  const args = {
    func: 'queryCertificateSchema',
    args: ['v1'],
    isQuery: true,
    identity: certData?.iU,
  };

  const certSchema = await invokeChaincode(args);

  console.log('======certSchema====', certSchema);

  const certDataArray = [];

  //certSchema used to order the certificate elements appropriately.
  //ordering[i] = key of i'th item that should go in the certificate array.
  for (let i = 0; i < certSchema.ordering.length; i++) {
    const itemKey = certSchema.ordering[i];
    certDataArray.push(certData[itemKey]);
  }

  console.log('=====certDataArray====', certDataArray);
  const mTreeLeaves = certDataArray.map((x) => SHA256(x));
  console.log('======mTreeLeaves====', mTreeLeaves);
  const mTree: MerkleTree = new MerkleTree(mTreeLeaves, SHA256);
  console.log('======mTree====', mTree);
  return mTree;
}

/**
 * Generate merkle tree root from certificate data using a pre-defined schema
 * @param {certificates} certData
 * @returns {Promise<string>}
 */
async function generateMerkleRoot(certData: any) {
  const mTree = await generateMerkleTree(certData);
  return mTree.getRoot().toString('hex');
}

/**
 * Sign a String with a private key using Elliptic Curve Digital Signature Algorithm
 * @param stringToSign
 * @param signerEmail
 * @returns {Promise<String>}
 */
async function createDigitalSignature(
  stringToSign: string,
  signerIdentity: string,
): Promise<string> {
  const hexKeyWallet = await loadHexKeysFromWallet(signerIdentity);
  const signedData = ecdsa.signHex(stringToSign, hexKeyWallet.privateKey);
  return signedData;
}

/**
 * Generate a merkleTree Proof object.
 * @param {String[]} paramsToShare - Name of parameters that are to be shared.
 * @param {String} certUUID
 * @param {String} studentEmail - Certiificate holder email. Used to invoke chaincode.
 * @returns {Promise<Buffer[]>} proofObject
 */
async function generateDACProof(
  { sharedFields, idDAC, dac }: InfoProofEncryption,
  identityStudent: string,
) {
  const dacSchema = await queryCertificateSchema(identityStudent);

  const mTree = await generateMerkleTree(dac);

  const paramsToShareIndex = getParamsIndexArray(
    sharedFields,
    dacSchema.ordering,
  );

  const multiProof = mTree.getMultiProof(
    mTree.getHexLayersFlat(),
    paramsToShareIndex,
  );
  return multiProof;
}

async function verifyCertificateProof({
  proof,
  disclosedData,
  dacID,
  dac,
}: InfoVerifyProof) {
  const dacSchema = await queryCertificateSchema(fabric.enrollAdminName);
  const mTree: MerkleTree = await generateMerkleTree(dac);

  const disclosedDataParamNames = [];
  const disclosedDataValues = [];

  for (const field in disclosedData) {
    disclosedDataParamNames.push(field);
    disclosedDataValues.push(disclosedData[field]);
  }
  console.log(dacSchema.ordering);
  const paramsToShareIndex = getParamsIndexArray(
    disclosedDataParamNames,
    dacSchema.ordering,
  );

  const mTreeRoot = mTree.getRoot();

  const disclosedDataHash : any = [
    {
      words: [
        938582623,
        -2137401705,
        -565579844,
        -1300692533,
        -835452354,
        -911008349,
        -1210292256,
        1354134520
      ],
      sigBytes: 32
    },
    {
      words: [
        686488867,
        -1406304593,
        2003321499,
        2042343990,
        1388796902,
        -1582299986,
        -1036326857,
        -1441661810
      ],
      sigBytes: 32
    },
    {
      words: [
        414126960,
        -1261423497,
        -817546915,
        1823215734,
        -1486217026,
        681533300,
        -1984068472,
        -1998818935
      ],
      sigBytes: 32
    }
  ]
  try {
    const verificationSuccess = mTree.verifyMultiProof(
      mTreeRoot,
      paramsToShareIndex,
      disclosedDataHash,
      mTree.getDepth(),
      proof,
    );

    console.log(verificationSuccess);
  } catch (err) {
    console.log(err);
  }

  // console.log('Verification status: ' + verificationSuccess);
  // return verificationSuccess;
}

function getParamsIndexArray(paramsToShare: string[], ordering: string[]) {
  const paramsToShareIndex = [];
  for(const el of paramsToShare)
  {
    const index = ordering.findIndex((orderingElement: string) => {
      return orderingElement === el;
    }) ;
    if(index === -1) continue;
    paramsToShareIndex.push(index);
  }

  return paramsToShareIndex;
}

export {
  generateMerkleRoot,
  createDigitalSignature,
  generateDACProof,
  verifyCertificateProof,
};
