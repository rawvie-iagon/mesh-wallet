import { DataSignature, IFetcher, ISubmitter, ISigner, IInitiator, Wallet, Asset, UTxO, AssetExtended } from '@meshsdk/common';
import { Ed25519PublicKeyHex, TransactionUnspentOutput, Address, StricaPrivateKey, DRepID, Ed25519KeyHashHex, VkeyWitness } from '@meshsdk/core-cst';

type Cardano = {
    [key: string]: {
        name: string;
        icon: string;
        apiVersion: string;
        enable: (extensions?: {
            extensions: {
                cip: number;
            }[];
        }) => Promise<WalletInstance>;
        supportedExtensions?: {
            cip: number;
        }[];
    };
};
type TransactionSignatureRequest = {
    cbor: string;
    partialSign: boolean;
};
interface Cip30WalletApi {
    experimental: ExperimentalFeatures;
    getBalance(): Promise<string>;
    getChangeAddress(): Promise<string>;
    getExtensions(): Promise<{
        cip: number;
    }[]>;
    getCollateral(): Promise<string[] | undefined>;
    getNetworkId(): Promise<number>;
    getRewardAddresses(): Promise<string[]>;
    getUnusedAddresses(): Promise<string[]>;
    getUsedAddresses(): Promise<string[]>;
    getUtxos(): Promise<string[] | undefined>;
    signData(address: string, payload: string): Promise<DataSignature>;
    signTx(tx: string, partialSign: boolean): Promise<string>;
    signTxs?(txs: TransactionSignatureRequest[]): Promise<string[]>;
    signTxs?(txs: string[], partialSign: boolean): Promise<string[]>;
    submitTx(tx: string): Promise<string>;
    cip95?: Cip95WalletApi;
}
interface Cip95WalletApi {
    getRegisteredPubStakeKeys: () => Promise<Ed25519PublicKeyHex[]>;
    getUnregisteredPubStakeKeys: () => Promise<Ed25519PublicKeyHex[]>;
    getPubDRepKey: () => Promise<Ed25519PublicKeyHex>;
}
type WalletInstance = Cip30WalletApi & Cip95WalletApi;
type ExperimentalFeatures = {
    getCollateral(): Promise<string[] | undefined>;
    signTxs?(txs: TransactionSignatureRequest[]): Promise<string[]>;
    signTxs?(txs: string[], partialSign: boolean): Promise<string[]>;
};
type GetAddressType = "enterprise" | "payment";

type AppWalletKeyType = {
    type: "root";
    bech32: string;
} | {
    type: "cli";
    payment: string;
    stake?: string;
} | {
    type: "mnemonic";
    words: string[];
};
type CreateAppWalletOptions = {
    networkId: number;
    fetcher?: IFetcher;
    submitter?: ISubmitter;
    key: AppWalletKeyType;
};
declare class AppWallet implements ISigner, ISubmitter {
    private readonly _fetcher?;
    private readonly _submitter?;
    private readonly _wallet;
    constructor(options: CreateAppWalletOptions);
    /**
     * Get a list of UTXOs to be used as collateral inputs for transactions with plutus script inputs.
     *
     * This is used in transaction building.
     *
     * @returns a list of UTXOs
     */
    getCollateralUnspentOutput(accountIndex?: number, addressType?: GetAddressType): Promise<TransactionUnspentOutput[]>;
    getEnterpriseAddress(accountIndex?: number, keyIndex?: number): string;
    getPaymentAddress(accountIndex?: number, keyIndex?: number): string;
    getRewardAddress(accountIndex?: number, keyIndex?: number): string;
    getNetworkId(): number;
    getUsedAddress(accountIndex?: number, keyIndex?: number, addressType?: GetAddressType): Address;
    getUnspentOutputs(accountIndex?: number, addressType?: GetAddressType): Promise<TransactionUnspentOutput[]>;
    signData(address: string, payload: string, accountIndex?: number, keyIndex?: number): DataSignature;
    signTx(unsignedTx: string, partialSign?: boolean, accountIndex?: number, keyIndex?: number): string;
    signTxSync(unsignedTx: string, partialSign?: boolean, accountIndex?: number, keyIndex?: number): string;
    signTxs(unsignedTxs: string[], partialSign: boolean): Promise<string[]>;
    submitTx(tx: string): Promise<string>;
    static brew(strength?: number): string[];
}

declare global {
    interface Window {
        cardano: Cardano;
    }
}
declare class BrowserWallet implements IInitiator, ISigner, ISubmitter {
    readonly _walletInstance: WalletInstance;
    readonly _walletName: string;
    walletInstance: WalletInstance;
    private constructor();
    /**
     * Returns a list of wallets installed on user's device. Each wallet is an object with the following properties:
     * - A name is provided to display wallet's name on the user interface.
     * - A version is provided to display wallet's version on the user interface.
     * - An icon is provided to display wallet's icon on the user interface.
     *
     * @returns a list of wallet names
     */
    static getAvailableWallets({ metamask, }?: {
        metamask?: {
            network: string;
        };
    }): Promise<Wallet[]>;
    /**
     * Returns a list of wallets installed on user's device. Each wallet is an object with the following properties:
     * - A name is provided to display wallet's name on the user interface.
     * - A version is provided to display wallet's version on the user interface.
     * - An icon is provided to display wallet's icon on the user interface.
     *
     * @returns a list of wallet names
     */
    static getInstalledWallets(): Wallet[];
    /**
     * This is the entrypoint to start communication with the user's wallet. The wallet should request the user's permission to connect the web page to the user's wallet, and if permission has been granted, the wallet will be returned and exposing the full API for the dApp to use.
     *
     * Query BrowserWallet.getInstalledWallets() to get a list of available wallets, then provide the wallet name for which wallet the user would like to connect with.
     *
     * @param walletName - the name of the wallet to enable (e.g. "eternl", "begin", "nufiSnap")
     * @param extensions - optional, a list of CIPs that the wallet should support
     * @returns WalletInstance
     */
    static enable(walletName: string, extensions?: number[]): Promise<BrowserWallet>;
    /**
     * Returns a list of assets in the wallet. This API will return every assets in the wallet. Each asset is an object with the following properties:
     * - A unit is provided to display asset's name on the user interface.
     * - A quantity is provided to display asset's quantity on the user interface.
     *
     * @returns a list of assets and their quantities
     */
    getBalance(): Promise<Asset[]>;
    /**
     * Returns an address owned by the wallet that should be used as a change address to return leftover assets during transaction creation back to the connected wallet.
     *
     * @returns an address
     */
    getChangeAddress(): Promise<string>;
    /**
     * This function shall return a list of one or more UTXOs (unspent transaction outputs) controlled by the wallet that are required to reach AT LEAST the combined ADA value target specified in amount AND the best suitable to be used as collateral inputs for transactions with plutus script inputs (pure ADA-only UTXOs).
     *
     * If this cannot be attained, an error message with an explanation of the blocking problem shall be returned. NOTE: wallets are free to return UTXOs that add up to a greater total ADA value than requested in the amount parameter, but wallets must never return any result where UTXOs would sum up to a smaller total ADA value, instead in a case like that an error message must be returned.
     *
     * @param limit
     * @returns a list of UTXOs
     */
    getCollateral(): Promise<UTxO[]>;
    /**
     * Return a list of supported CIPs of the wallet.
     *
     * @returns a list of CIPs
     */
    getExtensions(): Promise<number[]>;
    /**
     * Returns the network ID of the currently connected account. 0 is testnet and 1 is mainnet but other networks can possibly be returned by wallets. Those other network ID values are not governed by CIP-30. This result will stay the same unless the connected account has changed.
     *
     * @returns network ID
     */
    getNetworkId(): Promise<number>;
    /**
     * Returns a list of reward addresses owned by the wallet. A reward address is a stake address that is used to receive rewards from staking, generally starts from `stake` prefix.
     *
     * @returns a list of reward addresses
     */
    getRewardAddresses(): Promise<string[]>;
    /**
     * Returns a list of unused addresses controlled by the wallet.
     *
     * @returns a list of unused addresses
     */
    getUnusedAddresses(): Promise<string[]>;
    /**
     * Returns a list of used addresses controlled by the wallet.
     *
     * @returns a list of used addresses
     */
    getUsedAddresses(): Promise<string[]>;
    /**
     * Return a list of all UTXOs (unspent transaction outputs) controlled by the wallet.
     *
     * @returns a list of UTXOs
     */
    getUtxos(): Promise<UTxO[]>;
    /**
     * This endpoint utilizes the [CIP-8 - Message Signing](https://cips.cardano.org/cips/cip8/) to sign arbitrary data, to verify the data was signed by the owner of the private key.
     *
     * @param payload - the data to be signed
     * @param address - optional, if not provided, the first staking address will be used
     * @returns a signature
     */
    signData(payload: string, address?: string): Promise<DataSignature>;
    /**
     * Requests user to sign the provided transaction (tx). The wallet should ask the user for permission, and if given, try to sign the supplied body and return a signed transaction. partialSign should be true if the transaction provided requires multiple signatures.
     *
     * @param unsignedTx - a transaction in CBOR
     * @param partialSign - if the transaction is signed partially
     * @returns a signed transaction in CBOR
     */
    signTx(unsignedTx: string, partialSign?: boolean): Promise<string>;
    /**
     * Experimental feature - sign multiple transactions at once (Supported wallet(s): Typhon)
     *
     * @param unsignedTxs - array of unsigned transactions in CborHex string
     * @param partialSign - if the transactions are signed partially
     * @returns array of signed transactions CborHex string
     */
    signTxs(unsignedTxs: string[], partialSign?: boolean): Promise<string[]>;
    /**
     * Submits the signed transaction to the blockchain network.
     *
     * As wallets should already have this ability to submit transaction, we allow dApps to request that a transaction be sent through it. If the wallet accepts the transaction and tries to send it, it shall return the transaction ID for the dApp to track. The wallet can return error messages or failure if there was an error in sending it.
     *
     * @param tx
     * @returns a transaction hash
     */
    submitTx(tx: string): Promise<string>;
    /**
     * Get a used address of type Address from the wallet.
     *
     * This is used in transaction building.
     *
     * @returns an Address object
     */
    getUsedAddress(): Promise<Address>;
    /**
     * Get a list of UTXOs to be used as collateral inputs for transactions with plutus script inputs.
     *
     * This is used in transaction building.
     *
     * @returns a list of UTXOs
     */
    getCollateralUnspentOutput(limit?: number): Promise<TransactionUnspentOutput[]>;
    /**
     * Get a list of UTXOs to be used for transaction building.
     *
     * This is used in transaction building.
     *
     * @returns a list of UTXOs
     */
    getUsedUTxOs(): Promise<TransactionUnspentOutput[]>;
    /**
     * A helper function to get the assets in the wallet.
     *
     * @returns a list of assets
     */
    getAssets(): Promise<AssetExtended[]>;
    /**
     * A helper function to get the lovelace balance in the wallet.
     *
     * @returns lovelace balance
     */
    getLovelace(): Promise<string>;
    /**
     * A helper function to get the assets of a specific policy ID in the wallet.
     *
     * @param policyId
     * @returns a list of assets
     */
    getPolicyIdAssets(policyId: string): Promise<AssetExtended[]>;
    /**
     * A helper function to get the policy IDs of all the assets in the wallet.
     *
     * @returns a list of policy IDs
     */
    getPolicyIds(): Promise<string[]>;
    /**
     * The connected wallet account provides the account's public DRep Key, derivation as described in CIP-0105.
     * These are used by the client to identify the user's on-chain CIP-1694 interactions, i.e. if a user has registered to be a DRep.
     *
     * @returns wallet account's public DRep Key
     */
    getPubDRepKey(): Promise<{
        pubDRepKey: string;
        dRepIDHash: string;
        dRepIDBech32: string;
    } | undefined>;
    getRegisteredPubStakeKeys(): Promise<{
        pubStakeKeys: string[];
        pubStakeKeyHashes: string[];
    } | undefined>;
    getUnregisteredPubStakeKeys(): Promise<{
        pubStakeKeys: string[];
        pubStakeKeyHashes: string[];
    } | undefined>;
    private static dRepKeyToDRepID;
    private static resolveInstance;
    static addBrowserWitnesses(unsignedTx: string, witnesses: string): string;
    static getSupportedExtensions(wallet: string): {
        cip: number;
    }[];
}

type Account = {
    baseAddress: Address;
    enterpriseAddress: Address;
    rewardAddress: Address;
    baseAddressBech32: string;
    enterpriseAddressBech32: string;
    rewardAddressBech32: string;
    paymentKey: StricaPrivateKey;
    stakeKey: StricaPrivateKey;
    paymentKeyHex: string;
    stakeKeyHex: string;
    pubDRepKey?: string;
    dRepIDBech32?: DRepID;
    dRepIDHash?: Ed25519KeyHashHex;
};
type EmbeddedWalletKeyType = {
    type: "root";
    bech32: string;
} | {
    type: "cli";
    payment: string;
    stake?: string;
} | {
    type: "mnemonic";
    words: string[];
};
type CreateEmbeddedWalletOptions = {
    networkId: number;
    key: EmbeddedWalletKeyType;
};
declare class WalletStaticMethods {
    static privateKeyToEntropy(bech32: string): string;
    static mnemonicToEntropy(words: string[]): string;
    static signingKeyToEntropy(paymentKey: string, stakeKey: string): [string, string];
    static getAddresses(paymentKey: StricaPrivateKey, stakingKey: StricaPrivateKey, networkId?: number): {
        baseAddress: Address;
        enterpriseAddress: Address;
        rewardAddress: Address;
    };
    static getDRepKey(dRepKey: StricaPrivateKey, networkId?: number): {
        pubDRepKey: string;
        dRepIDBech32: DRepID;
        dRepIDHash: Ed25519KeyHashHex;
    };
    static generateMnemonic(strength?: number): string[];
    static addWitnessSets(txHex: string, witnesses: VkeyWitness[]): string;
}
declare class EmbeddedWallet extends WalletStaticMethods {
    private readonly _entropy?;
    private readonly _networkId;
    constructor(options: CreateEmbeddedWalletOptions);
    getAccount(accountIndex?: number, keyIndex?: number): Account;
    getNetworkId(): number;
    signData(address: string, payload: string, accountIndex?: number, keyIndex?: number): DataSignature;
    signTx(unsignedTx: string, accountIndex?: number, keyIndex?: number): VkeyWitness;
}

type CreateMeshWalletOptions = {
    networkId: 0 | 1;
    fetcher?: IFetcher;
    submitter?: ISubmitter;
    key: {
        type: "root";
        bech32: string;
    } | {
        type: "cli";
        payment: string;
        stake?: string;
    } | {
        type: "mnemonic";
        words: string[];
    } | {
        type: "address";
        address: string;
    };
    accountIndex?: number;
    keyIndex?: number;
};
/**
 * Mesh Wallet provides a set of APIs to interact with the blockchain. This wallet is compatible with Mesh transaction builders.
 *
 * There are 4 types of keys that can be used to create a wallet:
 * - root: A private key in bech32 format, generally starts with `xprv1`
 * - cli: CLI generated keys starts with `5820`. Payment key is required, and the stake key is optional.
 * - mnemonic: A list of 24 words
 * - address: A bech32 address that can be used to create a read-only wallet, generally starts with `addr` or `addr_test1`
 *
 * ```javascript
 * import { MeshWallet, BlockfrostProvider } from '@meshsdk/core';
 *
 * const blockchainProvider = new BlockfrostProvider('<BLOCKFROST_API_KEY>');
 *
 * const wallet = new MeshWallet({
 *   networkId: 0,
 *   fetcher: blockchainProvider,
 *   submitter: blockchainProvider,
 *   key: {
 *     type: 'mnemonic',
 *     words: ["solution","solution","solution","solution","solution",","solution","solution","solution","solution","solution","solution","solution","solution","solution","solution","solution","solution","solution","solution","solution","solution","solution","solution"],
 *   },
 * });
 * ```
 */
declare class MeshWallet implements IInitiator, ISigner, ISubmitter {
    private readonly _wallet;
    private readonly _accountIndex;
    private readonly _keyIndex;
    private readonly _fetcher?;
    private readonly _submitter?;
    private readonly _networkId;
    addresses: {
        baseAddress?: Address;
        enterpriseAddress?: Address;
        rewardAddress?: Address;
        baseAddressBech32?: string;
        enterpriseAddressBech32?: string;
        rewardAddressBech32?: string;
        pubDRepKey?: string;
        dRepIDBech32?: DRepID;
        dRepIDHash?: Ed25519KeyHashHex;
    };
    constructor(options: CreateMeshWalletOptions);
    /**
     * Returns a list of assets in the wallet. This API will return every assets in the wallet. Each asset is an object with the following properties:
     * - A unit is provided to display asset's name on the user interface.
     * - A quantity is provided to display asset's quantity on the user interface.
     *
     * @returns a list of assets and their quantities
     */
    getBalance(): Promise<Asset[]>;
    /**
     * Returns an address owned by the wallet that should be used as a change address to return leftover assets during transaction creation back to the connected wallet.
     *
     * @returns an address
     */
    getChangeAddress(): string;
    /**
     * This function shall return a list of one or more UTXOs (unspent transaction outputs) controlled by the wallet that are required to reach AT LEAST the combined ADA value target specified in amount AND the best suitable to be used as collateral inputs for transactions with plutus script inputs (pure ADA-only UTXOs).
     *
     * If this cannot be attained, an error message with an explanation of the blocking problem shall be returned. NOTE: wallets are free to return UTXOs that add up to a greater total ADA value than requested in the amount parameter, but wallets must never return any result where UTXOs would sum up to a smaller total ADA value, instead in a case like that an error message must be returned.
     *
     * @param addressType - the type of address to fetch UTXOs from (default: payment)
     * @returns a list of UTXOs
     */
    getCollateral(addressType?: GetAddressType): Promise<UTxO[]>;
    /**
     * Get a list of UTXOs to be used as collateral inputs for transactions with plutus script inputs.
     *
     * This is used in transaction building.
     *
     * @param addressType - the type of address to fetch UTXOs from (default: payment)
     * @returns a list of UTXOs
     */
    getCollateralUnspentOutput(addressType?: GetAddressType): Promise<TransactionUnspentOutput[]>;
    /**
     * Returns the network ID of the currently connected account. 0 is testnet and 1 is mainnet but other networks can possibly be returned by wallets. Those other network ID values are not governed by CIP-30. This result will stay the same unless the connected account has changed.
     *
     * @returns network ID
     */
    getNetworkId(): number;
    /**
     * Returns a list of reward addresses owned by the wallet. A reward address is a stake address that is used to receive rewards from staking, generally starts from `stake` prefix.
     *
     * @returns a list of reward addresses
     */
    getRewardAddresses(): string[];
    /**
     * Returns a list of unused addresses controlled by the wallet.
     *
     * @returns a list of unused addresses
     */
    getUnusedAddresses(): string[];
    /**
     * Returns a list of used addresses controlled by the wallet.
     *
     * @returns a list of used addresses
     */
    getUsedAddresses(): string[];
    /**
     * Get a list of UTXOs to be used for transaction building.
     *
     * This is used in transaction building.
     *
     * @param addressType - the type of address to fetch UTXOs from (default: payment)
     * @returns a list of UTXOs
     */
    getUsedUTxOs(addressType?: GetAddressType): Promise<TransactionUnspentOutput[]>;
    /**
     * Return a list of all UTXOs (unspent transaction outputs) controlled by the wallet.
     *
     * @param addressType - the type of address to fetch UTXOs from (default: payment)
     * @returns a list of UTXOs
     */
    getUtxos(addressType?: GetAddressType): Promise<UTxO[]>;
    /**
     * This endpoint utilizes the [CIP-8 - Message Signing](https://cips.cardano.org/cips/cip8/) to sign arbitrary data, to verify the data was signed by the owner of the private key.
     *
     * @param payload - the payload to sign
     * @param address - the address to use for signing (optional)
     * @returns a signature
     */
    signData(payload: string, address?: string): DataSignature;
    /**
     * Requests user to sign the provided transaction (tx). The wallet should ask the user for permission, and if given, try to sign the supplied body and return a signed transaction. partialSign should be true if the transaction provided requires multiple signatures.
     *
     * @param unsignedTx - a transaction in CBOR
     * @param partialSign - if the transaction is partially signed (default: false)
     * @returns a signed transaction in CBOR
     */
    signTx(unsignedTx: string, partialSign?: boolean): string;
    /**
     * Experimental feature - sign multiple transactions at once.
     *
     * @param unsignedTxs - array of unsigned transactions in CborHex string
     * @param partialSign - if the transactions are signed partially
     * @returns array of signed transactions CborHex string
     */
    signTxs(unsignedTxs: string[], partialSign?: boolean): string[];
    /**
     * Submits the signed transaction to the blockchain network.
     *
     * As wallets should already have this ability to submit transaction, we allow dApps to request that a transaction be sent through it. If the wallet accepts the transaction and tries to send it, it shall return the transaction ID for the dApp to track. The wallet can return error messages or failure if there was an error in sending it.
     *
     * @param tx - a signed transaction in CBOR
     * @returns a transaction hash
     */
    submitTx(tx: string): Promise<string>;
    /**
     * Get a used address of type Address from the wallet.
     *
     * This is used in transaction building.
     *
     * @param addressType - the type of address to fetch UTXOs from (default: payment)
     * @returns an Address object
     */
    getUsedAddress(addressType?: GetAddressType): Address;
    /**
     * Get a list of UTXOs to be used for transaction building.
     *
     * This is used in transaction building.
     *
     * @param addressType - the type of address to fetch UTXOs from (default: payment)
     * @returns a list of UTXOs
     */
    getUnspentOutputs(addressType?: GetAddressType): Promise<TransactionUnspentOutput[]>;
    /**
     * A helper function to get the assets in the wallet.
     *
     * @returns a list of assets
     */
    getAssets(): Promise<AssetExtended[]>;
    /**
     * A helper function to get the lovelace balance in the wallet.
     *
     * @returns lovelace balance
     */
    getLovelace(): Promise<string>;
    /**
     * A helper function to get the assets of a specific policy ID in the wallet.
     *
     * @param policyId
     * @returns a list of assets
     */
    getPolicyIdAssets(policyId: string): Promise<AssetExtended[]>;
    /**
     * A helper function to get the policy IDs of all the assets in the wallet.
     *
     * @returns a list of policy IDs
     */
    getPolicyIds(): Promise<string[]>;
    /**
     * A helper function to create a collateral input for a transaction.
     *
     * @returns a transaction hash
     */
    createCollateral(): Promise<string>;
    getPubDRepKey(): {
        pubDRepKey: string | undefined;
        dRepIDBech32: string | undefined;
        dRepIDHash: string | undefined;
    };
    /**
     * Generate mnemonic or private key
     *
     * @param privateKey return private key if true
     * @returns a transaction hash
     */
    static brew(privateKey?: boolean, strength?: number): string[] | string;
    private getAddressesFromWallet;
    private buildAddressFromBech32Address;
}

export { type Account, AppWallet, type AppWalletKeyType, BrowserWallet, type CreateAppWalletOptions, type CreateEmbeddedWalletOptions, type CreateMeshWalletOptions, EmbeddedWallet, type EmbeddedWalletKeyType, MeshWallet, WalletStaticMethods };
