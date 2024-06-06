import { ethers } from 'ethers';

import Chain from './Chain.js';

export default class SrcChain extends Chain {
    constructor(rpc) {
        super('src', rpc);
    }
    
    async sync(database, actEpoch, oppositeChainId) {
        const th = this;
        
        return await this._sync(
            database,
            actEpoch,
            this.contract.filters.MessageCreated(oppositeChainId),
            async function(event, eventEpoch) {
                await database.insertMessageSrcChain(
                    ethers.keccak256(event.args[2]),
                    eventEpoch || timestampToEpoch((await th.getBlock(event.blockNumber)).timestamp)
                );
            }
        );
    }
}