import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

import Log from './Log.js';

export default class Database {
    constructor() {
        this.log = new Log('Database');
        this.db = null;
    }
    
    async start(srcChainId, dstChainId, walletAddress) {
        try {
            this.db = await open({
                filename: './db_' + walletAddress + '_' + srcChainId + '-' + dstChainId + '.sqlite',
                driver: sqlite3.Database
            });
            
            await this.db.exec(
                `CREATE TABLE IF NOT EXISTS sync(
                    chainId INT NOT NULL PRIMARY KEY,
                    oldestEpoch INT NOT NULL,
                    oldestBlock INT NOT NULL,
                    latestBlock INT NOT NULL
                )`
            );
            await this.db.exec(
                `CREATE TABLE IF NOT EXISTS messages(
                    messageHash BLOB NOT NULL PRIMARY KEY,
                    executed TINYINT NOT NULL,
                    userWallet VARCHAR(42),
                    epoch INT
                )`
            );
            
            this.log.info('Database initialized');
            return true;
        }
        catch(e) {
            this.log.error('SQLite error: ' + e.message);
            return false;
        }
    }
    
    async getSyncState(chainId) {
        return await this.db.get(
            `SELECT oldestEpoch, oldestBlock, latestBlock
            FROM sync
            WHERE chainId = ?`,
            chainId
        );
    }
    
    async setSyncStateForward(chainId, latestBlock) {
        await this.db.run(
            `UPDATE sync
            SET latestBlock = ?
            WHERE chainId = ?`,
            latestBlock,
            chainId
        );
    }
    
    async setSyncStateBackward(chainId, syncState) {
        const result = await this.db.run(
            `INSERT OR IGNORE INTO sync(chainId, oldestEpoch, oldestBlock, latestBlock)
            VALUES(?, ?, ?, ?)`,
            chainId,
            syncState.oldestEpoch,
            syncState.oldestBlock,
            syncState.latestBlock
        );
        if(!result.changes)
            await this.db.run(
                `UPDATE sync
                SET oldestEpoch = ?,
                oldestBlock = ?
                WHERE chainId = ?`,
                syncState.oldestEpoch,
                syncState.oldestBlock,
                chainId
            );
    }
    
    async getMessage(messageHash) {
        return await this.db.get(
            `SELECT *
            FROM messages
            WHERE messageHash = ?`,
            Buffer.from(messageHash.substring(2), 'hex')
        );
    }
    
    async getValidMessages(minEpoch) {
        return (await this.db.all(
            `SELECT messageHash, userWallet
            FROM messages
            WHERE executed = 0
            AND epoch >= ?
            `,
            minEpoch
        )).map((row) => ({
            messageHash: '0x' + Buffer.from(row.messageHash).toString('hex'),
            userWallet: row.userWallet
        }));
    }
    
    async insertMessageSrcChain(messageHash, userWallet, epoch) {
        await this.db.run(
            `INSERT OR IGNORE INTO messages(messageHash, executed, userWallet, epoch)
            VALUES(?, 0, ?, ?)`,
            Buffer.from(messageHash.substring(2), 'hex'),
            userWallet,
            epoch
        );
    }
    
    async insertMessageDstChain(messageHash) {
        await this.db.run(
            `INSERT OR REPLACE INTO messages(messageHash, executed, userWallet, epoch)
            VALUES(?, 1, NULL, NULL)`,
            Buffer.from(messageHash.substring(2), 'hex')
        );
    }
}