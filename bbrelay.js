const { Command } = require('commander');
const { ethers } = require('ethers');

const bridgeContracts = {
    '279':       'a', // BPX
    '1':         'b', // Ethereum
    '728126428': 'c'  // Tron
};

class App {
    constructor(options) {
        this.wallet = new ethers.Wallet(options.walletKey);
        this.srcProvider = new ethers.JsonRpcProvider(options.srcRpc);
        this.dstProvider = new ethers.JsonRpcProvider(options.dstRpc);
        
        this.srcContract = null;
        this.dstContract = null;
        this.epoch = null;
    }
    
    async run() {
        const th = this;
        
        const srcChainId = (await this.srcProvider.getNetwork()).chainId;
        const dstChainId = (await this.dstProvider.getNetwork()).chainId;
        
        if(srcChainId != 279 && dstChainId != 279)
            throw new Error('Neither the source nor destination chain is BPX');
        
        this.srcContract = bridgeContracts[srcChainId];
        this.dstContract = bridgeContracts[dstChainId];
        
        const block = await this.srcProvider.getBlock('latest');
        if(!block)
            throw new Error('Cannot get latest block');
        this.handleNewEpoch(
            this.timestampToEpoch(block.timestamp)
        );
        
        
        /*this.srcProvider.on("block", async function(blockNumber) {
            let block = await th.srcProvider.getBlock(blockNumber);
            console.log(block);
            let currentEpoch = 
            if(currentEpoch != th.epoch)
                th.newEpoch(currentEpoch);
        });*/
    }
    
    timestampToEpoch(timestamp) {
        return Math.floor(timestamp / 60 / 20); // 20 minutes
    }
    
    handleNewEpoch(epoch) {
        console.log('New epoch: ' + epoch);
        this.epoch = epoch;
    }
}

const program = new Command();
program
  .name('bbrelay')
  .description('BPX Bridge relayer')
  .requiredOption('-s, --src-rpc <url>', 'Source chain RPC URL')
  .requiredOption('-d, --dst-rpc <url>', 'Destination chain RPC URL')
  .requiredOption('-k, --wallet-key <key>', 'Relayer wallet private key')
  .parse();
    
const app = new App(program.opts());
app.run();