import sqlite3 from 'sqlite3';

import Log from './Log.js';

export default class Database {
    constructor() {
        this.log = new Log('Database');
        this.db = null;
    }
    
    async start(srcChainId, dstChainId, walletAddress) {
        try {
            await new Promise((resolve, reject) => {
                this.db = new sqlite3.Database(
                    './db_' + walletAddress + '_' + srcChainId + '-' + dstChainId + '.sqlite',
                    (error) => {
                        error ? reject(error) : resolve();
                    }
                );
            });
            this.log.info('Database initialized');
            return true;
        }
        catch(e) {
            this.log.error('SQLite error: ' + e.message);
            return false;
        }
    }
}