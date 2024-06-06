import { ethers } from 'ethers';

import Log from './Log.js';

export default class Wallet {
    constructor(walletKey) {
        this.log = new Log('Wallet');
        
        this.walletKey = walletKey;
        this.wallet = null;
        this.address = null;
    }
    
    start() {
        try {
            this.wallet = new ethers.Wallet(this.walletKey);
            this.address = this.wallet.address;
            
            this.log.info('Initialized wallet: ' + this.address);
            return true;
        }
        catch(e) {
            this.log.error('Invalid wallet key: ' + e.message);
            return false;
        }
    }
    
    async signEpochHash(epochHash) {
        return ethers.Signature.from(
            await this.wallet.signMessage(ethers.getBytes(epochHash))
        );
    }
}