
            
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
        
    }
    