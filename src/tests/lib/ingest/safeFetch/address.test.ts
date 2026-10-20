import { describe, expect, it } from 'vitest'
import { isPublicAddress } from '@/lib/ingest/safeFetch/address'

describe('public destination policy', () => {
  it.each(['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111'])('allows %s', address => {
    expect(isPublicAddress(address)).toBe(true)
  })

  it.each([
    '127.0.0.1', '0.0.0.0', '10.1.2.3', '172.16.0.1', '172.31.255.255',
    '192.168.1.1', '100.64.0.1', '169.254.169.254', '169.254.170.2',
    '168.63.129.16', '192.0.0.1', '192.0.2.1', '198.18.0.1', '198.51.100.1',
    '203.0.113.1', '224.0.0.1', '255.255.255.255', '::', '::1', 'fc00::1',
    'fd00:ec2::254', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1',
    '::ffff:8.8.8.8', '64:ff9b::a00:1', '2001::1', '2001:db8::1',
    '2002:7f00:1::', '3fff::1', 'invalid',
  ])('blocks %s', address => {
    expect(isPublicAddress(address)).toBe(false)
  })
})
