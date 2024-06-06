import Chain from './Chain.js';

export default class SrcChain extends Chain {
    constructor(rpc) {
        super('src', rpc);
    }
    
    async sync(database, actEpoch, oppositeChainId) {
        return await this._sync(
            database,
            actEpoch,
            this.contract.filters.MessageCreated(oppositeChainId),
            function() {}
        );
    }
}