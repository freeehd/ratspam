/**
 * app/api/iplookup/route.ts
 * API route to perform IP lookup for multiple IPs using SpamRATS all.spamrats.com
 */
import { NextResponse } from 'next/server';
import { promises as dns } from 'dns';

interface ListStatus {
  list: string;
  status: string;
}

interface StandardsCompliance {
  reverseHostname: string;
  namingConvention: string;
}

interface IPLookupResponse {
  ip: string;
  standardsCompliance: StandardsCompliance;
  listStatuses: ListStatus[];
}

async function iplookup(ip: string): Promise<IPLookupResponse> {
  let reversePassed = false;
  let conventionPassed = false;
  let hostnames: string[] = [];

  try {
    hostnames = await dns.reverse(ip);
    reversePassed = true;
    for (const hostname of hostnames) {
      try {
        const addresses = await dns.resolve4(hostname);
        if (addresses.includes(ip)) {
          conventionPassed = true;
          break;
        }
      } catch (err) {
        // Ignore hostname resolution errors
      }
    }
  } catch (err) {
    // No reverse DNS record
  }

  const parts = ip.split('.').reverse();
  const queryDomain = parts.join('.') + '.all.spamrats.com';
  let listedCodes: string[] = [];

  try {
    const addresses = await dns.resolve4(queryDomain);
    listedCodes = addresses.map(addr => addr.split('.').pop() || '');
  } catch (err) {
    // IP not listed or DNS error
  }

  const listMapping: Record<string, string> = {
    '36': 'RATS-Dyna',
    '37': 'RATS-NoPtr',
    '38': 'RATS-Spam',
    '43': 'RATS-Auth'
  };

  const allLists = ['RATS-Dyna', 'RATS-NoPtr', 'RATS-Spam', 'RATS-Auth'];

  const listStatuses: ListStatus[] = allLists.map(list => {
    const code = Object.entries(listMapping).find(([k, v]) => v === list)?.[0];
    return {
      list,
      status: code && listedCodes.includes(code) ? 'On the list' : 'Not on the list'
    };
  });

  return {
    ip,
    standardsCompliance: {
      reverseHostname: reversePassed ? 'Passed!' : 'Failed!',
      namingConvention: conventionPassed ? 'Passed!' : 'Failed!'
    },
    listStatuses
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ips } = body;

    if (!ips || !Array.isArray(ips) || ips.length === 0) {
      return NextResponse.json({ error: 'Array of IP addresses is required' }, { status: 400 });
    }

    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    const invalidIps = ips.filter((ip: string) => !ipRegex.test(ip));
    if (invalidIps.length > 0) {
      return NextResponse.json({ error: `Invalid IP addresses: ${invalidIps.join(', ')}` }, { status: 400 });
    }

    const results = await Promise.all(ips.map((ip: string) => iplookup(ip)));
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}