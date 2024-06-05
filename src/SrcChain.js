import Chain from './Chain.js';

export default class SrcChain extends Chain {
    constructor(rpc) {
        super('src', rpc);
    }
}