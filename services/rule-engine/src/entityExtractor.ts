export class EntityExtractor {
  extractFromEvents(events: any[]): {
    hosts: string[];
    users: string[];
    ips: string[];
  } {
    const hosts = new Set<string>();
    const users = new Set<string>();
    const ips = new Set<string>();

    for (const event of events) {
      const payload = event.payload || {};

      // Extract hosts
      if (payload.host) hosts.add(payload.host);
      if (payload.hostname) hosts.add(payload.hostname);
      if (payload['host.name']) hosts.add(payload['host.name']);

      // Extract users
      if (payload.user) users.add(payload.user);
      if (payload.username) users.add(payload.username);
      if (payload['user.name']) users.add(payload['user.name']);

      // Extract IPs
      if (payload.ip_address) ips.add(payload.ip_address);
      if (payload.src_ip) ips.add(payload.src_ip);
      if (payload.dest_ip) ips.add(payload.dest_ip);
      if (payload['source.ip']) ips.add(payload['source.ip']);
      if (payload['destination.ip']) ips.add(payload['destination.ip']);
      if (payload['client.ip']) ips.add(payload['client.ip']);
    }

    return {
      hosts: Array.from(hosts),
      users: Array.from(users),
      ips: Array.from(ips),
    };
  }
}
