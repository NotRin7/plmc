import CryptoJS from 'crypto-js';
import * as ecc from 'tiny-secp256k1';
import { Buffer } from 'buffer';

export function isValidPubKeyHex(pubKeyHex) {
  try {
    const pubKey = Buffer.from(pubKeyHex, 'hex');
    return ecc.isPoint(pubKey);
  } catch {
    return false;
  }
}

// ECDH(sharedSecret) => SHA256(hex) => AES key.
export function getSharedSecret(privateKey, theirPubKeyHex) {
  const theirPubKey = Buffer.from(theirPubKeyHex, 'hex');
  const sharedPoint = ecc.pointMultiply(theirPubKey, privateKey);
  if (!sharedPoint) {
    throw new Error('Could not generate shared secret');
  }
  const sharedHex = Buffer.from(sharedPoint).toString('hex');
  const hashed = CryptoJS.SHA256(sharedHex).toString(CryptoJS.enc.Hex);
  return Buffer.from(hashed, 'hex');
}

export function encryptMessage(plaintext, theirPubKeyHex, privateKey) {
  try {
    const sharedSecret = getSharedSecret(privateKey, theirPubKeyHex);
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(plaintext, CryptoJS.enc.Hex.parse(sharedSecret.toString('hex')), {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return `${iv.toString(CryptoJS.enc.Hex)}:${encrypted.toString()}`;
  } catch (err) {
    console.error('Encryption failed', err);
    return plaintext;
  }
}

export function decryptMessage(payload, theirPubKeyHex, privateKey) {
  try {
    if (!payload.includes(':')) return payload;
    const [ivHex, ciphertext] = payload.split(':');
    if (!ivHex || !ciphertext) return payload;
    const sharedSecret = getSharedSecret(privateKey, theirPubKeyHex);
    const decrypted = CryptoJS.AES.decrypt(ciphertext, CryptoJS.enc.Hex.parse(sharedSecret.toString('hex')), {
      iv: CryptoJS.enc.Hex.parse(ivHex),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }).toString(CryptoJS.enc.Utf8);
    return decrypted || payload;
  } catch {
    return payload;
  }
}
