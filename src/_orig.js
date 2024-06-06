
            
            const retryContentTopic = '/bridge/1/retry-' + this.srcChainId + '-' + dstChainId
                + '-' + this.wallet.address.toLowerCase() + '/json';
            const decoder = createDecoder(
                retryContentTopic,
                this.pubsubTopic
            );
            const subscription = await this.synapse.filter.subscribe(
                [decoder],
                function(msg) {
                    th.onSynapseRetryMessage(msg);
                }
            );
            this.log('info', 'Subscribed to retry topic: ' + retryContentTopic);
            
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
   
    
    onDstNewBlock(block) {
    console.log(block);
        const newEpoch = this.timestampToEpoch(block.timestamp);
        if(newEpoch <= this.epoch)
            return;
        
        this.epoch = newEpoch;
        this.log('info', 'New epoch: ' + newEpoch);
    }
    
    async onSrcNewMessage(from, message) {
        try {
            this.log('info', 'New message from ' + from + ': ' + message);
            
            const messageHash = ethers.keccak256(message);
            this.log('info', 'Message hash: ' + messageHash);
            
            const relayers = await this.dstContract.messageGetRelayers(
                this.srcChainId,
                messageHash,
                this.epoch
            );
            this.log('info', 'Selected relayers: ' + relayers);
            
            if(!relayers.includes(this.wallet.address)) {
                this.log('info', 'Ignoring message - not on selected relayers list');
                return;
            }
            
            const epochHash = ethers.solidityPackedKeccak256(
                ['bytes32', 'uint64'],
                [messageHash, this.epoch]
            );
            this.log('info', 'Epoch hash: ' + epochHash);
            
            const sig = ethers.Signature.from(
                await this.wallet.signMessage(ethers.getBytes(epochHash))
            );
            
            const response = {
                messageHash: messageHash,
                epoch: this.epoch,
                v: sig.v,
                r: sig.r,
                s: sig.s,
                debug_relayer: this.wallet.address,
                debug_relayerIndex: relayers.indexOf(this.wallet.address)
            };
            
            const encoder = createEncoder({
                contentTopic: '/bridge/1/client-' + from.toLowerCase() + '/json',
                pubsubTopic: this.pubsubTopic
            });
            const result = await this.synapse.lightPush.send(encoder, {
                payload: utf8ToBytes(JSON.stringify(response))
            });
            if(!result.successes.length)
                throw new Error('Failed to push message');
            this.log('info', 'Signature published');
        }
        catch(e) {
            this.log('error', 'Exception in message processing: ' + e.message);
            setTimeout(() => { this.onSrcNewMessage(from, message) }, 3000);
        }
    }
    
    async onSynapseRetryMessage(msgRaw) {
        let msg;
        
        try {
            const msg = JSON.parse(new TextDecoder().decode(msgRaw.payload));
            
            if(typeof msg.transactionHash != 'string')
                throw new Error('Invalid JSON message structure');
            
            if(!msg.transactionHash.match(/^0x[0-9a-fA-F]{64}$/))
                throw new Error('Validation error: transactionHash');
            
            let receipt;
            try {
                receipt = await this.srcProvider.getTransactionReceipt(msg.txid);
            } catch(e) {
                setTimeout(() => { this.onSynapseRetryMessage(msgRaw) }, 3000);
                throw e;
            }
        
            if(receipt === null)
                throw new Error('Transaction receipt is null');
            
            console.log(receipt);
        }
        catch(e) {
            this.log('error', 'Exception in retry request processing: ' + e.message);
        }
    }
    