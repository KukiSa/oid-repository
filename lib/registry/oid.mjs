export function compareOid(left, right) {
    const a = left.split('.').map(BigInt)
    const b = right.split('.').map(BigInt)
    for (let index = 0; index < Math.max(a.length, b.length); index++) {
        if (a[index] === undefined) return -1
        if (b[index] === undefined) return 1
        if (a[index] < b[index]) return -1
        if (a[index] > b[index]) return 1
    }
    return 0
}
