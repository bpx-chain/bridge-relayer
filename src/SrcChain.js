import { ethers } from 'ethers';

import Chain from './Chain.js';
import Log from './Log.js';

export default class SrcChain extends Chain {
    constructor(rpc) {
        super(rpc);
        
        this.log = new Log('SrcChain');
    }
    
    getFilter(oppositeChainId) {
        return this.contract.filters.MessageCreated(oppositeChainId);
    }
    
    async messageCallback(database, signer, event, eventEpoch) {
        if(!eventEpoch)
            eventEpoch = timestampToEpoch((await this.getBlock(event.blockNumber)).timestamp);
        
        const messageHash = ethers.keccak256(event.args[2]);
        
        await database.insertMessageSrcChain(
            messageHash,
            event.args[1],
            eventEpoch
        );
        
        if(this.listenerEpoch && this.listenerEpoch - eventEpoch <= 2)
            await signer.maybeSign(messageHash, event.args[1]);
    }
}