import Chain from './Chain.js';

export default class DstChain extends Chain {
    constructor(rpc) {
        super('dst', rpc);
        
        this.relayerStatus = null;
        this.relayerStatusEpoch = null;
    }
    
    async start(srcChainId, walletAddress) {
        await super.start();
        
        try {
            const relayerStatus = await this.contract.relayerGetStatus(
                srcChainId,
                walletAddress
            );
            this.relayerStatus = relayerStatus[0];
            this.relayerStatusEpoch = parseInt(relayerStatus[1]) + 1;
            
            if(!this.relayerStatus) {
                this.log.error('Relayer inactive since epoch ' + this.relayerStatusEpoch);
                return false;
            }
            
            this.log.info('Relayer active since epoch ' + this.relayerStatusEpoch);
            return true;
        }
        catch(e) {
            this.log.error('RPC error: ' + e.message);
            return false;
        }
    }
    
    async sync(database, actEpoch, oppositeChainId) {
        return await this._sync(
            database,
            actEpoch,
            this.contract.filters.MessageProcessed(oppositeChainId),
            async function(event, eventEpoch) {
                await database.insertMessageDstChain(event.args[1]);
            }
        );
    }
}