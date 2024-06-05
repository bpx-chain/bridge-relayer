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
    
    async start(srcChainId, dstChainId, walletAddress) {
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
}