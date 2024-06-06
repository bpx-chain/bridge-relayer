import { ethers } from 'ethers';

import { chainName, bridgeContracts } from './configs/chains.js';
import { abiBridge } from './configs/abiBridge.js';
import timestampToEpoch from './utils/timestampToEpoch.js';

export default class Chain {
    constructor(rpc) {
        this.rpc = rpc;
        this.chainId = null;
        this.chainName = null;
        this.contract = null;
        this.listenerBlock = null;
        this.listenerEpoch = null;
        
        if(rpc.startsWith('ws'))
            this.provider = new ethers.WebSocketProvider(rpc);
        else
            this.provider = new ethers.JsonRpcProvider(rpc);
    }
    
    async start() {
        this.log.info('Connecting to RPC: ' + this.rpc);
        try {
            this.chainId = parseInt((await this.provider.getNetwork()).chainId);
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
        
        this.log.info('Bridge contract: ' + bridgeContracts[this.chainId]);
        this.contract = new ethers.Contract(
            bridgeContracts[this.chainId],
            abiBridge,
            this.provider
        );
        
        return true;
    }
    
    async getBlock(blockTag) {
        while(true) {
            try {
                return await this.provider.getBlock(blockTag);
            }
            catch(e) {
                this.log.warn('Failed to get block: ' + e.message);
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }
    
    async syncFetchEventsBatch(filter, startBlock, endBlock) {
        try {
            return await this.contract.queryFilter(
                filter,
                startBlock,
                endBlock
            );
        }
        catch(e) {
            this.log.warn(
                'Failed to fetch events batch ' + startBlock + '-' + endBlock + ': ' + e.message
            );
            await new Promise(r => setTimeout(r, 3000));
        }
    }
    
    async syncForward(database, signer, filter, fromBlock, toBlock, listener = false) {
        if(!listener) this.log.info(
            'Starting forward sync from block ' + fromBlock + ' to block ' + toBlock
        );
            
        let startBlock = fromBlock;
        let logTimestamp = Date.now();
        
        while(true) {
            const endBlock = Math.min(startBlock + 999, toBlock);
            
            const events = await this.syncFetchEventsBatch(filter, startBlock, endBlock);
            
            for(const event of events)
                await this.messageCallback(database, signer, event, null);
            
            await database.setSyncStateForward(this.chainId, endBlock);
            
            if(!listener && Date.now() - logTimestamp > 15000) {
                const perc = Math.round(
                    (endBlock - fromBlock)
                    / (toBlock - fromBlock)
                    * 100
                );
                this.log.info(
                    'Forward syncing in progress: ' + perc + '% [' + (toBlock - endBlock) + ' blocks behind]'
                );
                logTimestamp = Date.now();
            }
            
            if(endBlock == toBlock)
                break;
            startBlock = endBlock + 1;
        }
        
        if(!listener) this.log.info('Forward sync done');
    }
    
    async syncBackward(database, signer, filter, fromBlock, toEpoch) {
        this.log.info(
            'Starting backward sync from block ' + fromBlock + ' to epoch ' + toEpoch
        );
        
        let endBlock = null;
        let logTimestamp = Date.now();
        let latestSyncedEpoch = null;
        
        while(true) {
            endBlock = endBlock ? endBlock - 1000 : fromBlock;
            const startBlock = endBlock - 999;
            
            const events = await this.syncFetchEventsBatch(filter, startBlock, endBlock);
            
            for(const event of events.reverse()) {
                const eventEpoch = timestampToEpoch((await this.getBlock(event.blockNumber)).timestamp);
                if(eventEpoch < toEpoch)
                    break;
                
                await this.messageCallback(database, signer, event, eventEpoch);
            }
            
            const oldestSyncedEpoch = timestampToEpoch((await this.getBlock(startBlock)).timestamp) + 1;
            await database.setSyncStateBackward(
                this.chainId,
                {
                    oldestEpoch: Math.max(oldestSyncedEpoch, toEpoch),
                    oldestBlock: startBlock,
                    latestBlock: fromBlock
                }
            );
            
            if(!latestSyncedEpoch)
                latestSyncedEpoch = oldestSyncedEpoch;
            if(Date.now() - logTimestamp > 15000) {
                const perc = Math.round(
                    (oldestSyncedEpoch - latestSyncedEpoch)
                    / (toEpoch - latestSyncedEpoch)
                    * 100
                );
                this.log.info(
                    'Backward syncing in progress: ' + perc + '% [epoch ' + oldestSyncedEpoch + ' -> ' + toEpoch + ']'
                );
                logTimestamp = Date.now();
            }
            
            if(oldestSyncedEpoch <= toEpoch)
                break;
        }
        
        this.log.info('Backward sync done');
    }
    
    async sync(database, signer, actEpoch, oppositeChainId) {
        const syncState = await database.getSyncState(this.chainId);
        const currentBlock = (await this.getBlock('latest')).number;
        let syncRanges = [];
        
        if(!syncState)
            syncRanges.push({
                order: 'backward',
                fromBlock: currentBlock,
                toEpoch: actEpoch
            });
        else {
            if(syncState.oldestEpoch != actEpoch)
                syncRanges.push({
                    order: 'backward',
                    fromBlock: syncState.oldestBlock - 1,
                    toEpoch: actEpoch
                });
            if(syncState.latestBlock != currentBlock)
                syncRanges.push({
                    order: 'forward',
                    fromBlock: syncState.latestBlock + 1,
                    toBlock: currentBlock
                });
        }
        
        for(const range of syncRanges)
            if(range.order == 'forward')
                await this.syncForward(database, signer, this.getFilter(oppositeChainId), range.fromBlock, range.toBlock);
            else
                await this.syncBackward(database, signer, this.getFilter(oppositeChainId), range.fromBlock, range.toEpoch);
        
        this.log.info('Chain sync done');
    }
    
    async listener(database, filter, epochUpdateCallback) {
        const block = await this.getBlock('latest');
        
        if(!this.listenerBlock || block.number > this.listenerBlock) {
            const epoch = timestampToEpoch(block.timestamp);
            const epochUpdate = epoch != this.listenerEpoch;
            if(epochUpdate)
                this.listenerEpoch = epoch;
            
            await this.syncForward(
                database,
                filter,
                this.listenerBlock || (await database.getSyncState(this.chainId)).latestBlock + 1,
                block.number,
                true
            );
            this.listenerBlock = block.number;
            
            if(epochUpdateCallback && epochUpdate)
                epochUpdateCallback(epoch);
        }
        
        setTimeout(() => { this.listener(database, filter, epochUpdateCallback) }, 5000);
    }
    
    async startListener(database, oppositeChainId, epochUpdateCallback = null) {
        await this.listener(database, this.getFilter(oppositeChainId), epochUpdateCallback);
        this.log.info('Started listening for new messages');
    }
}