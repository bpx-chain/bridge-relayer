import Log from './Log.js';
import SrcChain from './SrcChain.js';
import DstChain from './DstChain.js';
import Wallet from './Wallet.js';
import Synapse from './Synapse.js';
import Database from './Database.js';
import { homeChainId } from './configs/chains.js';

export default class App {
    constructor(options) {
        this.log = new Log('App');
        
        this.srcChain = new SrcChain(options.srcRpc);
        this.dstChain = new DstChain(options.dstRpc);
        this.wallet = new Wallet(options.walletKey);
        this.synapse = new Synapse();
        this.database = new Database();
    }
    
    async run() {
        this.log.info('App is starting');
        
        if(!this.wallet.start())
            process.exit(1);
        
        if(!await this.srcChain.start())
            process.exit(2);
        
        if(!await this.dstChain.start())
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
        
        if(!await this.synapse.start(this.srcChain.chainId, this.dstChain.chainId, this.wallet.address))
            process.exit(6);
        
        if(!await this.database.start(this.srcChain.chainId, this.dstChain.chainId, this.wallet.address))
            process.exit(7);
    }
}