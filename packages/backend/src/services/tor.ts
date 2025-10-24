import { SocksClient } from 'socks';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { config } from '../config';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * TOR service for routing traffic through TOR network
 */
export class TorService {
  private agent: SocksProxyAgent | null = null;
  private hiddenServiceHostname: string | null = null;

  constructor() {
    if (config.tor.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    try {
      // Create SOCKS proxy agent for TOR
      const proxyUrl = `socks5://${config.tor.socksHost}:${config.tor.socksPort}`;
      this.agent = new SocksProxyAgent(proxyUrl);
      logger.info('TOR SOCKS proxy agent initialized');

      // Read hidden service hostname if exists
      this.readHiddenServiceHostname();
    } catch (error) {
      logger.error('Failed to initialize TOR service:', error);
    }
  }

  /**
   * Get the SOCKS proxy agent for TOR
   */
  getAgent(): SocksProxyAgent | null {
    return this.agent;
  }

  /**
   * Check if TOR is available
   */
  async checkTorConnection(): Promise<boolean> {
    if (!config.tor.enabled) {
      return false;
    }

    try {
      const info = await SocksClient.createConnection({
        proxy: {
          host: config.tor.socksHost,
          port: config.tor.socksPort,
          type: 5,
        },
        command: 'connect',
        destination: {
          host: 'check.torproject.org',
          port: 80,
        },
        timeout: 10000,
      });

      info.socket.destroy();
      logger.info('TOR connection verified');
      return true;
    } catch (error) {
      logger.error('TOR connection check failed:', error);
      return false;
    }
  }

  /**
   * Read hidden service hostname from TOR directory
   */
  private readHiddenServiceHostname(): void {
    try {
      const hostnameFile = path.join(config.tor.hiddenServiceDir, 'hostname');
      if (fs.existsSync(hostnameFile)) {
        this.hiddenServiceHostname = fs.readFileSync(hostnameFile, 'utf8').trim();
        logger.info(`Hidden service available at: ${this.hiddenServiceHostname}`);
      } else {
        logger.warn('Hidden service hostname file not found');
      }
    } catch (error) {
      logger.error('Failed to read hidden service hostname:', error);
    }
  }

  /**
   * Get hidden service .onion address
   */
  getHiddenServiceAddress(): string | null {
    return this.hiddenServiceHostname;
  }

  /**
   * Setup hidden service configuration (for documentation)
   */
  getHiddenServiceConfig(): string {
    return `
# Add to /etc/tor/torrc:

HiddenServiceDir ${config.tor.hiddenServiceDir}
HiddenServicePort 80 127.0.0.1:${config.port}

# Then restart TOR:
# sudo systemctl restart tor

# Your .onion address will be in:
# ${config.tor.hiddenServiceDir}/hostname
    `.trim();
  }

  /**
   * Verify TOR circuit is established
   */
  async verifyCircuit(): Promise<boolean> {
    try {
      // Try to connect through TOR
      const isConnected = await this.checkTorConnection();
      if (isConnected) {
        logger.info('TOR circuit established successfully');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('TOR circuit verification failed:', error);
      return false;
    }
  }

  /**
   * Get TOR connection info
   */
  getConnectionInfo(): {
    enabled: boolean;
    socksHost: string;
    socksPort: number;
    hiddenService: string | null;
  } {
    return {
      enabled: config.tor.enabled,
      socksHost: config.tor.socksHost,
      socksPort: config.tor.socksPort,
      hiddenService: this.hiddenServiceHostname,
    };
  }
}

export const torService = new TorService();
