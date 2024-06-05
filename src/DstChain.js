import Chain from './Chain.js';

export default class DstChain extends Chain {
    constructor(rpc) {
        super('dst', rpc);
    }
}