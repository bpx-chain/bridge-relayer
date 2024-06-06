import {
    createLightNode,
    waitForRemotePeer,
    createEncoder,
    createDecoder,
    utf8ToBytes
} from '@bpx-chain/synapse-sdk';
import {
    singleShardInfosToShardInfo,
    singleShardInfoToPubsubTopic
} from '@bpx-chain/synapse-utils';

import Log from './Log.js';

export default class Synapse {
    constructor() {
        this.log = new Log('Synapse');
        
        this.synapse = null;
        this.pubsubTopic = null;
    }
    
    async start() {
        try {
            this.log.info('Connecting to Synapse P2P network...');
            
            const singleShardInfo = {
                clusterId: 279,
                shard: 0
            };
            const shardInfo = singleShardInfosToShardInfo([singleShardInfo]);
            this.pubsubTopic = singleShardInfoToPubsubTopic(singleShardInfo);
            
            this.synapse = await createLightNode({
                bootstrapPeers: [
                    '/dns4/synapse1.mainnet.bpxchain.cc/tcp/8000/wss/p2p/16Uiu2HAm55qUe3BFd2fA6UE6uWb38ByEck1KdfJ271S3ULSqa2iu',
                    '/dns4/synapse2.mainnet.bpxchain.cc/tcp/8000/wss/p2p/16Uiu2HAmQ3HRNNo6ESF5jW6VBLkrcZ8ECoZ2guGwdmZVZDsksvmP'
                ],
                shardInfo
            });
            await this.synapse.start();
            await waitForRemotePeer(this.synapse);
            
            this.log.info('Connected to Synapse');
            return true;
        } catch(e) {
            this.log.error('Synapse error: ' + e.message);
            return false;
        }
    }
    
    async retryMessageCallback(msgRaw) {
        try {
            if(!msgRaw.payload)
                throw new Error('Message does not contain a payload');
            
            const msg = JSON.parse(new TextDecoder().decode(msgRaw.payload));
            
            if(typeof msg.messageHash != 'string')
                throw new Error('Invalid JSON message structure');
            
            if(!msg.messageHash.match(/^0x[0-9a-fA-F]{64}$/))
                throw new Error('Validation error: messageHash');
            
            //
        }
        catch(e) {
            this.log.warn('Exception in retry request processing: ' + e.message);
        }
    }
    
    async subscribeRetry(srcChainId, dstChainId, walletAddress) {
        const retryContentTopic = '/bridge/1/retry-' + srcChainId + '-' + dstChainId
                + '-' + walletAddress.toLowerCase() + '/json';
        const decoder = createDecoder(
            retryContentTopic,
            this.pubsubTopic
        );
        
        await this.synapse.filter.subscribe(
            [decoder],
            (msg) => { this.retryMessageCallback(msg) }
        );
        
        this.log.info('Subscribed to retry topic: ' + retryContentTopic);
    }
}