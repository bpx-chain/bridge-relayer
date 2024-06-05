import { ethers } from 'ethers';

import Log from './Log.js';
import { chainName, bridgeContracts } from './configs/chains.js';

export default class Chain {
    constructor(instanceId, rpc) {
        this.log = new Log('Chain:' + instanceId);
        
        this.rpc = rpc;
        this.chainId = null;
        this.chainName = null;
        this.contract = null;
        
        if(rpc.startsWith('ws'))
            this.provider = new ethers.WebSocketProvider(rpc);
        else
            this.provider = new ethers.JsonRpcProvider(rpc);
    }
    
    async start() {
        this.log.info('Connecting to RPC: ' + this.rpc);
        try {
            this.chainId = (await this.provider.getNetwork()).chainId;
        }
        catch(e) {
            this.log.error('RPC error: ' + e.message);
            return false;
        }
        this.log.info('Connected. ChainId = ' + this.chainId);
        
        if(typeof chainName[this.chainId] == 'undefined') {
            this.log.error('Unsupported chainId = ' + this.chainId);
            return false;
        }
        
        this.chainName = chainName[this.chainId];
        this.log.info('Detected chain: ' + this.chainName);
        
        this.contract = bridgeContracts[this.chainId];
        this.log.info('Bridge contract: ' + this.contract);
        
        return true;
    }
}