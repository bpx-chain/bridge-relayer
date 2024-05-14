import { Command } from 'commander';
import chalk from 'chalk';
import { ethers } from 'ethers';

const bridgeContracts = {
    '279':       '0x53fa3006A40AA0Cb697736819485cE6D30DEAEb5', // BPX
    '137':       '0x5CD1A383d9C881577dDF6E5E092Db25b2D50e9B3', // Polygon
};

const chainName = {
    '279':       'BPX Chain',
    '137':       'Polygon',
};

const abi = [
    "event MessageCreated(uint256 chainId, address from, bytes message)",
    "event MessageProcessed(uint256 chainId, bytes32 messageHash)",
    "function assetResolve(uint256 chainId, address contractLocal) view returns (address)",
    "function processMessage(bytes message, tuple(uint8 v, bytes32 r, bytes32 s)[8] signatures, uint64 sigEpoch) payable",
    "function relayerActivate(uint256 chainId) payable",
    "function relayerCheckMessage(uint256 chainId, bytes32 messageHash) view returns (bool)",
    "function relayerDeactivate(uint256 chainId)",
    "function relayerGetBalance(uint256 chainId, address relayerAddr) view returns (uint256)",
    "function relayerGetStake(address relayerAddr) view returns (uint256)",
    "function relayerGetStatus(uint256 chainId, address relayerAddr) view returns (bool, uint64)",
    "function relayerGetWithdrawalMax(uint256 chainId, address relayerAddr) view returns (uint256)",
    "function relayerWithdraw(uint256 chainId, address to, uint256 value)",
    "function setOwner(address _owner)",
    "function transfer(uint256 dstChainId, address dstAddress) payable",
    "function transferERC20(address srcContract, uint256 dstChainId, address dstAddress, uint256 value)"
];

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
        try {
            this.log('info', 'Relayer is starting...');
            
            const srcChainId = (await this.srcProvider.getNetwork()).chainId;
            if(typeof(chainName[srcChainId]) == 'undefined')
                throw new Error('Unsupported source chain: ' + srcChainId);
            this.log('info', 'Source chain: ' + chainName[srcChainId]);
            
            const dstChainId = (await this.dstProvider.getNetwork()).chainId;
            if(typeof(chainName[dstChainId]) == 'undefined')
                throw new Error('Unsupported destination chain: ' + dstChainId);
            this.log('info', 'Destination chain: ' + chainName[dstChainId]);
            
            if(srcChainId == dstChainId)
                throw new Error('Both chains have the same chainId');
            if(srcChainId != 279 && dstChainId != 279)
                throw new Error('Neither the source nor destination chain is BPX');
            
            const srcContractAddr = bridgeContracts[srcChainId];
            this.log('info', 'Source contract: ' + srcContractAddr);
            
            const dstContractAddr = bridgeContracts[dstChainId];
            this.log('info', 'Destination contract: ' + dstContractAddr);
            
            this.log('info', 'Relayer wallet: ' + this.wallet.address);
            
            this.srcContract = new ethers.Contract(srcContractAddr, abi, this.srcProvider);
            this.dstContract = new ethers.Contract(dstContractAddr, abi, this.dstProvider);
            const dstStatus = await this.dstContract.relayerGetStatus(srcChainId, this.wallet.address);
            if(dstStatus[0] == false)
                throw new Error('Relayer is inactive since epoch ' + dstStatus[1]);
            this.log('info', 'Relayer is active since epoch ' + dstStatus[1]);
            
            const block = await this.srcProvider.getBlock('latest');
            if(!block)
                throw new Error('Cannot get latest block from source chain');
            const epoch = this.timestampToEpoch(block.timestamp);
            this.log('info', 'Current epoch is ' + epoch);
            
            //this.handleNewEpoch(epoch);
            
            
            /*this.srcProvider.on("block", async function(blockNumber) {
                let block = await th.srcProvider.getBlock(blockNumber);
                console.log(block);
                let currentEpoch = 
                if(currentEpoch != th.epoch)
                    th.newEpoch(currentEpoch);
            });*/
        } catch(e) {
            this.log('error', e.message);
            process.exit(1);
        }
    }
    
    timestampToEpoch(timestamp) {
        return Math.floor(timestamp / 60 / 20); // 20 minutes
    }
    
    handleNewEpoch(epoch) {
        console.log('New epoch: ' + epoch);
        this.epoch = epoch;
    }
    
    log(level, msg) {
        let levelText;
        switch(level) {
            case 'error':
                levelText = chalk.red('[Error]');
                break;
            case 'warn':
                levelText = chalk.yellow('[Warn] ');
                break;
            default:
                levelText = chalk.green('[Info] ');
                break;
        }
        console.log(new Date().toLocaleString() + '  ' + levelText + '  ' + msg);
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