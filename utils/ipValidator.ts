// utils/ipValidator.ts
export function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  return ipv4Regex.test(ip);
}