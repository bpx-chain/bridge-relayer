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
    
    async messageCallback(database, event, eventEpoch) {
        if(!eventEpoch)
            eventEpoch = timestampToEpoch((await this.getBlock(event.blockNumber)).timestamp);
        
        await database.insertMessageSrcChain(
            ethers.keccak256(event.args[2]),
            eventEpoch
        );
        
        if(this.listenerEpoch && this.listenerEpoch - eventEpoch <= 3)
            await this.maybeSignMessage(event);
    }
}