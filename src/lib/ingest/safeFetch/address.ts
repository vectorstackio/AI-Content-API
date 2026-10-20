import { BlockList, isIP } from 'node:net'

const blockedV4 = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) {
  blockedV4.addSubnet(address, prefix, 'ipv4')
}
// Azure's platform virtual IP also exposes infrastructure/metadata services.
blockedV4.addAddress('168.63.129.16', 'ipv4')

const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
const blockedV6 = new BlockList()
for (const [address, prefix] of [
  ['2001::', 23], // Special-purpose space, including Teredo and benchmarking.
  ['2001:db8::', 32], ['2002::', 16], // Documentation and 6to4.
  ['3fff::', 20], // Documentation.
] as const) {
  blockedV6.addSubnet(address, prefix, 'ipv6')
}

/** Conservative public-unicast policy; mapped/translated IPv4 is not accepted. */
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) return !blockedV4.check(address, 'ipv4')
  if (isIP(address) === 6) {
    return globalV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6')
  }
  return false
}
