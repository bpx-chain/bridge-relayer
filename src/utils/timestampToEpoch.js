export default function timestampToEpoch(timestamp) {
    return Math.floor(timestamp / 60 / 20); // 20 minutes
}