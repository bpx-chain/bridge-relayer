import { ethers } from 'ethers';

import Log from './Log.js';

export default class Signer {
    constructor() {
        this.log = new Log('Signer');
        
        this.wallet = null;
        this.database = null;
        this.srcChainId = null;
        this.dstChain = null;
        this.synapse = null;
    }
    
    async start(wallet, database, srcChainId, dstChain, synapse) {
        this.wallet = wallet;
        this.database = database;
        this.srcChainId = srcChainId;
        this.dstChain = dstChain;
        this.synapse = synapse;
        
        this.log.info('Started signer');
    }
    
    async maybeSign(messageHash, userWallet, sigEpoch = null) {
        if(!sigEpoch)
            sigEpoch = this.dstChain.listenerEpoch;
        
        if(!this.dstChain.checkOnRelayersList(
            this.wallet.address,
            this.srcChainId,
            messageHash,
            sigEpoch
        ))
            return;
        
        this.log.info('Delegated to sign message ' + messageHash + ' in epoch ' + sigEpoch);
        
        const epochHash = ethers.solidityPackedKeccak256(
            ['bytes32', 'uint64'],
            [messageHash, sigEpoch]
        );
        this.log.info('Calculated epoch hash for message ' + messageHash + ': ' + epochHash);
        
        const sig = await this.wallet.signEpochHash(epochHash);
        this.log.info('Signed message ' + messageHash);
        
        this.synapse.sendSignature(userWallet, messageHash, sigEpoch, sig);
    }
    
    async autoRetry(epoch) {
        this.log.info('Retrying recent not processed messages');
        
        const messages = await this.database.getValidMessages(epoch - 2);
        this.log.info('Got ' + messages.length + ' messages for auto retry');
        
        for(const message of messages)
            await this.maybeSign(message.messageHash, message.userWallet);
        
        this.log.info('All auto retries done');
    }
}