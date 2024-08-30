// src/app/index.ts
import {
  deserializeTx as deserializeTx2,
  toAddress,
  toTxUnspentOutput
} from "@meshsdk/core-cst";

// ../../node_modules/@scure/base/lib/esm/index.js
// @__NO_SIDE_EFFECTS__
function assertNumber(n) {
  if (!Number.isSafeInteger(n))
    throw new Error(`Wrong integer: ${n}`);
}
function isBytes(a) {
  return a instanceof Uint8Array || a != null && typeof a === "object" && a.constructor.name === "Uint8Array";
}
// @__NO_SIDE_EFFECTS__
function chain(...args) {
  const id = (a) => a;
  const wrap = (a, b) => (c) => a(b(c));
  const encode = args.map((x) => x.encode).reduceRight(wrap, id);
  const decode = args.map((x) => x.decode).reduce(wrap, id);
  return { encode, decode };
}
// @__NO_SIDE_EFFECTS__
function alphabet(alphabet2) {
  return {
    encode: (digits) => {
      if (!Array.isArray(digits) || digits.length && typeof digits[0] !== "number")
        throw new Error("alphabet.encode input should be an array of numbers");
      return digits.map((i) => {
        /* @__PURE__ */ assertNumber(i);
        if (i < 0 || i >= alphabet2.length)
          throw new Error(`Digit index outside alphabet: ${i} (alphabet: ${alphabet2.length})`);
        return alphabet2[i];
      });
    },
    decode: (input) => {
      if (!Array.isArray(input) || input.length && typeof input[0] !== "string")
        throw new Error("alphabet.decode input should be array of strings");
      return input.map((letter) => {
        if (typeof letter !== "string")
          throw new Error(`alphabet.decode: not string element=${letter}`);
        const index = alphabet2.indexOf(letter);
        if (index === -1)
          throw new Error(`Unknown letter: "${letter}". Allowed: ${alphabet2}`);
        return index;
      });
    }
  };
}
// @__NO_SIDE_EFFECTS__
function join(separator = "") {
  if (typeof separator !== "string")
    throw new Error("join separator should be string");
  return {
    encode: (from) => {
      if (!Array.isArray(from) || from.length && typeof from[0] !== "string")
        throw new Error("join.encode input should be array of strings");
      for (let i of from)
        if (typeof i !== "string")
          throw new Error(`join.encode: non-string input=${i}`);
      return from.join(separator);
    },
    decode: (to) => {
      if (typeof to !== "string")
        throw new Error("join.decode input should be string");
      return to.split(separator);
    }
  };
}
var gcd = /* @__NO_SIDE_EFFECTS__ */ (a, b) => !b ? a : /* @__PURE__ */ gcd(b, a % b);
var radix2carry = /* @__NO_SIDE_EFFECTS__ */ (from, to) => from + (to - /* @__PURE__ */ gcd(from, to));
// @__NO_SIDE_EFFECTS__
function convertRadix2(data, from, to, padding) {
  if (!Array.isArray(data))
    throw new Error("convertRadix2: data should be array");
  if (from <= 0 || from > 32)
    throw new Error(`convertRadix2: wrong from=${from}`);
  if (to <= 0 || to > 32)
    throw new Error(`convertRadix2: wrong to=${to}`);
  if (/* @__PURE__ */ radix2carry(from, to) > 32) {
    throw new Error(`convertRadix2: carry overflow from=${from} to=${to} carryBits=${/* @__PURE__ */ radix2carry(from, to)}`);
  }
  let carry = 0;
  let pos = 0;
  const mask = 2 ** to - 1;
  const res = [];
  for (const n of data) {
    /* @__PURE__ */ assertNumber(n);
    if (n >= 2 ** from)
      throw new Error(`convertRadix2: invalid data word=${n} from=${from}`);
    carry = carry << from | n;
    if (pos + from > 32)
      throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from}`);
    pos += from;
    for (; pos >= to; pos -= to)
      res.push((carry >> pos - to & mask) >>> 0);
    carry &= 2 ** pos - 1;
  }
  carry = carry << to - pos & mask;
  if (!padding && pos >= from)
    throw new Error("Excess padding");
  if (!padding && carry)
    throw new Error(`Non-zero padding: ${carry}`);
  if (padding && pos > 0)
    res.push(carry >>> 0);
  return res;
}
// @__NO_SIDE_EFFECTS__
function radix2(bits, revPadding = false) {
  /* @__PURE__ */ assertNumber(bits);
  if (bits <= 0 || bits > 32)
    throw new Error("radix2: bits should be in (0..32]");
  if (/* @__PURE__ */ radix2carry(8, bits) > 32 || /* @__PURE__ */ radix2carry(bits, 8) > 32)
    throw new Error("radix2: carry overflow");
  return {
    encode: (bytes) => {
      if (!isBytes(bytes))
        throw new Error("radix2.encode input should be Uint8Array");
      return /* @__PURE__ */ convertRadix2(Array.from(bytes), 8, bits, !revPadding);
    },
    decode: (digits) => {
      if (!Array.isArray(digits) || digits.length && typeof digits[0] !== "number")
        throw new Error("radix2.decode input should be array of numbers");
      return Uint8Array.from(/* @__PURE__ */ convertRadix2(digits, bits, 8, revPadding));
    }
  };
}
// @__NO_SIDE_EFFECTS__
function unsafeWrapper(fn) {
  if (typeof fn !== "function")
    throw new Error("unsafeWrapper fn should be function");
  return function(...args) {
    try {
      return fn.apply(null, args);
    } catch (e) {
    }
  };
}
var BECH_ALPHABET = /* @__PURE__ */ chain(/* @__PURE__ */ alphabet("qpzry9x8gf2tvdw0s3jn54khce6mua7l"), /* @__PURE__ */ join(""));
var POLYMOD_GENERATORS = [996825010, 642813549, 513874426, 1027748829, 705979059];
// @__NO_SIDE_EFFECTS__
function bech32Polymod(pre) {
  const b = pre >> 25;
  let chk = (pre & 33554431) << 5;
  for (let i = 0; i < POLYMOD_GENERATORS.length; i++) {
    if ((b >> i & 1) === 1)
      chk ^= POLYMOD_GENERATORS[i];
  }
  return chk;
}
// @__NO_SIDE_EFFECTS__
function bechChecksum(prefix, words, encodingConst = 1) {
  const len = prefix.length;
  let chk = 1;
  for (let i = 0; i < len; i++) {
    const c = prefix.charCodeAt(i);
    if (c < 33 || c > 126)
      throw new Error(`Invalid prefix (${prefix})`);
    chk = /* @__PURE__ */ bech32Polymod(chk) ^ c >> 5;
  }
  chk = /* @__PURE__ */ bech32Polymod(chk);
  for (let i = 0; i < len; i++)
    chk = /* @__PURE__ */ bech32Polymod(chk) ^ prefix.charCodeAt(i) & 31;
  for (let v of words)
    chk = /* @__PURE__ */ bech32Polymod(chk) ^ v;
  for (let i = 0; i < 6; i++)
    chk = /* @__PURE__ */ bech32Polymod(chk);
  chk ^= encodingConst;
  return BECH_ALPHABET.encode(/* @__PURE__ */ convertRadix2([chk % 2 ** 30], 30, 5, false));
}
// @__NO_SIDE_EFFECTS__
function genBech32(encoding) {
  const ENCODING_CONST = encoding === "bech32" ? 1 : 734539939;
  const _words = /* @__PURE__ */ radix2(5);
  const fromWords = _words.decode;
  const toWords = _words.encode;
  const fromWordsUnsafe = /* @__PURE__ */ unsafeWrapper(fromWords);
  function encode(prefix, words, limit = 90) {
    if (typeof prefix !== "string")
      throw new Error(`bech32.encode prefix should be string, not ${typeof prefix}`);
    if (!Array.isArray(words) || words.length && typeof words[0] !== "number")
      throw new Error(`bech32.encode words should be array of numbers, not ${typeof words}`);
    if (prefix.length === 0)
      throw new TypeError(`Invalid prefix length ${prefix.length}`);
    const actualLength = prefix.length + 7 + words.length;
    if (limit !== false && actualLength > limit)
      throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
    const lowered = prefix.toLowerCase();
    const sum = /* @__PURE__ */ bechChecksum(lowered, words, ENCODING_CONST);
    return `${lowered}1${BECH_ALPHABET.encode(words)}${sum}`;
  }
  function decode(str, limit = 90) {
    if (typeof str !== "string")
      throw new Error(`bech32.decode input should be string, not ${typeof str}`);
    if (str.length < 8 || limit !== false && str.length > limit)
      throw new TypeError(`Wrong string length: ${str.length} (${str}). Expected (8..${limit})`);
    const lowered = str.toLowerCase();
    if (str !== lowered && str !== str.toUpperCase())
      throw new Error(`String must be lowercase or uppercase`);
    const sepIndex = lowered.lastIndexOf("1");
    if (sepIndex === 0 || sepIndex === -1)
      throw new Error(`Letter "1" must be present between prefix and data only`);
    const prefix = lowered.slice(0, sepIndex);
    const data = lowered.slice(sepIndex + 1);
    if (data.length < 6)
      throw new Error("Data must be at least 6 characters long");
    const words = BECH_ALPHABET.decode(data).slice(0, -6);
    const sum = /* @__PURE__ */ bechChecksum(prefix, words, ENCODING_CONST);
    if (!data.endsWith(sum))
      throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
    return { prefix, words };
  }
  const decodeUnsafe = /* @__PURE__ */ unsafeWrapper(decode);
  function decodeToBytes(str) {
    const { prefix, words } = decode(str, false);
    return { prefix, words, bytes: fromWords(words) };
  }
  return { encode, decode, decodeToBytes, decodeUnsafe, fromWords, fromWordsUnsafe, toWords };
}
var bech32 = /* @__PURE__ */ genBech32("bech32");

// src/embedded/index.ts
import {
  bytesToHex,
  generateMnemonic,
  mnemonicToEntropy
} from "@meshsdk/common";
import {
  Address,
  Bip32PrivateKey,
  buildBaseAddress,
  buildBip32PrivateKey,
  buildDRepID,
  buildEnterpriseAddress,
  buildKeys,
  buildRewardAddress,
  deserializeTx,
  deserializeTxHash,
  DRep,
  Ed25519KeyHashHex,
  Ed25519PublicKeyHex,
  Ed25519SignatureHex,
  Hash28ByteBase16,
  resolveTxHash,
  Serialization,
  signData,
  Transaction,
  VkeyWitness
} from "@meshsdk/core-cst";
var WalletStaticMethods = class {
  static privateKeyToEntropy(bech322) {
    const bech32DecodedBytes = bech32.decodeToBytes(bech322).bytes;
    const bip32PrivateKey = Bip32PrivateKey.fromBytes(bech32DecodedBytes);
    return bytesToHex(bip32PrivateKey.bytes());
  }
  static mnemonicToEntropy(words) {
    const entropy = mnemonicToEntropy(words.join(" "));
    const bip32PrivateKey = buildBip32PrivateKey(entropy);
    return bytesToHex(bip32PrivateKey.bytes());
  }
  static signingKeyToEntropy(paymentKey, stakeKey) {
    return [
      paymentKey.startsWith("5820") ? paymentKey.slice(4) : paymentKey,
      stakeKey.startsWith("5820") ? stakeKey.slice(4) : stakeKey
    ];
  }
  static getAddresses(paymentKey, stakingKey, networkId = 0) {
    const baseAddress = buildBaseAddress(
      networkId,
      Hash28ByteBase16.fromEd25519KeyHashHex(
        Ed25519KeyHashHex(paymentKey.toPublicKey().hash().toString("hex"))
      ),
      Hash28ByteBase16.fromEd25519KeyHashHex(
        Ed25519KeyHashHex(stakingKey.toPublicKey().hash().toString("hex"))
      )
    ).toAddress();
    const enterpriseAddress = buildEnterpriseAddress(
      networkId,
      Hash28ByteBase16.fromEd25519KeyHashHex(
        Ed25519KeyHashHex(paymentKey.toPublicKey().hash().toString("hex"))
      )
    ).toAddress();
    const rewardAddress = buildRewardAddress(
      networkId,
      Hash28ByteBase16.fromEd25519KeyHashHex(
        Ed25519KeyHashHex(stakingKey.toPublicKey().hash().toString("hex"))
      )
    ).toAddress();
    return {
      baseAddress,
      enterpriseAddress,
      rewardAddress
    };
  }
  static getDRepKey(dRepKey, networkId = 0) {
    const pubKey = dRepKey.toPublicKey().pubKey;
    const pubDRepKey = pubKey.toString("hex");
    const dRepIDBech32 = buildDRepID(
      Ed25519PublicKeyHex(pubDRepKey),
      networkId
    );
    const dRep = DRep.newKeyHash(
      Ed25519KeyHashHex(dRepKey.toPublicKey().hash().toString("hex"))
    );
    const dRepIDHash = dRep.toKeyHash();
    return {
      pubDRepKey,
      dRepIDBech32,
      dRepIDHash
    };
  }
  static generateMnemonic(strength = 256) {
    const mnemonic = generateMnemonic(strength);
    return mnemonic.split(" ");
  }
  static addWitnessSets(txHex, witnesses) {
    let tx = deserializeTx(txHex);
    let witnessSet = tx.witnessSet();
    let witnessSetVkeys = witnessSet.vkeys();
    let witnessSetVkeysValues = witnessSetVkeys ? [...witnessSetVkeys.values(), ...witnesses] : witnesses;
    witnessSet.setVkeys(
      Serialization.CborSet.fromCore(
        witnessSetVkeysValues.map((vkw) => vkw.toCore()),
        VkeyWitness.fromCore
      )
    );
    return new Transaction(tx.body(), witnessSet, tx.auxiliaryData()).toCbor();
  }
};
var EmbeddedWallet = class extends WalletStaticMethods {
  _entropy;
  _networkId;
  constructor(options) {
    super();
    this._networkId = options.networkId;
    switch (options.key.type) {
      case "mnemonic":
        this._entropy = WalletStaticMethods.mnemonicToEntropy(
          options.key.words
        );
        break;
      case "root":
        this._entropy = WalletStaticMethods.privateKeyToEntropy(
          options.key.bech32
        );
        break;
      case "cli":
        this._entropy = WalletStaticMethods.signingKeyToEntropy(
          options.key.payment,
          options.key.stake ?? "f0".repeat(32)
        );
        break;
    }
  }
  getAccount(accountIndex = 0, keyIndex = 0) {
    if (this._entropy == void 0)
      throw new Error("[EmbeddedWallet] No keys initialized");
    const { paymentKey, stakeKey, dRepKey } = buildKeys(
      this._entropy,
      accountIndex,
      keyIndex
    );
    const { baseAddress, enterpriseAddress, rewardAddress } = WalletStaticMethods.getAddresses(paymentKey, stakeKey, this._networkId);
    let _account = {
      baseAddress,
      enterpriseAddress,
      rewardAddress,
      baseAddressBech32: baseAddress.toBech32(),
      enterpriseAddressBech32: enterpriseAddress.toBech32(),
      rewardAddressBech32: rewardAddress.toBech32(),
      paymentKey,
      stakeKey,
      paymentKeyHex: paymentKey.toBytes().toString("hex"),
      stakeKeyHex: stakeKey.toBytes().toString("hex")
    };
    if (dRepKey) {
      const { pubDRepKey, dRepIDBech32, dRepIDHash } = WalletStaticMethods.getDRepKey(dRepKey, this._networkId);
      _account.pubDRepKey = pubDRepKey;
      _account.dRepIDBech32 = dRepIDBech32;
      _account.dRepIDHash = dRepIDHash;
    }
    return _account;
  }
  getNetworkId() {
    return this._networkId;
  }
  signData(address, payload, accountIndex = 0, keyIndex = 0) {
    try {
      const { baseAddress, enterpriseAddress, rewardAddress, paymentKey } = this.getAccount(accountIndex, keyIndex);
      const foundAddress = [baseAddress, enterpriseAddress, rewardAddress].find(
        (a) => a.toBech32() === address
      );
      if (foundAddress === void 0)
        throw new Error(
          `[EmbeddedWallet] Address: ${address} doesn't belong to this account.`
        );
      return signData(payload, {
        address: Address.fromBech32(address),
        key: paymentKey
      });
    } catch (error) {
      throw new Error(
        `[EmbeddedWallet] An error occurred during signData: ${error}.`
      );
    }
  }
  signTx(unsignedTx, accountIndex = 0, keyIndex = 0) {
    try {
      const txHash = deserializeTxHash(resolveTxHash(unsignedTx));
      const { paymentKey } = this.getAccount(accountIndex, keyIndex);
      const vKeyWitness = new VkeyWitness(
        Ed25519PublicKeyHex(paymentKey.toPublicKey().toBytes().toString("hex")),
        Ed25519SignatureHex(
          paymentKey.sign(Buffer.from(txHash, "hex")).toString("hex")
        )
      );
      return vKeyWitness;
    } catch (error) {
      throw new Error(
        `[EmbeddedWallet] An error occurred during signTx: ${error}.`
      );
    }
  }
};

// src/app/index.ts
var AppWallet = class {
  _fetcher;
  _submitter;
  _wallet;
  constructor(options) {
    this._fetcher = options.fetcher;
    this._submitter = options.submitter;
    switch (options.key.type) {
      case "mnemonic":
        this._wallet = new EmbeddedWallet({
          networkId: options.networkId,
          key: {
            type: "mnemonic",
            words: options.key.words
          }
        });
        break;
      case "root":
        this._wallet = new EmbeddedWallet({
          networkId: options.networkId,
          key: {
            type: "root",
            bech32: options.key.bech32
          }
        });
        break;
      case "cli":
        this._wallet = new EmbeddedWallet({
          networkId: options.networkId,
          key: {
            type: "cli",
            payment: options.key.payment,
            stake: options.key.stake
          }
        });
    }
  }
  /**
   * Get a list of UTXOs to be used as collateral inputs for transactions with plutus script inputs.
   *
   * This is used in transaction building.
   *
   * @returns a list of UTXOs
   */
  async getCollateralUnspentOutput(accountIndex = 0, addressType = "payment") {
    const utxos = await this.getUnspentOutputs(accountIndex, addressType);
    const pureAdaUtxos = utxos.filter((utxo) => {
      return utxo.output().amount().multiasset() === void 0;
    });
    pureAdaUtxos.sort((a, b) => {
      return Number(a.output().amount().coin()) - Number(b.output().amount().coin());
    });
    for (const utxo of pureAdaUtxos) {
      if (Number(utxo.output().amount().coin()) >= 5e6) {
        return [utxo];
      }
    }
    return [];
  }
  getEnterpriseAddress(accountIndex = 0, keyIndex = 0) {
    const account = this._wallet.getAccount(accountIndex, keyIndex);
    return account.enterpriseAddressBech32;
  }
  getPaymentAddress(accountIndex = 0, keyIndex = 0) {
    const account = this._wallet.getAccount(accountIndex, keyIndex);
    return account.baseAddressBech32;
  }
  getRewardAddress(accountIndex = 0, keyIndex = 0) {
    const account = this._wallet.getAccount(accountIndex, keyIndex);
    return account.rewardAddressBech32;
  }
  getNetworkId() {
    return this._wallet.getNetworkId();
  }
  getUsedAddress(accountIndex = 0, keyIndex = 0, addressType = "payment") {
    if (addressType === "enterprise") {
      return toAddress(this.getEnterpriseAddress(accountIndex, keyIndex));
    } else {
      return toAddress(this.getPaymentAddress(accountIndex, keyIndex));
    }
  }
  async getUnspentOutputs(accountIndex = 0, addressType = "payment") {
    if (!this._fetcher) {
      throw new Error(
        "[AppWallet] Fetcher is required to fetch UTxOs. Please provide a fetcher."
      );
    }
    const account = this._wallet.getAccount(accountIndex);
    const utxos = await this._fetcher.fetchAddressUTxOs(
      addressType == "enterprise" ? account.enterpriseAddressBech32 : account.baseAddressBech32
    );
    return utxos.map((utxo) => toTxUnspentOutput(utxo));
  }
  signData(address, payload, accountIndex = 0, keyIndex = 0) {
    try {
      return this._wallet.signData(address, payload, accountIndex, keyIndex);
    } catch (error) {
      throw new Error(
        `[AppWallet] An error occurred during signData: ${error}.`
      );
    }
  }
  signTx(unsignedTx, partialSign = false, accountIndex = 0, keyIndex = 0) {
    try {
      const tx = deserializeTx2(unsignedTx);
      if (!partialSign && tx.witnessSet().vkeys() !== void 0 && tx.witnessSet().vkeys().size() !== 0)
        throw new Error(
          "Signatures already exist in the transaction in a non partial sign call"
        );
      const newSignatures = this._wallet.signTx(
        unsignedTx,
        accountIndex,
        keyIndex
      );
      let signedTx = EmbeddedWallet.addWitnessSets(unsignedTx, [newSignatures]);
      return signedTx;
    } catch (error) {
      throw new Error(`[AppWallet] An error occurred during signTx: ${error}.`);
    }
  }
  signTxSync(unsignedTx, partialSign = false, accountIndex = 0, keyIndex = 0) {
    try {
      throw new Error(`[AppWallet] signTxSync() is not implemented.`);
    } catch (error) {
      throw new Error(`[AppWallet] An error occurred during signTx: ${error}.`);
    }
  }
  async signTxs(unsignedTxs, partialSign) {
    throw new Error(`[AppWallet] signTxs() is not implemented.`);
  }
  submitTx(tx) {
    if (!this._submitter) {
      throw new Error(
        "[AppWallet] Submitter is required to submit transactions. Please provide a submitter."
      );
    }
    return this._submitter.submitTx(tx);
  }
  static brew(strength = 256) {
    return EmbeddedWallet.generateMnemonic(strength);
  }
};

// src/browser/index.ts
import {
  DEFAULT_PROTOCOL_PARAMETERS,
  fromUTF8,
  POLICY_ID_LENGTH,
  resolveFingerprint
} from "@meshsdk/common";
import {
  addressToBech32,
  buildDRepID as buildDRepID2,
  CardanoSDKUtil,
  deserializeAddress,
  deserializeTx as deserializeTx3,
  deserializeTxUnspentOutput,
  deserializeValue,
  Ed25519PublicKey,
  Ed25519PublicKeyHex as Ed25519PublicKeyHex2,
  fromTxUnspentOutput,
  fromValue,
  Serialization as Serialization2,
  toAddress as toAddress2,
  Transaction as Transaction2,
  VkeyWitness as VkeyWitness2
} from "@meshsdk/core-cst";

// src/browser/metamask.ts
import { initNufiDappCardanoSdk } from "@nufi/dapp-client-cardano";
import nufiCoreSdk from "@nufi/dapp-client-core";

// src/types/nufisnap.ts
var nufiSnap = {
  id: "nufiSnap",
  name: "MetaMask",
  icon: "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iTGF5ZXJfMiIgZGF0YS1uYW1lPSJMYXllciAyIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjkuMiAxNjMuNzEiPgogIDxkZWZzPgogICAgPHN0eWxlPgogICAgICAuY2xzLTEgewogICAgICAgIGZpbGw6ICNlMjc2MjU7CiAgICAgIH0KCiAgICAgIC5jbHMtMSwgLmNscy0yLCAuY2xzLTMsIC5jbHMtNCwgLmNscy01LCAuY2xzLTYsIC5jbHMtNywgLmNscy04LCAuY2xzLTkgewogICAgICAgIHN0cm9rZS13aWR0aDogMHB4OwogICAgICB9CgogICAgICAuY2xzLTIgewogICAgICAgIGZpbGw6ICM3NjNlMWE7CiAgICAgIH0KCiAgICAgIC5jbHMtMyB7CiAgICAgICAgZmlsbDogI2MwYWQ5ZTsKICAgICAgfQoKICAgICAgLmNscy00IHsKICAgICAgICBmaWxsOiAjMzQ2OGQxOwogICAgICB9CgogICAgICAuY2xzLTUgewogICAgICAgIGZpbGw6ICNjYzYyMjg7CiAgICAgIH0KCiAgICAgIC5jbHMtNiB7CiAgICAgICAgZmlsbDogI2Y1ODQxZjsKICAgICAgfQoKICAgICAgLmNscy03IHsKICAgICAgICBmaWxsOiAjZDdjMWIzOwogICAgICB9CgogICAgICAuY2xzLTggewogICAgICAgIGZpbGw6ICNmZmY7CiAgICAgICAgZmlsbC1ydWxlOiBldmVub2RkOwogICAgICB9CgogICAgICAuY2xzLTkgewogICAgICAgIGZpbGw6ICMyZjM0M2I7CiAgICAgIH0KICAgIDwvc3R5bGU+CiAgPC9kZWZzPgogIDxnIGlkPSJMYXllcl8xLTIiIGRhdGEtbmFtZT0iTGF5ZXIgMSI+CiAgICA8ZyBpZD0iTU1fSGVhZF9iYWNrZ3JvdW5kX0RvX25vdF9lZGl0XyIgZGF0YS1uYW1lPSJNTSBIZWFkIGJhY2tncm91bmQgKERvIG5vdCBlZGl0KSI+CiAgICAgIDxwYXRoIGNsYXNzPSJjbHMtNiIgZD0iTTE0MS44LDcwLjVsNi45LTguMS0zLTIuMiw0LjgtNC40LTMuNy0yLjgsNC44LTMuNi0zLjEtMi40LDUtMjQuNC03LjYtMjIuNk0xNDUuOSwwbC00OC44LDE4LjFoLTQwLjdMNy42LDBsLjMuMkw3LjYsMCwwLDIyLjZsNS4xLDI0LjQtMy4yLDIuNCw0LjksMy42LTMuNywyLjgsNC44LDQuNC0zLDIuMiw2LjksOC4xTDEuMywxMDIuOWgwbDkuNywzMy4xLDM0LjEtOS40di0uMS4xaDBsNi42LDUuNCwxMy41LDkuMmgyMy4xbDEzLjUtOS4yLDYuNi01LjRoMGwzNC4yLDkuNCw5LjgtMzMuMWgwbC0xMC42LTMyLjQiLz4KICAgIDwvZz4KICAgIDxnIGlkPSJMb2dvcyI+CiAgICAgIDxnPgogICAgICAgIDxwb2x5Z29uIGNsYXNzPSJjbHMtMSIgcG9pbnRzPSIxNDUuOSAwIDg2IDQ0LjEgOTcuMSAxOC4xIDE0NS45IDAiLz4KICAgICAgICA8cG9seWdvbiBjbGFzcz0iY2xzLTEiIHBvaW50cz0iNy42IDAgNjcgNDQuNSA1Ni40IDE4LjEgNy42IDAiLz4KICAgICAgICA8cG9seWdvbiBjbGFzcz0iY2xzLTEiIHBvaW50cz0iMTI0LjQgMTAyLjMgMTA4LjQgMTI2LjUgMTQyLjYgMTM1LjkgMTUyLjQgMTAyLjggMTI0LjQgMTAyLjMiLz4KICAgICAgICA8cG9seWdvbiBjbGFzcz0iY2xzLTEiIHBvaW50cz0iMS4zIDEwMi44IDExIDEzNS45IDQ1LjEgMTI2LjUgMjkuMiAxMDIuMyAxLjMgMTAyLjgiLz4KICAgICAgICA8cG9seWdvbiBjbGFzcz0iY2xzLTEiIHBvaW50cz0iNDMuMyA2MS4zIDMzLjggNzUuNiA2Ny42IDc3LjEgNjYuNSA0MC45IDQzLjMgNjEuMyIvPgogICAgICAgIDxwb2x5Z29uIGNsYXNzPSJjbHMtMSIgcG9pbnRzPSIxMTAuMyA2MS4zIDg2LjcgNDAuNSA4NiA3Ny4xIDExOS44IDc1LjYgMTEwLjMgNjEuMyIvPgogICAgICAgIDxwb2x5Z29uIGNsYXNzPSJjbHMtMSIgcG9pbnRzPSI0NS4xIDEyNi41IDY1LjYgMTE2LjcgNDcuOSAxMDMuMSA0NS4xIDEyNi41Ii8+CiAgICAgICAgPHBvbHlnb24gY2xhc3M9ImNscy0xIiBwb2ludHM9Ijg4IDExNi43IDEwOC40IDEyNi41IDEwNS42IDEwMy4xIDg4IDExNi43Ii8+CiAgICAgICAgPHBvbHlnb24gY2xhc3M9ImNscy03IiBwb2ludHM9IjEwOC40IDEyNi41IDg4IDExNi43IDg5LjcgMTI5LjkgODkuNSAxMzUuNSAxMDguNCAxMjYuNSIvPgogICAgICAgIDxwb2x5Z29uIGNsYXNzPSJjbHMtNyIgcG9pbnRzPSI0NS4xIDEyNi41IDY0LjEgMTM1LjUgNjQgMTI5LjkgNjUuNiAxMTYuNyA0NS4xIDEyNi41Ii8+CiAgICAgICAgPHBvbHlnb24gY2xhc3M9ImNscy05IiBwb2ludHM9IjY0LjQgOTQuMyA0Ny41IDg5LjQgNTkuNSA4My45IDY0LjQgOTQuMyIvPgogICAgICAgIDxwb2x5Z29uIGNsYXNzPSJjbHMtOSIgcG9pbnRzPSI4OS4xIDk0LjMgOTQuMSA4My45IDEwNi4xIDg5LjQgODkuMSA5NC4zIi8+CiAgICAgICAgPHBvbHlnb24gY2xhc3M9ImNscy01IiBwb2ludHM9IjQ1LjEgMTI2LjUgNDguMSAxMDIuMyAyOS4yIDEwMi44IDQ1LjEgMTI2LjUiLz4KICAgICAgICA8cG9seWdvbiBjbGFzcz0iY2xzLTUiIHBvaW50cz0iMTA1LjUgMTAyLjMgMTA4LjQgMTI2LjUgMTI0LjQgMTAyLjggMTA1LjUgMTAyLjMiLz4KICAgICAgICA8cG9seWdvbiBjbGFzcz0iY2xzLTUiIHBvaW50cz0iMTE5LjggNzUuNiA4NiA3Ny4xIDg5LjEgOTQuMyA5NC4xIDgzLjkgMTA2LjEgODkuNCAxMTkuOCA3NS42Ii8+CiAgICAgICAgPHBvbHlnb24gY2xhc3M9ImNscy01IiBwb2ludHM9IjQ3LjUgODkuNCA1OS41IDgzLjkgNjQuNCA5NC4zIDY3LjYgNzcuMSAzMy44IDc1LjYgNDcuNSA4OS40Ii8+CiAgICAgICAgPHBvbHlnb24gY2xhc3M9ImNscy0xIiBwb2ludHM9IjMzLjggNzUuNiA0Ny45IDEwMy4xIDQ3LjUgODkuNCAzMy44IDc1LjYiLz4KICAgICAgICA8cG9seWdvbiBjbGFzcz0iY2xzLTEiIHBvaW50cz0iMTA2LjEgODkuNCAxMDUuNiAxMDMuMSAxMTkuOCA3NS42IDEwNi4xIDg5LjQiLz4KICAgICAgICA8cG9seWdvbiBjbGFzcz0iY2xzLTEiIHBvaW50cz0iNjcuNiA3Ny4xIDY0LjQgOTQuMyA2OC40IDExNC43IDY5LjMgODcuOSA2Ny42IDc3LjEiLz4KICAgICAgICA8cG9seWdvbiBjbGFzcz0iY2xzLTEiIHBvaW50cz0iODYgNzcuMSA4NC4zIDg3LjggODUuMSAxMTQuNyA4OS4xIDk0LjMgODYgNzcuMSIvPgogICAgICAgIDxwb2x5Z29uIGNsYXNzPSJjbHMtNiIgcG9pbnRzPSI4OS4xIDk0LjMgODUuMSAxMTQuNyA4OCAxMTYuNyAxMDUuNiAxMDMuMSAxMDYuMSA4OS40IDg5LjEgOTQuMyIvPgogICAgICAgIDxwb2x5Z29uIGNsYXNzPSJjbHMtNiIgcG9pbnRzPSI0Ny41IDg5LjQgNDcuOSAxMDMuMSA2NS42IDExNi43IDY4LjQgMTE0LjcgNjQuNCA5NC4zIDQ3LjUgODkuNCIvPgogICAgICAgIDxwb2x5Z29uIGNsYXNzPSJjbHMtMyIgcG9pbnRzPSI4OS41IDEzNS41IDg5LjcgMTI5LjkgODguMSAxMjguNiA2NS40IDEyOC42IDY0IDEyOS45IDY0LjEgMTM1LjUgNDUuMSAxMjYuNSA1MS43IDEzMS45IDY1LjIgMTQxLjIgODguMyAxNDEuMiAxMDEuOCAxMzEuOSAxMDguNCAxMjYuNSA4OS41IDEzNS41Ii8+CiAgICAgICAgPHBvbHlnb24gY2xhc3M9ImNscy05IiBwb2ludHM9Ijg4IDExNi43IDg1LjEgMTE0LjcgNjguNCAxMTQuNyA2NS42IDExNi43IDY0IDEyOS45IDY1LjQgMTI4LjYgODguMSAxMjguNiA4OS43IDEyOS45IDg4IDExNi43Ii8+CiAgICAgICAgPHBvbHlnb24gY2xhc3M9ImNscy0yIiBwb2ludHM9IjE0OC41IDQ3IDE1My41IDIyLjYgMTQ1LjkgMCA4OCA0Mi42IDExMC4zIDYxLjMgMTQxLjggNzAuNSAxNDguNyA2Mi40IDE0NS43IDYwLjIgMTUwLjUgNTUuOSAxNDYuOCA1MyAxNTEuNiA0OS40IDE0OC41IDQ3Ii8+CiAgICAgICAgPHBvbHlnb24gY2xhc3M9ImNscy0yIiBwb2ludHM9IjAgMjIuNiA1LjEgNDcgMS45IDQ5LjQgNi43IDUzLjEgMyA1NS45IDcuOCA2MC4yIDQuOCA2Mi40IDExLjggNzAuNSA0My4zIDYxLjMgNjUuNiA0Mi42IDcuNiAwIDAgMjIuNiIvPgogICAgICAgIDxwb2x5Z29uIGNsYXNzPSJjbHMtNiIgcG9pbnRzPSIxNDEuOCA3MC41IDExMC4zIDYxLjMgMTE5LjggNzUuNiAxMDUuNiAxMDMuMSAxMjQuNCAxMDIuOCAxNTIuNCAxMDIuOCAxNDEuOCA3MC41Ii8+CiAgICAgICAgPHBvbHlnb24gY2xhc3M9ImNscy02IiBwb2ludHM9IjQzLjMgNjEuMyAxMS44IDcwLjUgMS4zIDEwMi44IDI5LjIgMTAyLjggNDcuOSAxMDMuMSAzMy44IDc1LjYgNDMuMyA2MS4zIi8+CiAgICAgICAgPHBvbHlnb24gY2xhc3M9ImNscy02IiBwb2ludHM9Ijg2IDc3LjEgODggNDIuNiA5Ny4xIDE4LjEgNTYuNCAxOC4xIDY1LjYgNDIuNiA2Ny42IDc3LjEgNjguNCA4Ny45IDY4LjQgMTE0LjcgODUuMSAxMTQuNyA4NS4yIDg3LjkgODYgNzcuMSIvPgogICAgICA8L2c+CiAgICA8L2c+CiAgICA8ZyBpZD0iY2FyZGFub19hZGEiIGRhdGEtbmFtZT0iY2FyZGFubyBhZGEiPgogICAgICA8ZyBpZD0iY2FyZGFub19hZGEtMiIgZGF0YS1uYW1lPSJjYXJkYW5vIGFkYS0yIj4KICAgICAgICA8Y2lyY2xlIGlkPSJf0K3Qu9C70LjQv9GBXzYiIGRhdGEtbmFtZT0i0K3Qu9C70LjQv9GBIDYiIGNsYXNzPSJjbHMtNCIgY3g9IjEyOC4wNSIgY3k9IjEyMi41NiIgcj0iNDEuMTUiLz4KICAgICAgICA8cGF0aCBpZD0iX9Ct0LvQu9C40L/RgV82X9C60L7Qv9C40Y9fMjkiIGRhdGEtbmFtZT0i0K3Qu9C70LjQv9GBIDYg0LrQvtC/0LjRjyAyOSIgY2xhc3M9ImNscy04IiBkPSJNMTIzLjQ2LDEwOS45M2MyLjI1LDAsNC4wNywxLjgyLDQuMDcsNC4wNywwLDIuMjUtMS44Miw0LjA3LTQuMDcsNC4wNy0yLjI1LDAtNC4wNy0xLjgyLTQuMDctNC4wNywwLTIuMjUsMS44Mi00LjA3LDQuMDctNC4wN1pNMTMzLjI4LDEwOS45M2MyLjI1LDAsNC4wNywxLjgyLDQuMDcsNC4wNywwLDIuMjUtMS44Miw0LjA3LTQuMDcsNC4wNy0yLjI1LDAtNC4wNy0xLjgyLTQuMDctNC4wNywwLTIuMjUsMS44Mi00LjA3LDQuMDctNC4wN2gwWk0xMzMuMjgsMTI3LjA1YzIuMjUsMCw0LjA3LDEuODIsNC4wNyw0LjA3LDAsMi4yNS0xLjgyLDQuMDctNC4wNyw0LjA3LTIuMjUsMC00LjA3LTEuODItNC4wNy00LjA3LDAtMi4yNSwxLjgyLTQuMDcsNC4wNy00LjA3aDAsMFpNMTIzLjQ2LDEyNy4wNWMyLjI1LDAsNC4wNywxLjgyLDQuMDcsNC4wNywwLDIuMjUtMS44Miw0LjA3LTQuMDcsNC4wNy0yLjI1LDAtNC4wNy0xLjgyLTQuMDctNC4wNywwLTIuMjUsMS44Mi00LjA3LDQuMDctNC4wN1pNMTE4LjQxLDExOC42M2MyLjI1LDAsNC4wNywxLjgyLDQuMDcsNC4wNywwLDIuMjUtMS44Miw0LjA3LTQuMDcsNC4wNy0yLjI1LDAtNC4wNy0xLjgyLTQuMDctNC4wNywwLTIuMjUsMS44Mi00LjA3LDQuMDctNC4wN2gwWk0xMzguMzMsMTE4LjYzYzIuMjUsMCw0LjA3LDEuODIsNC4wNyw0LjA3LDAsMi4yNS0xLjgyLDQuMDctNC4wNyw0LjA3LTIuMjUsMC00LjA3LTEuODItNC4wNy00LjA3LDAtMi4yNSwxLjgyLTQuMDcsNC4wNy00LjA3aDBaTTE0Mi45NiwxMTEuNjJjMS4zOSwwLDIuNTIsMS4xMywyLjUyLDIuNTMsMCwxLjM5LTEuMTMsMi41Mi0yLjUzLDIuNTItMS4zOSwwLTIuNTItMS4xMy0yLjUyLTIuNTJzMS4xMy0yLjUyLDIuNTItMi41MmgwWk0xNDIuOTYsMTI4LjQ1YzEuMzksMCwyLjUyLDEuMTMsMi41MiwyLjUzLDAsMS4zOS0xLjEzLDIuNTItMi41MywyLjUyLTEuMzksMC0yLjUyLTEuMTMtMi41Mi0yLjUyczEuMTMtMi41MiwyLjUyLTIuNTJoMFpNMTEzLjc4LDEyOC40NWMxLjM5LDAsMi41MiwxLjEzLDIuNTIsMi41MywwLDEuMzktMS4xMywyLjUyLTIuNTMsMi41Mi0xLjM5LDAtMi41Mi0xLjEzLTIuNTItMi41MiwwLTEuMzksMS4xMy0yLjUyLDIuNTMtMi41MmgwWk0xMTMuNzgsMTExLjYyYzEuMzksMCwyLjUyLDEuMTMsMi41MiwyLjUzLDAsMS4zOS0xLjEzLDIuNTItMi41MywyLjUyLTEuMzksMC0yLjUyLTEuMTMtMi41Mi0yLjUyLDAtMS4zOSwxLjEzLTIuNTIsMi41My0yLjUyaDBaTTEyOC4zNywxMDMuMmMxLjM5LDAsMi41MiwxLjEzLDIuNTIsMi41MywwLDEuMzktMS4xMywyLjUyLTIuNTMsMi41Mi0xLjM5LDAtMi41Mi0xLjEzLTIuNTItMi41MnMxLjEzLTIuNTIsMi41Mi0yLjUyaDBaTTEyOC4zNywxMzYuODZjMS4zOSwwLDIuNTIsMS4xMywyLjUyLDIuNTMsMCwxLjM5LTEuMTMsMi41Mi0yLjUzLDIuNTItMS4zOSwwLTIuNTItMS4xMy0yLjUyLTIuNTJzMS4xMy0yLjUyLDIuNTItMi41MmgwWk0xMzkuMTcsMTM5LjM5YzEuMTYsMCwyLjEuOTQsMi4xLDIuMSwwLDEuMTYtLjk0LDIuMS0yLjEsMi4xLTEuMTYsMC0yLjEtLjk0LTIuMS0yLjFzLjk0LTIuMSwyLjEtMi4xaDBaTTExNy41NywxMzkuMzljMS4xNiwwLDIuMS45NCwyLjEsMi4xLDAsMS4xNi0uOTQsMi4xLTIuMSwyLjEtMS4xNiwwLTIuMS0uOTQtMi4xLTIuMXMuOTQtMi4xLDIuMS0yLjFoMFpNMTE3LjU3LDEwMS41MmMxLjE2LDAsMi4xLjk0LDIuMSwyLjEsMCwxLjE2LS45NCwyLjEtMi4xLDIuMS0xLjE2LDAtMi4xLS45NC0yLjEtMi4xcy45NC0yLjEsMi4xLTIuMWgwWk0xMzkuMTcsMTAxLjUyYzEuMTYsMCwyLjEuOTQsMi4xLDIuMSwwLDEuMTYtLjk0LDIuMS0yLjEsMi4xLTEuMTYsMC0yLjEtLjk0LTIuMS0yLjFzLjk0LTIuMSwyLjEtMi4xaDBaTTE1MC4xMSwxMjAuMzFjMS4xNiwwLDIuMS45NCwyLjEsMi4xLDAsMS4xNi0uOTQsMi4xLTIuMSwyLjEtMS4xNiwwLTIuMS0uOTQtMi4xLTIuMSwwLTEuMTYuOTQtMi4xLDIuMS0yLjFoMFpNMTA2LjYyLDEyMC4zMWMxLjE2LDAsMi4xLjk0LDIuMSwyLjEsMCwxLjE2LS45NCwyLjEtMi4xLDIuMS0xLjE2LDAtMi4xLS45NC0yLjEtMi4xcy45NC0yLjEsMi4xLTIuMWgwWk0xMDUuMDgsMTA3LjQxYy45MywwLDEuNjguNzUsMS42OCwxLjY4cy0uNzUsMS42OC0xLjY4LDEuNjgtMS42OC0uNzUtMS42OC0xLjY4aDBjMC0uOTMuNzUtMS42OCwxLjY4LTEuNjhoMFpNMTA1LjA4LDEzNC4zNGMuOTMsMCwxLjY4Ljc1LDEuNjgsMS42OHMtLjc1LDEuNjgtMS42OCwxLjY4LTEuNjgtLjc1LTEuNjgtMS42OGgwYzAtLjkzLjc1LTEuNjgsMS42OC0xLjY4aDBaTTE1MS42NiwxMzQuMzRjLjkzLDAsMS42OC43NSwxLjY4LDEuNjgsMCwuOTMtLjc1LDEuNjgtMS42OCwxLjY4cy0xLjY4LS43NS0xLjY4LTEuNjhoMGMwLS45My43NS0xLjY4LDEuNjgtMS42OGgwWk0xNTEuNjYsMTA3LjQxYy45MywwLDEuNjguNzUsMS42OCwxLjY4LDAsLjkzLS43NSwxLjY4LTEuNjgsMS42OHMtMS42OC0uNzUtMS42OC0xLjY4aDBjMC0uOTMuNzUtMS42OCwxLjY4LTEuNjhoMFpNMTI4LjM3LDkzLjk0Yy45MywwLDEuNjguNzUsMS42OCwxLjY4LDAsLjkzLS43NSwxLjY4LTEuNjgsMS42OC0uOTMsMC0xLjY4LS43NS0xLjY4LTEuNjhoMGMwLS45My43NS0xLjY4LDEuNjgtMS42OGgwWk0xMjguMzcsMTQ3LjhjLjkzLDAsMS42OC43NSwxLjY4LDEuNjgsMCwuOTMtLjc1LDEuNjgtMS42OCwxLjY4LS45MywwLTEuNjgtLjc1LTEuNjgtMS42OHMuNzUtMS42OCwxLjY4LTEuNjhoMFpNMTQzLjI0LDE0Ni42OGMuNzcsMCwxLjQuNjMsMS40LDEuNCwwLC43Ny0uNjMsMS40LTEuNCwxLjRzLTEuNC0uNjMtMS40LTEuNGgwYzAtLjc3LjYzLTEuNCwxLjQtMS40Wk0xMTMuNSwxNDYuNjhjLjc3LDAsMS40LjYzLDEuNCwxLjRzLS42MywxLjQtMS40LDEuNC0xLjQtLjYzLTEuNC0xLjRoMGMwLS43Ny42My0xLjQsMS40LTEuNFpNMTEzLjUsOTUuNjNjLjc3LDAsMS40LjYzLDEuNCwxLjRzLS42MywxLjQtMS40LDEuNC0xLjQtLjYzLTEuNC0xLjRoMGMwLS43Ny42My0xLjQsMS40LTEuNGgwWk0xNDMuMjQsOTUuNjNjLjc3LDAsMS40LjYzLDEuNCwxLjQsMCwuNzctLjYzLDEuNC0xLjQsMS40cy0xLjQtLjYzLTEuNC0xLjRoMGMwLS43Ny42My0xLjQsMS40LTEuNGgwWk0xNTcuODMsMTIxLjE2Yy43NywwLDEuNC42MywxLjQsMS40LDAsLjc3LS42MywxLjQtMS40LDEuNHMtMS40LS42My0xLjQtMS40aDBjMC0uNzguNjMtMS40LDEuNC0xLjRoMFpNOTguOTEsMTIxLjE2Yy43NywwLDEuNC42MywxLjQsMS40cy0uNjMsMS40LTEuNCwxLjQtMS40LS42My0xLjQtMS40aDBjMC0uNzguNjMtMS40LDEuNC0xLjRoMFoiLz4KICAgICAgPC9nPgogICAgPC9nPgogIDwvZz4KPC9zdmc+",
  version: "version"
};

// src/browser/metamask.ts
var nufiDomain = {
  production: "https://wallet.nu.fi",
  mainnet: "https://wallet-staging.nu.fi",
  preprod: "https://wallet-testnet-staging.nu.fi",
  preview: "https://wallet-preview-staging.nu.fi"
};
async function checkIfMetamaskInstalled(network = "preprod") {
  try {
    const _nufiCoreSdk = nufiCoreSdk.default;
    if (Object.keys(nufiDomain).includes(network)) {
      _nufiCoreSdk.init(nufiDomain[network]);
    } else {
      _nufiCoreSdk.init(network);
    }
    const metamask = window.ethereum._metamask;
    if (metamask) {
      initNufiDappCardanoSdk(_nufiCoreSdk, "snap");
      return nufiSnap;
    }
    return void 0;
  } catch (err) {
    return Promise.resolve(void 0);
  }
}

// src/browser/index.ts
var BrowserWallet = class _BrowserWallet {
  constructor(_walletInstance, _walletName) {
    this._walletInstance = _walletInstance;
    this._walletName = _walletName;
    this.walletInstance = { ..._walletInstance };
  }
  walletInstance;
  /**
   * Returns a list of wallets installed on user's device. Each wallet is an object with the following properties:
   * - A name is provided to display wallet's name on the user interface.
   * - A version is provided to display wallet's version on the user interface.
   * - An icon is provided to display wallet's icon on the user interface.
   *
   * @returns a list of wallet names
   */
  static async getAvailableWallets({
    metamask = {
      network: "preprod"
    }
  } = {}) {
    if (window === void 0) return [];
    if (metamask) await checkIfMetamaskInstalled(metamask.network);
    const wallets = _BrowserWallet.getInstalledWallets();
    return wallets;
  }
  /**
   * Returns a list of wallets installed on user's device. Each wallet is an object with the following properties:
   * - A name is provided to display wallet's name on the user interface.
   * - A version is provided to display wallet's version on the user interface.
   * - An icon is provided to display wallet's icon on the user interface.
   *
   * @returns a list of wallet names
   */
  static getInstalledWallets() {
    if (window === void 0) return [];
    if (window.cardano === void 0) return [];
    let wallets = [];
    for (const key in window.cardano) {
      try {
        const _wallet = window.cardano[key];
        if (_wallet === void 0) continue;
        if (_wallet.name === void 0) continue;
        if (_wallet.icon === void 0) continue;
        if (_wallet.apiVersion === void 0) continue;
        wallets.push({
          id: key,
          name: key == "nufiSnap" ? "MetaMask" : _wallet.name,
          icon: _wallet.icon,
          version: _wallet.apiVersion
        });
      } catch (e) {
      }
    }
    return wallets;
  }
  /**
   * This is the entrypoint to start communication with the user's wallet. The wallet should request the user's permission to connect the web page to the user's wallet, and if permission has been granted, the wallet will be returned and exposing the full API for the dApp to use.
   *
   * Query BrowserWallet.getInstalledWallets() to get a list of available wallets, then provide the wallet name for which wallet the user would like to connect with.
   *
   * @param walletName - the name of the wallet to enable (e.g. "eternl", "begin", "nufiSnap")
   * @param extensions - optional, a list of CIPs that the wallet should support
   * @returns WalletInstance
   */
  static async enable(walletName, extensions = []) {
    try {
      const walletInstance = await _BrowserWallet.resolveInstance(
        walletName,
        extensions
      );
      if (walletInstance !== void 0)
        return new _BrowserWallet(walletInstance, walletName);
      throw new Error(`Couldn't create an instance of wallet: ${walletName}`);
    } catch (error) {
      throw new Error(
        `[BrowserWallet] An error occurred during enable: ${JSON.stringify(
          error
        )}.`
      );
    }
  }
  /**
   * Returns a list of assets in the wallet. This API will return every assets in the wallet. Each asset is an object with the following properties:
   * - A unit is provided to display asset's name on the user interface.
   * - A quantity is provided to display asset's quantity on the user interface.
   *
   * @returns a list of assets and their quantities
   */
  async getBalance() {
    const balance = await this._walletInstance.getBalance();
    return fromValue(deserializeValue(balance));
  }
  /**
   * Returns an address owned by the wallet that should be used as a change address to return leftover assets during transaction creation back to the connected wallet.
   *
   * @returns an address
   */
  async getChangeAddress() {
    const changeAddress = await this._walletInstance.getChangeAddress();
    return addressToBech32(deserializeAddress(changeAddress));
  }
  /**
   * This function shall return a list of one or more UTXOs (unspent transaction outputs) controlled by the wallet that are required to reach AT LEAST the combined ADA value target specified in amount AND the best suitable to be used as collateral inputs for transactions with plutus script inputs (pure ADA-only UTXOs).
   *
   * If this cannot be attained, an error message with an explanation of the blocking problem shall be returned. NOTE: wallets are free to return UTXOs that add up to a greater total ADA value than requested in the amount parameter, but wallets must never return any result where UTXOs would sum up to a smaller total ADA value, instead in a case like that an error message must be returned.
   *
   * @param limit
   * @returns a list of UTXOs
   */
  async getCollateral() {
    const deserializedCollateral = await this.getCollateralUnspentOutput();
    return deserializedCollateral.map((dc) => fromTxUnspentOutput(dc));
  }
  /**
   * Return a list of supported CIPs of the wallet.
   *
   * @returns a list of CIPs
   */
  async getExtensions() {
    try {
      const _extensions = await this._walletInstance.getExtensions();
      return _extensions.map((e) => e.cip);
    } catch (e) {
      return [];
    }
  }
  /**
   * Returns the network ID of the currently connected account. 0 is testnet and 1 is mainnet but other networks can possibly be returned by wallets. Those other network ID values are not governed by CIP-30. This result will stay the same unless the connected account has changed.
   *
   * @returns network ID
   */
  getNetworkId() {
    return this._walletInstance.getNetworkId();
  }
  /**
   * Returns a list of reward addresses owned by the wallet. A reward address is a stake address that is used to receive rewards from staking, generally starts from `stake` prefix.
   *
   * @returns a list of reward addresses
   */
  async getRewardAddresses() {
    const rewardAddresses = await this._walletInstance.getRewardAddresses();
    return rewardAddresses.map((ra) => addressToBech32(deserializeAddress(ra)));
  }
  /**
   * Returns a list of unused addresses controlled by the wallet.
   *
   * @returns a list of unused addresses
   */
  async getUnusedAddresses() {
    const unusedAddresses = await this._walletInstance.getUnusedAddresses();
    return unusedAddresses.map(
      (una) => addressToBech32(deserializeAddress(una))
    );
  }
  /**
   * Returns a list of used addresses controlled by the wallet.
   *
   * @returns a list of used addresses
   */
  async getUsedAddresses() {
    const usedAddresses = await this._walletInstance.getUsedAddresses();
    return usedAddresses.map((usa) => addressToBech32(deserializeAddress(usa)));
  }
  /**
   * Return a list of all UTXOs (unspent transaction outputs) controlled by the wallet.
   *
   * @returns a list of UTXOs
   */
  async getUtxos() {
    const deserializedUTxOs = await this.getUsedUTxOs();
    return deserializedUTxOs.map((du) => fromTxUnspentOutput(du));
  }
  /**
   * This endpoint utilizes the [CIP-8 - Message Signing](https://cips.cardano.org/cips/cip8/) to sign arbitrary data, to verify the data was signed by the owner of the private key.
   *
   * @param payload - the data to be signed
   * @param address - optional, if not provided, the first staking address will be used
   * @returns a signature
   */
  async signData(payload, address) {
    if (address === void 0) {
      address = (await this.getUsedAddresses())[0];
    }
    const signerAddress = toAddress2(address).toBytes().toString();
    return this._walletInstance.signData(signerAddress, fromUTF8(payload));
  }
  /**
   * Requests user to sign the provided transaction (tx). The wallet should ask the user for permission, and if given, try to sign the supplied body and return a signed transaction. partialSign should be true if the transaction provided requires multiple signatures.
   *
   * @param unsignedTx - a transaction in CBOR
   * @param partialSign - if the transaction is signed partially
   * @returns a signed transaction in CBOR
   */
  async signTx(unsignedTx, partialSign = false) {
    const witness = await this._walletInstance.signTx(unsignedTx, partialSign);
    if (witness === "") {
      return unsignedTx;
    }
    return _BrowserWallet.addBrowserWitnesses(unsignedTx, witness);
  }
  /**
   * Experimental feature - sign multiple transactions at once (Supported wallet(s): Typhon)
   *
   * @param unsignedTxs - array of unsigned transactions in CborHex string
   * @param partialSign - if the transactions are signed partially
   * @returns array of signed transactions CborHex string
   */
  async signTxs(unsignedTxs, partialSign = false) {
    let witnessSets = void 0;
    switch (this._walletName) {
      case "Typhon Wallet":
        if (this._walletInstance.signTxs) {
          witnessSets = await this._walletInstance.signTxs(
            unsignedTxs,
            partialSign
          );
        }
        break;
      default:
        if (this._walletInstance.signTxs) {
          witnessSets = await this._walletInstance.signTxs(
            unsignedTxs.map((cbor) => ({
              cbor,
              partialSign
            }))
          );
        } else if (this._walletInstance.experimental.signTxs) {
          witnessSets = await this._walletInstance.experimental.signTxs(
            unsignedTxs.map((cbor) => ({
              cbor,
              partialSign
            }))
          );
        }
        break;
    }
    if (!witnessSets) throw new Error("Wallet does not support signTxs");
    const signedTxs = [];
    for (let i = 0; i < witnessSets.length; i++) {
      const unsignedTx = unsignedTxs[i];
      const cWitness = witnessSets[i];
      if (cWitness === "") {
        signedTxs.push(unsignedTx);
      } else {
        const signedTx = _BrowserWallet.addBrowserWitnesses(
          unsignedTx,
          cWitness
        );
        signedTxs.push(signedTx);
      }
    }
    return signedTxs;
  }
  /**
   * Submits the signed transaction to the blockchain network.
   *
   * As wallets should already have this ability to submit transaction, we allow dApps to request that a transaction be sent through it. If the wallet accepts the transaction and tries to send it, it shall return the transaction ID for the dApp to track. The wallet can return error messages or failure if there was an error in sending it.
   *
   * @param tx
   * @returns a transaction hash
   */
  submitTx(tx) {
    return this._walletInstance.submitTx(tx);
  }
  /**
   * Get a used address of type Address from the wallet.
   *
   * This is used in transaction building.
   *
   * @returns an Address object
   */
  async getUsedAddress() {
    const usedAddresses = await this._walletInstance.getUsedAddresses();
    if (usedAddresses.length === 0) throw new Error("No used addresses found");
    return deserializeAddress(usedAddresses[0]);
  }
  /**
   * Get a list of UTXOs to be used as collateral inputs for transactions with plutus script inputs.
   *
   * This is used in transaction building.
   *
   * @returns a list of UTXOs
   */
  async getCollateralUnspentOutput(limit = DEFAULT_PROTOCOL_PARAMETERS.maxCollateralInputs) {
    let collateral = [];
    try {
      collateral = await this._walletInstance.getCollateral() ?? [];
    } catch (e) {
      try {
        collateral = await this._walletInstance.experimental.getCollateral() ?? [];
      } catch (e2) {
        console.error(e2);
      }
    }
    return collateral.map((c) => deserializeTxUnspentOutput(c)).slice(0, limit);
  }
  /**
   * Get a list of UTXOs to be used for transaction building.
   *
   * This is used in transaction building.
   *
   * @returns a list of UTXOs
   */
  async getUsedUTxOs() {
    const utxos = await this._walletInstance.getUtxos() ?? [];
    return utxos.map((u) => deserializeTxUnspentOutput(u));
  }
  /**
   * A helper function to get the assets in the wallet.
   *
   * @returns a list of assets
   */
  async getAssets() {
    const balance = await this.getBalance();
    return balance.filter((v) => v.unit !== "lovelace").map((v) => {
      const policyId = v.unit.slice(0, POLICY_ID_LENGTH);
      const assetName = v.unit.slice(POLICY_ID_LENGTH);
      const fingerprint = resolveFingerprint(policyId, assetName);
      return {
        unit: v.unit,
        policyId,
        assetName,
        fingerprint,
        quantity: v.quantity
      };
    });
  }
  /**
   * A helper function to get the lovelace balance in the wallet.
   *
   * @returns lovelace balance
   */
  async getLovelace() {
    const balance = await this.getBalance();
    const nativeAsset = balance.find((v) => v.unit === "lovelace");
    return nativeAsset !== void 0 ? nativeAsset.quantity : "0";
  }
  /**
   * A helper function to get the assets of a specific policy ID in the wallet.
   *
   * @param policyId
   * @returns a list of assets
   */
  async getPolicyIdAssets(policyId) {
    const assets = await this.getAssets();
    return assets.filter((v) => v.policyId === policyId);
  }
  /**
   * A helper function to get the policy IDs of all the assets in the wallet.
   *
   * @returns a list of policy IDs
   */
  async getPolicyIds() {
    const balance = await this.getBalance();
    return Array.from(
      new Set(balance.map((v) => v.unit.slice(0, POLICY_ID_LENGTH)))
    ).filter((p) => p !== "lovelace");
  }
  /**
   * The connected wallet account provides the account's public DRep Key, derivation as described in CIP-0105.
   * These are used by the client to identify the user's on-chain CIP-1694 interactions, i.e. if a user has registered to be a DRep.
   *
   * @returns wallet account's public DRep Key
   */
  async getPubDRepKey() {
    try {
      if (this._walletInstance.cip95 === void 0) return void 0;
      const dRepKey = await this._walletInstance.cip95.getPubDRepKey();
      const { dRepKeyHex, dRepIDHash } = await _BrowserWallet.dRepKeyToDRepID(dRepKey);
      const networkId = await this.getNetworkId();
      const dRepId = buildDRepID2(dRepKeyHex, networkId);
      return {
        pubDRepKey: dRepKey,
        dRepIDHash,
        dRepIDBech32: dRepId
        // todo to check
      };
    } catch (e) {
      console.error(e);
      return void 0;
    }
  }
  async getRegisteredPubStakeKeys() {
    try {
      if (this._walletInstance.cip95 === void 0) return void 0;
      const pubStakeKeys = await this._walletInstance.cip95.getRegisteredPubStakeKeys();
      const pubStakeKeyHashes = await Promise.all(
        pubStakeKeys.map(async (pubStakeKey) => {
          const { dRepIDHash } = await _BrowserWallet.dRepKeyToDRepID(pubStakeKey);
          return dRepIDHash;
        })
      );
      return {
        pubStakeKeys,
        pubStakeKeyHashes
      };
    } catch (e) {
      console.error(e);
      return void 0;
    }
  }
  async getUnregisteredPubStakeKeys() {
    try {
      if (this._walletInstance.cip95 === void 0) return void 0;
      const pubStakeKeys = await this._walletInstance.cip95.getUnregisteredPubStakeKeys();
      const pubStakeKeyHashes = await Promise.all(
        pubStakeKeys.map(async (pubStakeKey) => {
          const { dRepIDHash } = await _BrowserWallet.dRepKeyToDRepID(pubStakeKey);
          return dRepIDHash;
        })
      );
      return {
        pubStakeKeys,
        pubStakeKeyHashes
      };
    } catch (e) {
      console.error(e);
      return void 0;
    }
  }
  static async dRepKeyToDRepID(dRepKey) {
    const dRepKeyHex = Ed25519PublicKeyHex2(dRepKey);
    const dRepID = Ed25519PublicKey.fromHex(dRepKeyHex);
    const dRepIDHash = (await dRepID.hash()).hex();
    return {
      dRepKeyHex,
      dRepID,
      dRepIDHash
    };
  }
  static resolveInstance(walletName, extensions = []) {
    if (window.cardano === void 0) return void 0;
    if (window.cardano[walletName] === void 0) return void 0;
    const wallet = window.cardano[walletName];
    if (extensions.length > 0) {
      const _extensions = extensions.map((e) => ({ cip: e }));
      return wallet.enable({ extensions: _extensions });
    } else {
      return wallet?.enable();
    }
  }
  static addBrowserWitnesses(unsignedTx, witnesses) {
    const cWitness = Serialization2.TransactionWitnessSet.fromCbor(
      CardanoSDKUtil.HexBlob(witnesses)
    ).vkeys()?.values();
    if (cWitness === void 0) {
      return unsignedTx;
    }
    let tx = deserializeTx3(unsignedTx);
    let witnessSet = tx.witnessSet();
    let witnessSetVkeys = witnessSet.vkeys();
    let witnessSetVkeysValues = witnessSetVkeys ? [...witnessSetVkeys.values(), ...cWitness] : [...cWitness];
    witnessSet.setVkeys(
      Serialization2.CborSet.fromCore(
        witnessSetVkeysValues.map((vkw) => vkw.toCore()),
        VkeyWitness2.fromCore
      )
    );
    return new Transaction2(tx.body(), witnessSet, tx.auxiliaryData()).toCbor();
  }
  static getSupportedExtensions(wallet) {
    const _supportedExtensions = window?.cardano?.[wallet]?.supportedExtensions;
    if (_supportedExtensions) return _supportedExtensions;
    else return [];
  }
};

// src/mesh/index.ts
import {
  POLICY_ID_LENGTH as POLICY_ID_LENGTH2,
  resolveFingerprint as resolveFingerprint2,
  toUTF8
} from "@meshsdk/common";
import { resolvePrivateKey } from "@meshsdk/core-csl";
import {
  Address as Address4,
  buildBaseAddress as buildBaseAddress2,
  buildEnterpriseAddress as buildEnterpriseAddress2,
  buildRewardAddress as buildRewardAddress2,
  deserializeTx as deserializeTx4,
  Ed25519KeyHashHex as Ed25519KeyHashHex3,
  fromTxUnspentOutput as fromTxUnspentOutput2,
  Hash28ByteBase16 as Hash28ByteBase162,
  toAddress as toAddress3,
  toTxUnspentOutput as toTxUnspentOutput2
} from "@meshsdk/core-cst";
import { Transaction as Transaction3 } from "@meshsdk/transaction";
var MeshWallet = class {
  _wallet;
  _accountIndex = 0;
  _keyIndex = 0;
  _fetcher;
  _submitter;
  _networkId;
  addresses = {};
  constructor(options) {
    this._networkId = options.networkId;
    switch (options.key.type) {
      case "root":
        this._wallet = new EmbeddedWallet({
          networkId: options.networkId,
          key: {
            type: "root",
            bech32: options.key.bech32
          }
        });
        this.getAddressesFromWallet(this._wallet);
        break;
      case "cli":
        this._wallet = new EmbeddedWallet({
          networkId: options.networkId,
          key: {
            type: "cli",
            payment: options.key.payment,
            stake: options.key.stake
          }
        });
        this.getAddressesFromWallet(this._wallet);
        break;
      case "mnemonic":
        this._wallet = new EmbeddedWallet({
          networkId: options.networkId,
          key: {
            type: "mnemonic",
            words: options.key.words
          }
        });
        this.getAddressesFromWallet(this._wallet);
        break;
      case "address":
        this._wallet = null;
        this.buildAddressFromBech32Address(options.key.address);
        break;
    }
    if (options.fetcher) this._fetcher = options.fetcher;
    if (options.submitter) this._submitter = options.submitter;
    if (options.accountIndex) this._accountIndex = options.accountIndex;
    if (options.keyIndex) this._keyIndex = options.keyIndex;
  }
  /**
   * Returns a list of assets in the wallet. This API will return every assets in the wallet. Each asset is an object with the following properties:
   * - A unit is provided to display asset's name on the user interface.
   * - A quantity is provided to display asset's quantity on the user interface.
   *
   * @returns a list of assets and their quantities
   */
  async getBalance() {
    const utxos = await this.getUnspentOutputs();
    const assets = /* @__PURE__ */ new Map();
    utxos.map((utxo) => {
      const _utxo = fromTxUnspentOutput2(utxo);
      _utxo.output.amount.map((asset) => {
        const assetId = asset.unit;
        const amount = Number(asset.quantity);
        if (assets.has(assetId)) {
          const quantity = assets.get(assetId);
          assets.set(assetId, quantity + amount);
        } else {
          assets.set(assetId, amount);
        }
      });
    });
    const arrayAssets = Array.from(assets, ([unit, quantity]) => ({
      unit,
      quantity: quantity.toString()
    }));
    return arrayAssets;
  }
  /**
   * Returns an address owned by the wallet that should be used as a change address to return leftover assets during transaction creation back to the connected wallet.
   *
   * @returns an address
   */
  getChangeAddress() {
    return this.addresses.baseAddressBech32 ? this.addresses.baseAddressBech32 : this.addresses.enterpriseAddressBech32;
  }
  /**
   * This function shall return a list of one or more UTXOs (unspent transaction outputs) controlled by the wallet that are required to reach AT LEAST the combined ADA value target specified in amount AND the best suitable to be used as collateral inputs for transactions with plutus script inputs (pure ADA-only UTXOs).
   *
   * If this cannot be attained, an error message with an explanation of the blocking problem shall be returned. NOTE: wallets are free to return UTXOs that add up to a greater total ADA value than requested in the amount parameter, but wallets must never return any result where UTXOs would sum up to a smaller total ADA value, instead in a case like that an error message must be returned.
   *
   * @param addressType - the type of address to fetch UTXOs from (default: payment)
   * @returns a list of UTXOs
   */
  async getCollateral(addressType = "payment") {
    const utxos = await this.getCollateralUnspentOutput(addressType);
    return utxos.map((utxo, i) => {
      return fromTxUnspentOutput2(utxo);
    });
  }
  /**
   * Get a list of UTXOs to be used as collateral inputs for transactions with plutus script inputs.
   *
   * This is used in transaction building.
   *
   * @param addressType - the type of address to fetch UTXOs from (default: payment)
   * @returns a list of UTXOs
   */
  async getCollateralUnspentOutput(addressType = "payment") {
    const utxos = await this.getUnspentOutputs(addressType);
    const pureAdaUtxos = utxos.filter((utxo) => {
      return utxo.output().amount().multiasset() === void 0;
    });
    pureAdaUtxos.sort((a, b) => {
      return Number(a.output().amount().coin()) - Number(b.output().amount().coin());
    });
    for (const utxo of pureAdaUtxos) {
      if (Number(utxo.output().amount().coin()) >= 5e6) {
        return [utxo];
      }
    }
    return [];
  }
  /**
   * Returns the network ID of the currently connected account. 0 is testnet and 1 is mainnet but other networks can possibly be returned by wallets. Those other network ID values are not governed by CIP-30. This result will stay the same unless the connected account has changed.
   *
   * @returns network ID
   */
  getNetworkId() {
    return this._networkId;
  }
  /**
   * Returns a list of reward addresses owned by the wallet. A reward address is a stake address that is used to receive rewards from staking, generally starts from `stake` prefix.
   *
   * @returns a list of reward addresses
   */
  getRewardAddresses() {
    return [this.addresses.rewardAddressBech32];
  }
  /**
   * Returns a list of unused addresses controlled by the wallet.
   *
   * @returns a list of unused addresses
   */
  getUnusedAddresses() {
    return [this.getChangeAddress()];
  }
  /**
   * Returns a list of used addresses controlled by the wallet.
   *
   * @returns a list of used addresses
   */
  getUsedAddresses() {
    return [this.getChangeAddress()];
  }
  /**
   * Get a list of UTXOs to be used for transaction building.
   *
   * This is used in transaction building.
   *
   * @param addressType - the type of address to fetch UTXOs from (default: payment)
   * @returns a list of UTXOs
   */
  async getUsedUTxOs(addressType = "payment") {
    return await this.getUnspentOutputs(addressType);
  }
  /**
   * Return a list of all UTXOs (unspent transaction outputs) controlled by the wallet.
   *
   * @param addressType - the type of address to fetch UTXOs from (default: payment)
   * @returns a list of UTXOs
   */
  async getUtxos(addressType = "payment") {
    const utxos = await this.getUsedUTxOs(addressType);
    return utxos.map((c) => fromTxUnspentOutput2(c));
  }
  /**
   * This endpoint utilizes the [CIP-8 - Message Signing](https://cips.cardano.org/cips/cip8/) to sign arbitrary data, to verify the data was signed by the owner of the private key.
   *
   * @param payload - the payload to sign
   * @param address - the address to use for signing (optional)
   * @returns a signature
   */
  signData(payload, address) {
    if (!this._wallet) {
      throw new Error(
        "[MeshWallet] Read only wallet does not support signing data."
      );
    }
    if (address === void 0) {
      address = this.getChangeAddress();
    }
    return this._wallet.signData(address, payload);
  }
  /**
   * Requests user to sign the provided transaction (tx). The wallet should ask the user for permission, and if given, try to sign the supplied body and return a signed transaction. partialSign should be true if the transaction provided requires multiple signatures.
   *
   * @param unsignedTx - a transaction in CBOR
   * @param partialSign - if the transaction is partially signed (default: false)
   * @returns a signed transaction in CBOR
   */
  signTx(unsignedTx, partialSign = false) {
    if (!this._wallet) {
      throw new Error(
        "[MeshWallet] Read only wallet does not support signing data."
      );
    }
    const tx = deserializeTx4(unsignedTx);
    if (!partialSign && tx.witnessSet().vkeys() !== void 0 && tx.witnessSet().vkeys().size() !== 0)
      throw new Error(
        "Signatures already exist in the transaction in a non partial sign call"
      );
    const newSignatures = this._wallet.signTx(
      unsignedTx,
      this._accountIndex,
      this._keyIndex
    );
    let signedTx = EmbeddedWallet.addWitnessSets(unsignedTx, [newSignatures]);
    return signedTx;
  }
  /**
   * Experimental feature - sign multiple transactions at once.
   *
   * @param unsignedTxs - array of unsigned transactions in CborHex string
   * @param partialSign - if the transactions are signed partially
   * @returns array of signed transactions CborHex string
   */
  signTxs(unsignedTxs, partialSign = false) {
    if (!this._wallet) {
      throw new Error(
        "[MeshWallet] Read only wallet does not support signing data."
      );
    }
    const signedTxs = [];
    for (const unsignedTx of unsignedTxs) {
      const signedTx = this.signTx(unsignedTx, partialSign);
      signedTxs.push(signedTx);
    }
    return signedTxs;
  }
  /**
   * Submits the signed transaction to the blockchain network.
   *
   * As wallets should already have this ability to submit transaction, we allow dApps to request that a transaction be sent through it. If the wallet accepts the transaction and tries to send it, it shall return the transaction ID for the dApp to track. The wallet can return error messages or failure if there was an error in sending it.
   *
   * @param tx - a signed transaction in CBOR
   * @returns a transaction hash
   */
  async submitTx(tx) {
    if (!this._submitter) {
      throw new Error(
        "[MeshWallet] Submitter is required to submit transactions. Please provide a submitter."
      );
    }
    return this._submitter.submitTx(tx);
  }
  /**
   * Get a used address of type Address from the wallet.
   *
   * This is used in transaction building.
   *
   * @param addressType - the type of address to fetch UTXOs from (default: payment)
   * @returns an Address object
   */
  getUsedAddress(addressType = "payment") {
    if (this.addresses.baseAddressBech32 && addressType === "payment") {
      return toAddress3(this.addresses.baseAddressBech32);
    } else {
      return toAddress3(this.addresses.enterpriseAddressBech32);
    }
  }
  /**
   * Get a list of UTXOs to be used for transaction building.
   *
   * This is used in transaction building.
   *
   * @param addressType - the type of address to fetch UTXOs from (default: payment)
   * @returns a list of UTXOs
   */
  async getUnspentOutputs(addressType = "payment") {
    if (!this._fetcher) {
      throw new Error(
        "[MeshWallet] Fetcher is required to fetch UTxOs. Please provide a fetcher."
      );
    }
    const utxos = await this._fetcher.fetchAddressUTxOs(
      this.addresses.baseAddressBech32 && addressType == "payment" ? this.addresses.baseAddressBech32 : this.addresses.enterpriseAddressBech32
    );
    return utxos.map((utxo) => toTxUnspentOutput2(utxo));
  }
  /**
   * A helper function to get the assets in the wallet.
   *
   * @returns a list of assets
   */
  async getAssets() {
    const balance = await this.getBalance();
    return balance.filter((v) => v.unit !== "lovelace").map((v) => {
      const policyId = v.unit.slice(0, POLICY_ID_LENGTH2);
      const assetName = v.unit.slice(POLICY_ID_LENGTH2);
      const fingerprint = resolveFingerprint2(policyId, assetName);
      return {
        unit: v.unit,
        policyId,
        assetName: toUTF8(assetName),
        fingerprint,
        quantity: v.quantity
      };
    });
  }
  /**
   * A helper function to get the lovelace balance in the wallet.
   *
   * @returns lovelace balance
   */
  async getLovelace() {
    const balance = await this.getBalance();
    const nativeAsset = balance.find((v) => v.unit === "lovelace");
    return nativeAsset !== void 0 ? nativeAsset.quantity : "0";
  }
  /**
   * A helper function to get the assets of a specific policy ID in the wallet.
   *
   * @param policyId
   * @returns a list of assets
   */
  async getPolicyIdAssets(policyId) {
    const assets = await this.getAssets();
    return assets.filter((v) => v.policyId === policyId);
  }
  /**
   * A helper function to get the policy IDs of all the assets in the wallet.
   *
   * @returns a list of policy IDs
   */
  async getPolicyIds() {
    const balance = await this.getBalance();
    return Array.from(
      new Set(balance.map((v) => v.unit.slice(0, POLICY_ID_LENGTH2)))
    ).filter((p) => p !== "lovelace");
  }
  /**
   * A helper function to create a collateral input for a transaction.
   *
   * @returns a transaction hash
   */
  async createCollateral() {
    const tx = new Transaction3({ initiator: this });
    tx.sendLovelace(this.getChangeAddress(), "5000000");
    const unsignedTx = await tx.build();
    const signedTx = await this.signTx(unsignedTx);
    const txHash = await this.submitTx(signedTx);
    return txHash;
  }
  getPubDRepKey() {
    return {
      pubDRepKey: this.addresses.pubDRepKey,
      dRepIDBech32: this.addresses.dRepIDBech32,
      dRepIDHash: this.addresses.dRepIDHash
    };
  }
  /**
   * Generate mnemonic or private key
   *
   * @param privateKey return private key if true
   * @returns a transaction hash
   */
  static brew(privateKey = false, strength = 256) {
    const mnemonic = EmbeddedWallet.generateMnemonic(strength);
    if (privateKey) {
      return resolvePrivateKey(mnemonic);
    }
    return mnemonic;
  }
  getAddressesFromWallet(wallet) {
    const account = wallet.getAccount(this._accountIndex, this._keyIndex);
    this.addresses = {
      baseAddress: account.baseAddress,
      enterpriseAddress: account.enterpriseAddress,
      rewardAddress: account.rewardAddress,
      baseAddressBech32: account.baseAddressBech32,
      enterpriseAddressBech32: account.enterpriseAddressBech32,
      rewardAddressBech32: account.rewardAddressBech32,
      pubDRepKey: account.pubDRepKey,
      dRepIDBech32: account.dRepIDBech32,
      dRepIDHash: account.dRepIDHash
    };
  }
  buildAddressFromBech32Address(address) {
    let pubKeyHash = void 0;
    let stakeKeyHash = void 0;
    const baseAddress = Address4.fromBech32(address).asBase();
    if (baseAddress) {
      pubKeyHash = baseAddress.getPaymentCredential().hash;
      stakeKeyHash = baseAddress.getStakeCredential().hash;
    }
    const enterpriseAddress = Address4.fromBech32(address).asEnterprise();
    if (enterpriseAddress) {
      pubKeyHash = enterpriseAddress.getPaymentCredential().hash;
    }
    const rewardAddress = Address4.fromBech32(address).asReward();
    if (rewardAddress) {
      stakeKeyHash = rewardAddress.getPaymentCredential().hash;
    }
    if (pubKeyHash && stakeKeyHash) {
      this.addresses.baseAddress = buildBaseAddress2(
        this._networkId,
        Hash28ByteBase162.fromEd25519KeyHashHex(Ed25519KeyHashHex3(pubKeyHash)),
        Hash28ByteBase162.fromEd25519KeyHashHex(
          Ed25519KeyHashHex3(Ed25519KeyHashHex3(stakeKeyHash))
        )
      ).toAddress();
      this.addresses.baseAddressBech32 = this.addresses.baseAddress.toBech32();
    }
    if (pubKeyHash) {
      this.addresses.enterpriseAddress = buildEnterpriseAddress2(
        this._networkId,
        Hash28ByteBase162.fromEd25519KeyHashHex(Ed25519KeyHashHex3(pubKeyHash))
      ).toAddress();
      this.addresses.enterpriseAddressBech32 = this.addresses.enterpriseAddress.toBech32();
    }
    if (stakeKeyHash) {
      this.addresses.rewardAddress = buildRewardAddress2(
        this._networkId,
        Hash28ByteBase162.fromEd25519KeyHashHex(Ed25519KeyHashHex3(stakeKeyHash))
      ).toAddress();
      this.addresses.rewardAddressBech32 = this.addresses.rewardAddress.toBech32();
    }
  }
};
export {
  AppWallet,
  BrowserWallet,
  EmbeddedWallet,
  MeshWallet,
  WalletStaticMethods
};
/*! Bundled license information:

@scure/base/lib/esm/index.js:
  (*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
