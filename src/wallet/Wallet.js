import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import CryptoJS from 'crypto-js';
import { Buffer } from 'buffer';
import { DEFAULT_RPC_CONFIG, rpcCall } from './rpc';
import {
  decryptMessage as decryptMessageWithKey,
  encryptMessage as encryptMessageWithKey,
  getSharedSecret as deriveSharedSecret
} from './crypto';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

export const PALLADIUM_NETWORK = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'plm',
  bip32: {
    public: 76067358,
    private: 76066276
  },
  pubKeyHash: 55,
  scriptHash: 5,
  wif: 128
};

const MESSAGE_PREFIX = Buffer.from('PLMC');

/**
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {'me'|'them'} sender
 * @property {string} text
 * @property {number} timestamp
 * @property {number} status
 * @property {string} txid
 * @property {number=} amount
 */

/**
 * @typedef {Object} Contact
 * @property {string} id
 * @property {string} address
 * @property {string} name
 * @property {number} unread
 */

export class Wallet {
  constructor() {
    this.messages = {};
    this.rpcConfig = { ...DEFAULT_RPC_CONFIG };
    this.processedTxIds = new Set();
    this.txCache = new Map();
    this.pollInterval = null;
    this.balancePollInterval = null;
    this.lastSeenTimestamps = {};
    this.keyPair = null;
    this.address = '';
    this.messageCallback = null;
    this.scripthashStatus = null;

    this.loadConfig().then((saved) => {
      if (saved) {
        this.rpcConfig = { ...DEFAULT_RPC_CONFIG, ...saved };
        if (saved.wif) {
          try {
            this.keyPair = ECPair.fromWIF(saved.wif, PALLADIUM_NETWORK);
            const { address } = bitcoin.payments.p2wpkh({
              pubkey: this.keyPair.publicKey,
              network: PALLADIUM_NETWORK
            });
            this.address = address || '';
            this.loadLastSeen();
          } catch {
            console.warn('Saved WIF invalid');
          }
        }
      }
    });
  }

  async rpc(method, params = []) {
    return rpcCall(this.rpcConfig, method, params);
  }

  isElectrum() {
    return this.rpcConfig?.mode === 'electrum';
  }

  getScripthash() {
    if (!this.address) return '';
    const script = bitcoin.address.toOutputScript(this.address, PALLADIUM_NETWORK);
    const hash = bitcoin.crypto.sha256(script);
    return Buffer.from(hash).reverse().toString('hex');
  }

  async getUtxos() {
    if (!this.address) return [];
    if (this.isElectrum()) {
      const scripthash = this.getScripthash();
      const utxos = await this.rpc('blockchain.scripthash.listunspent', [scripthash]);
      let mapped = (utxos || []).map((u) => ({
        txid: u.tx_hash,
        vout: u.tx_pos,
        amount: u.value / 1e8,
        height: u.height
      }));
      if (this.rpcConfig?.allowUnconfirmedSpend === false) {
        mapped = mapped.filter((u) => u.height > 0);
      }

      return mapped;
    }

    return this.rpc('listunspent', [0, 9999999, [this.address], true]);
  }

  async getRawTransaction(txid) {
    if (this.txCache.has(txid)) return this.txCache.get(txid);
    let raw;
    if (this.isElectrum()) {
      raw = await this.rpc('blockchain.transaction.get', [txid, false]);
    } else {
      raw = await this.rpc('getrawtransaction', [txid]);
    }
    if (raw) this.txCache.set(txid, raw);
    return raw;
  }

  getStorageKey(key) {
    return this.address ? `${key}_${this.address}` : key;
  }

  getRecipientOutputInfo(tx) {
    let recipientAddress = '';
    let recipientAmount = 0;

    for (const output of tx.outs) {
      if (output.script[0] === bitcoin.opcodes.OP_RETURN) continue;
      try {
        const addr = bitcoin.address.fromOutputScript(output.script, PALLADIUM_NETWORK);
        if (!addr) continue;
        if (!recipientAddress && addr !== this.address) {
          recipientAddress = addr;
          recipientAmount += output.value / 1e8;
        } else if (addr === recipientAddress) {
          recipientAmount += output.value / 1e8;
        }
      } catch {
        // Ignore non-standard outputs.
      }
    }

    return { recipientAddress, recipientAmount };
  }

  async loadConfig() {
    const raw = localStorage.getItem('palladium_config');
    return raw ? JSON.parse(raw) : null;
  }

  async saveConfig(config) {
    this.rpcConfig = config;
    localStorage.setItem('palladium_config', JSON.stringify(config));
  }

  async generateKey() {
    return ECPair.makeRandom({ network: PALLADIUM_NETWORK }).toWIF();
  }

  async connectToRpc(config, wif) {
    this.rpcConfig = config;
    const wifTrimmed = wif.trim();

    const candidateNetworks = [
      PALLADIUM_NETWORK,
      { ...PALLADIUM_NETWORK, wif: 128 },
      { ...PALLADIUM_NETWORK, wif: 239 }
    ];

    let keyPair = null;
    let lastError = null;
    for (const net of candidateNetworks) {
      try {
        keyPair = ECPair.fromWIF(wifTrimmed, net);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!keyPair) {
      console.error('WIF Import Failed:', lastError);
      throw new Error('Invalid WIF Key format. Please check your key.');
    }

    try {
      this.keyPair = keyPair;
      const { address } = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(this.keyPair.publicKey),
        network: PALLADIUM_NETWORK
      });
      this.address = address || '';
      if (!this.address) throw new Error('Could not derive address');
    } catch (err) {
      throw new Error(`Key processing error: ${err.message}`);
    }

    let balance = 0;
    let spendableBalance = 0;

    try {
      if (this.isElectrum()) {
        await this.rpc('blockchain.headers.subscribe', []);
        const utxos = await this.getUtxos();
        balance = utxos.reduce((sum, utxo) => sum + utxo.amount, 0);
        spendableBalance = utxos
          .filter((utxo) => utxo.height > 0)
          .reduce((sum, utxo) => sum + utxo.amount, 0);
      } else {
        const info = await this.rpc('getblockchaininfo');
        console.log('Connected to Node:', info?.chain);
        try {
          await this.rpc('importaddress', [this.address, 'palladium_chat_user', false]);
        } catch (err) {
          console.warn('Could not import watch-only address (maybe already exists):', err);
        }

        balance = (await this.rpc('listunspent', [0, 9999999, [this.address], true])).reduce(
          (sum, utxo) => sum + utxo.amount,
          0
        );
        spendableBalance = (await this.rpc('listunspent', [1, 9999999, [this.address], true])).reduce(
          (sum, utxo) => sum + utxo.amount,
          0
        );
      }
    } catch (err) {
      console.error('RPC Connection Error:', err);
      const label = this.isElectrum() ? 'ElectrumX Connection Failed' : 'Node Connection Failed';
      throw new Error(`${label}: ${err.message}. (Key is valid locally)`);
    }

    const toSave = { ...config, wif };
    await this.saveConfig(toSave);
    this.messages = {};
    this.loadSentMessages();
    this.loadLastSeen();

    return {
      wif: 'HIDDEN',
      address: this.address,
      pubKey: Buffer.from(this.keyPair.publicKey).toString('hex'),
      balance,
      spendableBalance
    };
  }

  getLocalKey() {
    if (!this.keyPair || !this.keyPair.privateKey) return '';
    return CryptoJS.SHA256(this.keyPair.privateKey.toString('hex')).toString(CryptoJS.enc.Hex);
  }

  persistLastSeen() {
    const localKey = this.getLocalKey();
    if (!localKey) return;
    const raw = JSON.stringify(this.lastSeenTimestamps);
    const encrypted = CryptoJS.AES.encrypt(raw, localKey).toString();
    const storageKey = this.getStorageKey('palladium_last_seen');
    localStorage.setItem(storageKey, encrypted);
  }

  loadLastSeen() {
    if (!this.keyPair) return;
    const storageKey = this.getStorageKey('palladium_last_seen');
    const encrypted = localStorage.getItem(storageKey);
    if (encrypted) {
      try {
        const localKey = this.getLocalKey();
        if (localKey) {
          const decrypted = CryptoJS.AES.decrypt(encrypted, localKey).toString(CryptoJS.enc.Utf8);
          if (decrypted) this.lastSeenTimestamps = JSON.parse(decrypted);
        }
      } catch {
        console.warn('Could not decrypt last seen timestamps. Starting fresh.');
        this.lastSeenTimestamps = {};
      }
    }
  }

  setLastSeen(contactId, timestamp) {
    this.lastSeenTimestamps[contactId] = timestamp;
    this.persistLastSeen();
  }

  getSharedSecret(theirPubKeyHex) {
    if (!this.keyPair) throw new Error('Wallet not loaded');
    const privKey = Buffer.from(this.keyPair.privateKey);
    return deriveSharedSecret(privKey, theirPubKeyHex);
  }

  encryptMessage(message, recipientPubKeyHex) {
    if (!this.keyPair?.privateKey) throw new Error('Wallet not loaded');
    return encryptMessageWithKey(message, recipientPubKeyHex, this.keyPair.privateKey);
  }

  decryptMessage(payload, senderPubKeyHex) {
    if (!this.keyPair?.privateKey) throw new Error('Wallet not loaded');
    return decryptMessageWithKey(payload, senderPubKeyHex, this.keyPair.privateKey);
  }

  /**
   * Stima i virtual bytes di una transazione P2WPKH
   * @param {number} numInputs - Numero di input
   * @param {number} opReturnDataLength - Lunghezza dati OP_RETURN
   * @param {boolean} hasRecipientOutput - Se c'è output destinatario
   * @param {boolean} hasChangeOutput - Se c'è output change
   * @returns {number} Virtual bytes stimati
   */
  estimateTransactionVBytes(numInputs, opReturnDataLength, hasRecipientOutput, hasChangeOutput) {
    // Base transaction overhead: version(4) + locktime(4) + input_count(1) + output_count(1)
    let baseSize = 10;

    // Per input P2WPKH: txid(32) + vout(4) + scriptSig_len(1) + sequence(4) = 41 bytes base
    baseSize += numInputs * 41;

    // Witness data per input P2WPKH: ~108 bytes (non in base size)
    // witness_count(1) + items(1) + sig_len(1) + sig(~72) + pubkey_len(1) + pubkey(33)
    const witnessSize = numInputs * 108;

    // OP_RETURN output: value(8) + script_len(1) + OP_RETURN(1) + OP_PUSHDATA(1) + data
    baseSize += 8 + 1 + 1 + 1 + opReturnDataLength;

    // P2WPKH output standard: value(8) + script_len(1) + script(22) = 31 bytes
    if (hasRecipientOutput) baseSize += 31;
    if (hasChangeOutput) baseSize += 31;

    // Segwit marker + flag
    const totalSize = baseSize + witnessSize + 2;

    // Formula vBytes per SegWit: (base_size * 3 + total_size) / 4
    // Aggiungiamo +2 vBytes come buffer di sicurezza per evitare "min relay fee not met"
    const vBytes = Math.ceil((baseSize * 3 + totalSize) / 4) + 2;

    return vBytes;
  }

  async sendMessage(recipientPubKeyHex, message, amountPlm = 0) {
    if (!this.keyPair || !this.address) throw new Error('Wallet not loaded');

    // Clean recipient pubkey
    const targetPubKeyHex = recipientPubKeyHex.trim().toLowerCase();

    // Encrypt message with ECDH-derived shared secret (secp256k1) + AES-CBC.
    const encrypted = this.encryptMessage(message, targetPubKeyHex);
    const opReturnData = Buffer.concat([MESSAGE_PREFIX, Buffer.from(encrypted)]);
    const opReturnDataLength = opReturnData.length;
    const opReturnScript = bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, opReturnData]);

    const utxos = await this.getUtxos();
    if (!utxos || utxos.length === 0) {
      throw new Error(`No funds available. Send coins to: ${this.address}`);
    }

    // Get fee rate from config (default 1 sat/vB, minimum 1 sat/vB)
    const feeRateSatPerVByte = Math.max(1, this.rpcConfig?.feeRate || 1);

    const payment = amountPlm && amountPlm > 0 ? amountPlm : 0;
    const dustThreshold = 0.00001; // Minimum relay fee / dust limit safety
    const recipientAmount = Math.max(dustThreshold, payment);

    let inputTotal = 0;
    let numInputsSelected = 0;
    const selectedUtxos = [];

    // Iterative UTXO selection considering dynamic fees
    for (const utxo of utxos) {
      selectedUtxos.push(utxo);
      numInputsSelected++;
      inputTotal += utxo.amount;

      // Estimate with change output
      const vBytesWithChange = this.estimateTransactionVBytes(
        numInputsSelected, opReturnDataLength, true, true
      );
      const feeWithChange = (vBytesWithChange * feeRateSatPerVByte) / 1e8;
      const requiredWithChange = recipientAmount + feeWithChange;

      if (inputTotal >= requiredWithChange) {
        const change = inputTotal - feeWithChange - recipientAmount;

        // If change is too small, recalculate without change output
        if (change < 546e-8) {
          const vBytesNoChange = this.estimateTransactionVBytes(
            numInputsSelected, opReturnDataLength, true, false
          );
          const feeNoChange = (vBytesNoChange * feeRateSatPerVByte) / 1e8;

          if (inputTotal >= recipientAmount + feeNoChange) {
            // Use fee without change
            break;
          }
        } else {
          // Sufficient change, we have enough funds
          break;
        }
      }
    }

    // Calculate final fee precisely
    const tempChange = inputTotal - recipientAmount;
    const hasChange = tempChange > 546e-8;

    const finalVBytes = this.estimateTransactionVBytes(
      numInputsSelected, opReturnDataLength, true, hasChange
    );
    const fee = (finalVBytes * feeRateSatPerVByte) / 1e8;
    const finalChange = inputTotal - fee - recipientAmount;

    if (finalChange < 0) {
      const required = recipientAmount + fee;
      const available = utxos.reduce((sum, u) => sum + u.amount, 0);
      throw new Error(`Insufficient funds. You need at least ${required.toFixed(8)} PLM (available: ${available.toFixed(8)} PLM). Fee rate: ${feeRateSatPerVByte} sat/vB (${fee.toFixed(8)} PLM for ~${finalVBytes} vBytes).`);
    }

    const psbt = new bitcoin.Psbt({ network: PALLADIUM_NETWORK });

    const p2wpkh = bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(this.keyPair.publicKey),
      network: PALLADIUM_NETWORK
    });

    // Add only selected UTXOs
    for (const utxo of selectedUtxos) {
      if (this.isElectrum()) {
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: p2wpkh.output,
            value: Math.floor(utxo.amount * 1e8)
          }
        });
      } else {
        const rawTx = await this.getRawTransaction(utxo.txid);
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          nonWitnessUtxo: Buffer.from(rawTx, 'hex')
        });
      }
    }

    psbt.addOutput({
      script: opReturnScript,
      value: 0
    });

    if (!targetPubKeyHex.match(/^[0-9a-fA-F]{66}$/) && !targetPubKeyHex.match(/^[0-9a-fA-F]{130}$/)) {
      throw new Error('Invalid Recipient Public Key. Must be 66 or 130 hex characters.');
    }

    const recipientPubKey = Buffer.from(targetPubKeyHex, 'hex');
    const { address: recipientAddress } = bitcoin.payments.p2wpkh({
      pubkey: recipientPubKey,
      network: PALLADIUM_NETWORK
    });

    if (recipientAmount > 0) {
      psbt.addOutput({
        address: recipientAddress,
        value: Math.floor(recipientAmount * 1e8)
      });
    }

    // Add change output only if it's above dust threshold (already calculated in hasChange)
    if (hasChange && finalChange > 546e-8) {
      psbt.addOutput({
        address: this.address,
        value: Math.floor(finalChange * 1e8)
      });
    }

    try {
      const signer = {
        publicKey: Buffer.from(this.keyPair.publicKey),
        sign: (hash) => Buffer.from(this.keyPair.sign(Buffer.from(hash)))
      };
      psbt.signAllInputs(signer);
      psbt.finalizeAllInputs();
    } catch (err) {
      throw new Error(`Signing error: ${err.message}`);
    }

    const rawSigned = psbt.extractTransaction().toHex();
    const txid = this.isElectrum()
      ? await this.rpc('blockchain.transaction.broadcast', [rawSigned])
      : await this.rpc('sendrawtransaction', [rawSigned]);

    const outgoing = {
      id: txid,
      sender: 'me',
      text: message,
      timestamp: Date.now(),
      status: 1,
      txid,
      amount: payment > 0 ? payment : undefined,
      fee: fee,
      totalSpent: recipientAmount + fee
    };

    if (!this.messages[recipientPubKeyHex]) this.messages[recipientPubKeyHex] = [];
    this.messages[recipientPubKeyHex].push(outgoing);
    this.persistSentMessages();

    return outgoing;
  }

  async getContacts() {
    const storageKey = this.getStorageKey('palladium_contacts');
    let raw = localStorage.getItem(storageKey);
    if (!raw && this.address) {
      const legacy = localStorage.getItem('palladium_contacts');
      if (legacy) {
        raw = legacy;
        localStorage.setItem(storageKey, legacy);
      }
    }

    return (raw ? JSON.parse(raw) : []).map((contact) => ({
      ...contact,
      name: contact.name || `...${contact.id.slice(-4)}`
    }));
  }

  async addContact(pubKeyHex, name) {
    const contacts = await this.getContacts();
    let derivedAddress = pubKeyHex;

    try {
      const { address } = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(pubKeyHex, 'hex'),
        network: PALLADIUM_NETWORK
      });
      if (address) derivedAddress = address;
    } catch {
      // Keep raw hex if address derivation fails.
    }

    const cleanName = name.trim() || `...${pubKeyHex.slice(-4)}`;
    contacts.push({
      id: pubKeyHex,
      address: derivedAddress,
      name: cleanName,
      unread: 0
    });

    const storageKey = this.getStorageKey('palladium_contacts');
    localStorage.setItem(storageKey, JSON.stringify(contacts));

    if (this.isElectrum()) {
      await this.scanContactHistory(pubKeyHex);
    }
  }

  async renameContact(pubKeyHex, name) {
    const contacts = await this.getContacts();
    const idx = contacts.findIndex((c) => c.id === pubKeyHex);

    if (idx !== -1) {
      contacts[idx].name = name;
    } else {
      let derivedAddress = pubKeyHex;
      try {
        const { address } = bitcoin.payments.p2wpkh({
          pubkey: Buffer.from(pubKeyHex, 'hex'),
          network: PALLADIUM_NETWORK
        });
        if (address) derivedAddress = address;
      } catch {
        // Keep raw hex if address derivation fails.
      }

      contacts.push({
        id: pubKeyHex,
        address: derivedAddress,
        name,
        unread: 0
      });
    }

    const storageKey = this.getStorageKey('palladium_contacts');
    localStorage.setItem(storageKey, JSON.stringify(contacts));

    if (this.isElectrum()) {
      await this.scanContactHistory(pubKeyHex);
    }
  }

  startBalancePolling(onBalance) {
    if (this.balancePollInterval) clearInterval(this.balancePollInterval);

    const poll = async () => {
      if (!this.address) return;
      try {
        const utxos = await this.getUtxos();
        const balance = utxos.reduce((sum, u) => sum + u.amount, 0);
        const spendableBalance = this.isElectrum()
          ? utxos.filter((u) => u.height > 0).reduce((sum, u) => sum + u.amount, 0)
          : balance;
        const pendingBalance = Math.max(0, balance - spendableBalance);
        onBalance({ balance, spendableBalance, pendingBalance });
      } catch (err) {
        console.warn('Failed to fetch balance:', err);
      }
    };

    poll();
    this.balancePollInterval = setInterval(poll, 2000);
  }

  stopBalancePolling() {
    if (this.balancePollInterval) {
      clearInterval(this.balancePollInterval);
      this.balancePollInterval = null;
    }
  }

  async deleteMessages(contactId) {
    if (this.messages[contactId]) delete this.messages[contactId];
    this.persistSentMessages();

    const contacts = (await this.getContacts()).filter((c) => c.id !== contactId);
    const storageKey = this.getStorageKey('palladium_contacts');
    localStorage.setItem(storageKey, JSON.stringify(contacts));
  }

  persistAllMessages() {
    if (!this.keyPair || !this.keyPair.privateKey) return;

    // Salva TUTTI i messaggi (inviati e ricevuti)
    const allMessagesByContact = {};
    Object.keys(this.messages).forEach((id) => {
      if (this.messages[id] && this.messages[id].length > 0) {
        allMessagesByContact[id] = this.messages[id];
      }
    });

    const raw = JSON.stringify(allMessagesByContact);
    const localKey = this.getLocalKey();
    if (!localKey) return;

    const encrypted = CryptoJS.AES.encrypt(raw, localKey).toString();
    const storageKey = this.getStorageKey('palladium_all_msgs');
    localStorage.setItem(storageKey, encrypted);
  }

  // Mantieni per backward compatibility
  persistSentMessages() {
    this.persistAllMessages();
  }

  loadAllMessages() {
    if (!this.keyPair) return;

    // Prova prima il nuovo storage (palladium_all_msgs)
    let storageKey = this.getStorageKey('palladium_all_msgs');
    let encrypted = localStorage.getItem(storageKey);

    // Fallback al vecchio storage (palladium_sent_msgs) per backward compatibility
    if (!encrypted) {
      storageKey = this.getStorageKey('palladium_sent_msgs');
      encrypted = localStorage.getItem(storageKey);

      if (!encrypted) {
        const legacy = localStorage.getItem('palladium_sent_msgs');
        if (legacy) {
          try {
            const legacyParsed = JSON.parse(legacy);
            if (legacyParsed && !legacyParsed.iv) {
              this.messages = legacyParsed;
              this.persistAllMessages();
            }
          } catch {
            // Ignore legacy parse errors.
          }
        }
        return;
      }
    }

    let decrypted = null;
    try {
      const localKey = this.getLocalKey();
      if (localKey) {
        const raw = CryptoJS.AES.decrypt(encrypted, localKey).toString(CryptoJS.enc.Utf8);
        if (raw) decrypted = JSON.parse(raw);
      }
    } catch {
      console.warn('Could not decrypt local history. Starting fresh.');
    }

    if (decrypted) {
      Object.keys(decrypted).forEach((id) => {
        if (!this.messages[id]) this.messages[id] = [];
        decrypted[id].forEach((msg) => {
          if (!this.messages[id].find((existing) => existing.id === msg.id)) {
            this.messages[id].push(msg);
          }
        });
      });
    }
  }

  // Mantieni per backward compatibility
  loadSentMessages() {
    this.loadAllMessages();
  }

  persistProcessedTxIds() {
    if (!this.keyPair) return;
    const storageKey = this.getStorageKey('palladium_processed_txids');
    const txidsArray = Array.from(this.processedTxIds);
    localStorage.setItem(storageKey, JSON.stringify(txidsArray));
  }

  loadProcessedTxIds() {
    if (!this.keyPair) return;
    const storageKey = this.getStorageKey('palladium_processed_txids');
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const txidsArray = JSON.parse(stored);
        this.processedTxIds = new Set(txidsArray);
      } catch {
        console.warn('Could not load processed tx IDs');
      }
    }
  }

  enforceRetention() {
    const days = this.rpcConfig.retentionDays;
    if (!days || days <= 0) return;

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let changed = false;

    Object.keys(this.messages).forEach((id) => {
      const before = this.messages[id].length;
      this.messages[id] = this.messages[id].filter((msg) => msg.timestamp > cutoff);
      if (this.messages[id].length !== before) changed = true;
    });

    if (changed) this.persistSentMessages();
  }

  getMessages(contactId) {
    return [...(this.messages[contactId] || [])].sort((a, b) => a.timestamp - b.timestamp);
  }

  onIncomingMessage(handler) {
    this.messageCallback = handler;
  }

  stopMessagePolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  startMessagePolling() {
    this.loadSentMessages();
    this.loadProcessedTxIds();
    this.enforceRetention();
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.scanChain();
    this.pollInterval = setInterval(() => this.scanChain(), 3000);
  }

  async scanChain(forceRescan = false) {
    if (!this.messageCallback) return;

    // Se forceRescan è true, resetta processedTxIds per riprocessare tutto
    if (forceRescan) {
      this.processedTxIds.clear();
      this.persistProcessedTxIds();
    }

    try {
      if (this.isElectrum()) {
        if (forceRescan) {
          const contacts = await this.getContacts();
          for (const contact of contacts) {
            await this.scanContactHistory(contact.id);
          }
        }
        await this.scanChainElectrum();
        return;
      }

      const contacts = await this.getContacts();
      const contactsByAddress = new Map(contacts.map((contact) => [contact.address, contact]));

      const hours = this.rpcConfig.rescanHours || 24;
      const count = Math.max(100, Math.ceil(hours * 24));
      const txs = await this.rpc('listtransactions', ['*', count]);

      for (const entry of txs) {
        const status = (entry.confirmations || 0) === 0 ? 1 : 2;

        if (entry.category === 'send') {
          let statusUpdated = false;
          for (const contactId in this.messages) {
            const idx = this.messages[contactId].findIndex(
              (msg) => msg.id === entry.txid || msg.txid === entry.txid
            );
            if (idx !== -1) {
              const existing = this.messages[contactId][idx];
              if (existing.status !== status) {
                const updated = { ...existing, status };
                this.messages[contactId][idx] = updated;
                this.messageCallback(contactId, updated, true, false);
                statusUpdated = true;
              }
            }
          }
          if (statusUpdated) this.persistSentMessages();
          continue;
        }

        if (entry.category !== 'receive') continue;
        if (this.processedTxIds.has(entry.txid)) continue;

        const rawTx = await this.rpc('getrawtransaction', [entry.txid]);
        const tx = bitcoin.Transaction.fromHex(rawTx);

        let outputToUs = false;
        let receivedAmount = 0;

        for (const output of tx.outs) {
          try {
            const addr = bitcoin.address.fromOutputScript(output.script, PALLADIUM_NETWORK);
            if (addr === this.address) {
              outputToUs = true;
              receivedAmount += output.value / 1e8;
            }
          } catch {
            // Ignore non-standard outputs.
          }
        }

        if (!outputToUs) continue;

        let existingContactId = null;
        let alreadyKnown = false;
        for (const contactId in this.messages) {
          const idx = this.messages[contactId].findIndex((msg) => msg.id === entry.txid);
          if (idx !== -1) {
            alreadyKnown = true;
            existingContactId = contactId;
            const existing = this.messages[contactId][idx];
            if (existing.status !== status) {
              const updated = { ...existing, status };
              this.messages[contactId][idx] = updated;
              this.messageCallback(contactId, updated, true, false);
            }
            break;
          }
        }

        if (alreadyKnown) {
          this.processedTxIds.add(entry.txid);
          continue;
        }

        // Extract OP_RETURN payload: "PLMC" + encryptedMessage (ivHex:ciphertext)
        let encodedMessage = '';
        tx.outs.forEach((output) => {
          if (output.script[0] === bitcoin.opcodes.OP_RETURN) {
            const decompiled = bitcoin.script.decompile(output.script);
            if (decompiled && decompiled.length > 1 && Buffer.isBuffer(decompiled[1])) {
              const payload = decompiled[1];
              if (payload.length > 4 && payload.slice(0, 4).equals(MESSAGE_PREFIX)) {
                encodedMessage = payload.slice(4).toString('utf8');
              } else {
                encodedMessage = payload.toString('utf8');
              }
            }
          }
        });

        if (!encodedMessage) {
          this.processedTxIds.add(entry.txid);
          continue;
        }

        // Determine sender public key from witness or legacy scriptSig.
        let senderPubKeyHex = '';
        if (tx.ins.length > 0) {
          const input = tx.ins[0];
          if (input.witness && input.witness.length === 2) {
            const candidate = input.witness[1];
            if (candidate && ecc.isPoint(candidate)) senderPubKeyHex = candidate.toString('hex');
          } else if (input.script) {
            try {
              const decompiled = bitcoin.script.decompile(input.script);
              if (decompiled && decompiled.length === 2 && Buffer.isBuffer(decompiled[1])) {
                const candidate = decompiled[1];
                if (candidate && ecc.isPoint(candidate)) senderPubKeyHex = candidate.toString('hex');
              }
            } catch (err) {
              console.warn('Could not decompile legacy input script to find pubkey', err);
            }
          }
        }

        const ownPubKey = this.keyPair?.publicKey
          ? Buffer.from(this.keyPair.publicKey).toString('hex')
          : '';

        if (senderPubKeyHex === ownPubKey) {
          const { recipientAddress, recipientAmount } = this.getRecipientOutputInfo(tx);
          const contact = recipientAddress ? contactsByAddress.get(recipientAddress) : null;
          if (!contact) {
            // Contact not known yet: skip until it is added, then rescan.
            continue;
          }

          const plaintext = this.decryptMessage(encodedMessage, contact.id);
          const outgoing = {
            id: entry.txid,
            sender: 'me',
            text: plaintext,
            timestamp: entry.timereceived ? entry.timereceived * 1000 : Date.now(),
            status,
            txid: entry.txid,
            amount: recipientAmount > 0.00001 ? recipientAmount : undefined
          };

          this.processedTxIds.add(entry.txid);
          if (!this.messages[contact.id]) this.messages[contact.id] = [];
          if (!this.messages[contact.id].find((msg) => msg.id === outgoing.id)) {
            this.messages[contact.id].push(outgoing);
            this.messageCallback(contact.id, outgoing, true, false);
            this.persistAllMessages();
          }
          continue;
        }

        const contactId = senderPubKeyHex || 'Anonymous';
        const plaintext = senderPubKeyHex
          ? this.decryptMessage(encodedMessage, senderPubKeyHex)
          : encodedMessage;

        const incoming = {
          id: entry.txid,
          sender: 'them',
          text: plaintext,
          timestamp: entry.timereceived ? entry.timereceived * 1000 : Date.now(),
          status,
          txid: entry.txid,
          amount: receivedAmount > 0.00001 ? receivedAmount : undefined
        };

        this.processedTxIds.add(entry.txid);
        if (!this.messages[contactId]) this.messages[contactId] = [];
        if (!this.messages[contactId].find((msg) => msg.id === incoming.id)) {
          this.messages[contactId].push(incoming);
          this.messageCallback(contactId, incoming, false, true);
          this.persistAllMessages();
        }
      }

      // Salva processedTxIds alla fine del ciclo di scan
      this.persistProcessedTxIds();
    } catch (err) {
      console.warn('Poll error', err);
    }
  }

  async scanContactHistory(contactPubKeyHex) {
    if (!this.isElectrum()) return;

    // Deriva l'indirizzo del contatto dalla sua pubkey
    let contactAddress = null;
    try {
      const contactPayment = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(contactPubKeyHex, 'hex'),
        network: PALLADIUM_NETWORK
      });
      contactAddress = contactPayment.address;
    } catch (err) {
      console.warn('Cannot derive contact address:', err);
      return;
    }

    if (!contactAddress) return;

    // Calcola lo scripthash dell'indirizzo del contatto
    const script = bitcoin.address.toOutputScript(contactAddress, PALLADIUM_NETWORK);
    const hash = bitcoin.crypto.sha256(script);
    const contactScripthash = Buffer.from(hash).reverse().toString('hex');

    // Recupera la cronologia del contatto
    const history = await this.rpc('blockchain.scripthash.get_history', [contactScripthash]);
    const tip = await this.rpc('blockchain.headers.subscribe', []);
    const tipHeight = tip?.height || 0;

    const ownPubKey = this.keyPair ? Buffer.from(this.keyPair.publicKey).toString('hex') : '';

    // Processa ogni transazione del contatto
    for (const item of history || []) {
      const txid = item.tx_hash;

      if (this.processedTxIds.has(txid)) continue;

      const confirmations = item.height > 0 ? Math.max(0, tipHeight - item.height + 1) : 0;
      const status = confirmations === 0 ? 1 : 2;

      const rawTx = await this.getRawTransaction(txid);
      const tx = bitcoin.Transaction.fromHex(rawTx);

      // Estrai messaggio OP_RETURN
      let encodedMessage = '';
      tx.outs.forEach((output) => {
        if (output.script[0] === bitcoin.opcodes.OP_RETURN) {
          const decompiled = bitcoin.script.decompile(output.script);
          if (decompiled && decompiled.length > 1 && Buffer.isBuffer(decompiled[1])) {
            const payload = decompiled[1];
            if (payload.length > 4 && payload.slice(0, 4).equals(MESSAGE_PREFIX)) {
              encodedMessage = payload.slice(4).toString('utf8');
            } else {
              encodedMessage = payload.toString('utf8');
            }
          }
        }
      });

      if (!encodedMessage) {
        this.processedTxIds.add(txid);
        continue;
      }

      // Determina il sender dalla transazione
      let senderPubKeyHex = '';
      if (tx.ins.length > 0) {
        const input = tx.ins[0];
        if (input.witness && input.witness.length >= 2) {
          senderPubKeyHex = input.witness[1].toString('hex');
        } else if (input.script && input.script.length > 0) {
          try {
            const decompiled = bitcoin.script.decompile(input.script);
            if (decompiled && decompiled.length > 0) {
              const lastChunk = decompiled[decompiled.length - 1];
              if (Buffer.isBuffer(lastChunk) && (lastChunk.length === 33 || lastChunk.length === 65)) {
                senderPubKeyHex = lastChunk.toString('hex');
              }
            }
          } catch {
            // Ignore
          }
        }
      }

      senderPubKeyHex = senderPubKeyHex ? senderPubKeyHex : '';

      if (senderPubKeyHex === ownPubKey) {
        const { recipientAmount } = this.getRecipientOutputInfo(tx);
        const plaintext = this.decryptMessage(encodedMessage, contactPubKeyHex);
        const outgoing = {
          id: txid,
          sender: 'me',
          text: plaintext,
          timestamp: Date.now(),
          status,
          txid,
          amount: recipientAmount > 0.00001 ? recipientAmount : undefined
        };

        this.processedTxIds.add(txid);
        if (!this.messages[contactPubKeyHex]) this.messages[contactPubKeyHex] = [];
        if (!this.messages[contactPubKeyHex].find((msg) => msg.id === outgoing.id)) {
          this.messages[contactPubKeyHex].push(outgoing);
          if (this.messageCallback) {
            this.messageCallback(contactPubKeyHex, outgoing, true, false);
          }
        }
        continue;
      }

      // Verifica se c'e un output verso di noi
      let outputToUs = false;
      let receivedAmount = 0;
      for (const output of tx.outs) {
        try {
          const addr = bitcoin.address.fromOutputScript(output.script, PALLADIUM_NETWORK);
          if (addr === this.address) {
            outputToUs = true;
            receivedAmount += output.value / 1e8;
          }
        } catch {
          // Ignore non-standard outputs
        }
      }

      if (!outputToUs) {
        this.processedTxIds.add(txid);
        continue;
      }

      // Decodifica il messaggio
      const plaintext = senderPubKeyHex
        ? this.decryptMessage(encodedMessage, senderPubKeyHex)
        : encodedMessage;

      const incoming = {
        id: txid,
        sender: 'them',
        text: plaintext,
        timestamp: Date.now(),
        status,
        txid,
        amount: receivedAmount > 0.00001 ? receivedAmount : undefined
      };

      this.processedTxIds.add(txid);
      if (!this.messages[contactPubKeyHex]) this.messages[contactPubKeyHex] = [];
      if (!this.messages[contactPubKeyHex].find((msg) => msg.id === incoming.id)) {
        this.messages[contactPubKeyHex].push(incoming);
        if (this.messageCallback) {
          this.messageCallback(contactPubKeyHex, incoming, false, true);
        }
      }
    }

    this.persistAllMessages();
    this.persistProcessedTxIds();
  }

  async scanChainElectrum() {
    const scripthash = this.getScripthash();
    if (!scripthash) return;

    // Fast check: has the status of this scripthash changed?
    const status = await this.rpc('blockchain.scripthash.subscribe', [scripthash]);
    if (status === this.scripthashStatus && this.scripthashStatus !== null) {
      // Still, check mempool for new outgoing messages that might not have triggered a status change yet
      // Or just continue if we want to be sure
    }
    this.scripthashStatus = status;

    const contacts = await this.getContacts();
    const contactsByAddress = new Map(contacts.map((contact) => [contact.address, contact]));

    const history = await this.rpc('blockchain.scripthash.get_history', [scripthash]);
    const tip = await this.rpc('blockchain.headers.subscribe', []);
    const tipHeight = tip?.height || 0;

    // Process all history including unconfirmed (height <= 0)
    for (const item of history || []) {
      const txid = item.tx_hash;
      const confirmations = item.height > 0 ? Math.max(0, tipHeight - item.height + 1) : 0;
      const status = confirmations === 0 ? 1 : 2;

      // Update status for any known messages with this txid.
      let statusUpdated = false;
      Object.keys(this.messages).forEach((contactId) => {
        const idx = this.messages[contactId].findIndex((msg) => msg.txid === txid || msg.id === txid);
        if (idx !== -1) {
          const existing = this.messages[contactId][idx];
          if (existing.status !== status) {
            const updated = { ...existing, status };
            this.messages[contactId][idx] = updated;
            this.messageCallback(contactId, updated, true, false);
            statusUpdated = true;
          }
        }
      });
      if (statusUpdated) this.persistSentMessages();

      if (this.processedTxIds.has(txid)) continue;

      const rawTx = await this.getRawTransaction(txid);
      const tx = bitcoin.Transaction.fromHex(rawTx);

      let encodedMessage = '';
      tx.outs.forEach((output) => {
        if (output.script[0] === bitcoin.opcodes.OP_RETURN) {
          const decompiled = bitcoin.script.decompile(output.script);
          if (decompiled && decompiled.length > 1 && Buffer.isBuffer(decompiled[1])) {
            const payload = decompiled[1];
            if (payload.length > 4 && payload.slice(0, 4).equals(MESSAGE_PREFIX)) {
              encodedMessage = payload.slice(4).toString('utf8');
            } else {
              encodedMessage = payload.toString('utf8');
            }
          }
        }
      });

      if (!encodedMessage) {
        this.processedTxIds.add(txid);
        continue;
      }

      let senderPubKeyHex = '';
      if (tx.ins.length > 0) {
        const input = tx.ins[0];
        if (input.witness && input.witness.length === 2) {
          const candidate = input.witness[1];
          if (candidate && ecc.isPoint(candidate)) senderPubKeyHex = candidate.toString('hex');
        } else if (input.script) {
          try {
            const decompiled = bitcoin.script.decompile(input.script);
            if (decompiled && decompiled.length === 2 && Buffer.isBuffer(decompiled[1])) {
              const candidate = decompiled[1];
              if (candidate && ecc.isPoint(candidate)) senderPubKeyHex = candidate.toString('hex');
            }
          } catch (err) {
            console.warn('Could not decompile legacy input script to find pubkey', err);
          }
        }
      }

      const ownPubKey = this.keyPair?.publicKey
        ? Buffer.from(this.keyPair.publicKey).toString('hex')
        : '';

      if (senderPubKeyHex === ownPubKey) {
        const { recipientAddress, recipientAmount } = this.getRecipientOutputInfo(tx);
        const contact = recipientAddress ? contactsByAddress.get(recipientAddress) : null;
        if (!contact) {
          // Contact not known yet: skip until it is added, then rescan.
          continue;
        }

        const plaintext = this.decryptMessage(encodedMessage, contact.id);
        const outgoing = {
          id: txid,
          sender: 'me',
          text: plaintext,
          timestamp: Date.now(),
          status,
          txid,
          amount: recipientAmount > 0.00001 ? recipientAmount : undefined
        };

        this.processedTxIds.add(txid);
        if (!this.messages[contact.id]) this.messages[contact.id] = [];
        if (!this.messages[contact.id].find((msg) => msg.id === outgoing.id)) {
          this.messages[contact.id].push(outgoing);
          this.messageCallback(contact.id, outgoing, true, false);
          this.persistAllMessages();
        }
        continue;
      }

      let outputToUs = false;
      let receivedAmount = 0;
      for (const output of tx.outs) {
        try {
          const addr = bitcoin.address.fromOutputScript(output.script, PALLADIUM_NETWORK);
          if (addr === this.address) {
            outputToUs = true;
            receivedAmount += output.value / 1e8;
          }
        } catch {
          // Ignore non-standard outputs.
        }
      }

      if (!outputToUs) {
        this.processedTxIds.add(txid);
        continue;
      }

      const contactId = senderPubKeyHex || 'Anonymous';
      const plaintext = senderPubKeyHex
        ? this.decryptMessage(encodedMessage, senderPubKeyHex)
        : encodedMessage;

      const incoming = {
        id: txid,
        sender: 'them',
        text: plaintext,
        timestamp: Date.now(),
        status,
        txid,
        amount: receivedAmount > 0.00001 ? receivedAmount : undefined
      };

      this.processedTxIds.add(txid);
      if (!this.messages[contactId]) this.messages[contactId] = [];
      if (!this.messages[contactId].find((msg) => msg.id === incoming.id)) {
        this.messages[contactId].push(incoming);
        this.messageCallback(contactId, incoming, false, true);
        this.persistAllMessages();
      }
    }

    // Salva processedTxIds alla fine del ciclo di scan
    this.persistProcessedTxIds();
  }


}

export const wallet = new Wallet();
