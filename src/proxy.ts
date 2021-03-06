
import * as dns from 'dns';
import { request } from 'http';
import { SocksClient } from 'socks';
import { FileSystemConfig } from './manager';
import { toPromise } from './toPromise';

function validateConfig(config: FileSystemConfig) {
  if (!config.proxy) throw new Error(`Missing field 'config.proxy'`);
  if (!config.proxy.host) throw new Error(`Missing field 'config.proxy.host'`);
  if (!config.proxy.port) throw new Error(`Missing field 'config.proxy.port'`);
  if (!config.proxy.type) throw new Error(`Missing field 'config.proxy.type'`);
}

export async function socks(config: FileSystemConfig): Promise<NodeJS.ReadableStream> {
  validateConfig(config);
  if (config.proxy!.type !== 'socks4' && config.proxy!.type !== 'socks5') {
    throw new Error(`Expected 'config.proxy.type' to be 'socks4' or 'socks5'`);
  }
  try {
    const ipaddress = (await toPromise<string[]>(cb => dns.resolve(config.proxy!.host, cb)))[0];
    if (!ipaddress) throw new Error(`Couldn't resolve '${config.proxy!.host}'`);
    const con = await SocksClient.createConnection({
      command: 'connect',
      destination: {
        host: config.host!,
        port: config.port!,
      },
      proxy: {
        ipaddress,
        port: config.proxy!.port,
        type: config.proxy!.type === 'socks4' ? 4 : 5,
      },
    });
    return con.socket as NodeJS.ReadableStream;
  } catch (e) {
    throw new Error(`Error while connecting to the the proxy: ${e.message}`);
  }
}

export function http(config: FileSystemConfig): Promise<NodeJS.ReadableStream> {
  validateConfig(config);
  return new Promise<NodeJS.ReadableStream>((resolve, reject) => {
    if (config.proxy!.type !== 'http') {
      reject(new Error(`Expected config.proxy.type' to be 'http'`));
    }
    try {
      const req = request({
        port: config.proxy!.port,
        hostname: config.proxy!.host,
        method: 'CONNECT',
        path: `${config.host}:${config.port}`,
      });
      req.end();
      req.on('connect', (res, socket) => {
        resolve(socket as NodeJS.ReadableStream);
      });
    } catch (e) {
      reject(new Error(`Error while connecting to the the proxy: ${e.message}`));
    }
  });
}
