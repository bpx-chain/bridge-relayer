import Log from './Log.js';
import SrcChain from './SrcChain.js';
import DstChain from './DstChain.js';
import Wallet from './Wallet.js';
import Synapse from './Synapse.js';
import Database from './Database.js';
import Signer from './Signer.js';
import { homeChainId } from './configs/chains.js';

export default class App {
    constructor(options) {
        this.log = new Log('App');
        
        this.srcChain = new SrcChain(options.srcRpc);
        this.dstChain = new DstChain(options.dstRpc);
        this.wallet = new Wallet(options.walletKey);
        this.synapse = new Synapse();
        this.database = new Database();
        this.signer = new Signer();
    }
    
    async run() {
        this.log.info('App is starting');
        
        if(!this.wallet.start())
            process.exit(1);
        
        if(!await this.srcChain.start())
            process.exit(2);
        
        if(!await this.dstChain.start(this.srcChain.chainId, this.wallet.address))
            process.exit(3);
        
        if(this.srcChain.chainId == this.dstChain.chainId) {
            this.log.error('Both chains are the same');
            process.exit(4);
        }
        
        if(this.srcChain.chainId != homeChainId && this.dstChain.chainId != homeChainId) {
            this.log.error('Neither the source nor destination chain is BPX');
            process.exit(5);
        }
        
        this.log.info('Initialized both chains');
        
        if(!await this.synapse.start())
            process.exit(6);
        
        if(!await this.database.start(this.srcChain.chainId, this.dstChain.chainId, this.wallet.address))
            process.exit(7);
        
        this.signer.start(this.wallet, this.database, this.srcChain.chainId, this.dstChain, this.synapse);
        
        await Promise.all([
            this.srcChain.sync(this.database, this.signer, this.dstChain.relayerStatusEpoch, this.dstChain.chainId),
            this.dstChain.sync(this.database, this.signer, this.dstChain.relayerStatusEpoch, this.srcChain.chainId)
        ]);
        this.log.info('Both chains synced');
        
        await this.srcChain.startListener(this.database, this.dstChain.chainId);
        await this.dstChain.startListener(this.database, this.srcChain.chainId, (epoch) => { this.signer.autoRetry(epoch) });
        
        this.synapse.subscribeRetry(this.srcChain.chainId, this.dstChain.chainId, this.wallet.address, this.database, this.signer);
    }
}