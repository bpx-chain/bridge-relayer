export const abiBridge = [
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