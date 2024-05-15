import { Command } from 'commander';
import chalk from 'chalk';
import { ethers } from 'ethers';
import {
    waitForRemotePeer,
    createLightNode,
    createEncoder,
    utf8ToBytes,
    Decoder
} from '@waku/sdk';
import {
  singleShardInfosToShardInfo,
  singleShardInfoToPubsubTopic
} from '@waku/utils';

const bridgeContracts = {
    '279':       '0x53fa3006A40AA0Cb697736819485cE6D30DEAEb5', // BPX
    '137':       '0x5CD1A383d9C881577dDF6E5E092Db25b2D50e9B3', // Polygon
};

const chainName = {
    '279':       'BPX Chain',
    '137':       'Polygon',
};

const abi = [
  "event MessageCreated(uint256 indexed chainId, address indexed from, bytes message)",
  "event MessageProcessed(uint256 indexed chainId, bytes32 messageHash)",
  "function assetResolve(uint256 chainId, address contractLocal) view returns (address)",
  "function messageCheckSignatures(uint256 chainId, bytes32 messageHash, tuple(uint8 v, bytes32 r, bytes32 s)[8] signatures, uint64 sigEpoch) view returns (address[8])",
  "function messageGetRelayers(uint256 chainId, bytes32 messageHash, uint64 epoch) view returns (address[8])",
  "function messageProcess(bytes message, tuple(uint8 v, bytes32 r, bytes32 s)[8] signatures, uint64 sigEpoch) payable",
  "function relayerActivate(uint256 chainId) payable",
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
        this.epoch = 0; 
    }
    
    async run() {
        const th = this;
        
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
            const relayerStatus = await this.dstContract.relayerGetStatus(srcChainId, this.wallet.address);
            if(relayerStatus[0] == false)
                throw new Error('Relayer inactive since epoch ' + relayerStatus[1]);
            this.log('info', 'Relayer active since epoch ' + relayerStatus[1]);
            
            this.log('info', 'Connecting to Synapse P2P network...');
            const singleShardInfo = {
                clusterId: 279,
                shard: 0
            };
            const shardInfo = singleShardInfosToShardInfo([singleShardInfo]);
            
            const synapse = await createLightNode({
                bootstrapPeers: [
                    '/dns4/synapse1.mainnet.bpxchain.cc/tcp/8000/wss/p2p/16Uiu2HAm55qUe3BFd2fA6UE6uWb38ByEck1KdfJ271S3ULSqa2iu'
                ],
                shardInfo: shardInfo
            });
            await synapse.start();
            await waitForRemotePeer(synapse);
            this.log('info', 'Connected to Synapse');
            
            const retryContentTopic = '/bridge/1/retry-' + srcChainId + '-' + dstChainId
                + '-' + this.wallet.address + '/json';
            const decoder = new Decoder(
                singleShardInfoToPubsubTopic(singleShardInfo),
                retryContentTopic
            );
            const subscription = await synapse.filter.createSubscription(
                singleShardInfo
            );
            await subscription.subscribe(
                [decoder],
                function(msg) {
                    th.onSynapseRetryMessage(msg);
                }
            );
            this.log('info', 'Subscribed to content topic: ' + retryContentTopic);
            
            const block = await this.dstProvider.getBlock('latest');
            if(!block)
                throw new Error('Cannot get latest destination chain block');
            this.onDstNewBlock(block);
            
            this.dstProvider.on("block", async function(blockNumber) {
                const block = await th.dstProvider.getBlock(blockNumber);
                th.onDstNewBlock(block);
            });
            this.log('info', 'Subscribed to epoch updates');
            
            this.srcContract.on(
                this.srcContract.filters.MessageCreated(dstChainId),
                function(chainId, from, message) {
                    th.onSrcNewMessage(from, message);
                }
            );
            this.log('info', 'Subscribed to source contract events');
        } catch(e) {
            this.log('error', e.message);
            process.exit(1);
        }
    }
    
    timestampToEpoch(timestamp) {
        return Math.floor(timestamp / 60 / 20); // 20 minutes
    }
    
    onDstNewBlock(block) {
        const newEpoch = this.timestampToEpoch(block.timestamp);
        if(newEpoch <= this.epoch)
            return;
        
        this.epoch = newEpoch;
        this.log('info', 'New epoch: ' + newEpoch);
    }
    
    async onSrcNewMessage(from, message) {
        console.log('new msg');
        
        /*const encoder = createEncoder({
              contentTopic: '/bridge/1/',
              pubsubTopic: singleShardInfoToPubsubTopic(singleShardInfo)
            });
            
            const request = await node.lightPush.send(encoder, {
              payload: utf8ToBytes(text)
            });*/
    }
    
    async onSynapseRetryMessage(msg) {
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