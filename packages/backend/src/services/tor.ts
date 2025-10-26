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
      // Check for both SERVICE1 (backend) and SERVICE2 (web app) .onion addresses
      const service1File = path.join(config.tor.hiddenServiceDir, 'service1', 'hostname');
      const service2File = path.join(config.tor.hiddenServiceDir, 'service2', 'hostname');
      const legacyFile = path.join(config.tor.hiddenServiceDir, 'hostname');

      logger.info(`Checking for .onion addresses...`);

      const checkAndDisplay = () => {
        let backendOnion = '';
        let webOnion = '';

        // Try service1/hostname (multi-service setup)
        if (fs.existsSync(service1File)) {
          backendOnion = fs.readFileSync(service1File, 'utf8').trim();
        }
        // Fallback to legacy location
        else if (fs.existsSync(legacyFile)) {
          backendOnion = fs.readFileSync(legacyFile, 'utf8').trim();
        }

        // Check for web app .onion
        if (fs.existsSync(service2File)) {
          webOnion = fs.readFileSync(service2File, 'utf8').trim();
        }

        if (backendOnion || webOnion) {
          this.hiddenServiceHostname = backendOnion;

          logger.info(`╔════════════════════════════════════════════════════════════════════╗`);
          logger.info(`║                  TOR HIDDEN SERVICES ACTIVE                        ║`);
          logger.info(`╠════════════════════════════════════════════════════════════════════╣`);
          if (backendOnion) {
            logger.info(`║  Backend API:  http://${backendOnion.padEnd(48)} ║`);
          }
          if (webOnion) {
            logger.info(`║  Web App:      http://${webOnion.padEnd(48)} ║`);
          }
          logger.info(`╠════════════════════════════════════════════════════════════════════╣`);
          logger.info(`║  Regular Access:  http://localhost:5173 (web)                     ║`);
          logger.info(`║                   http://localhost:3000 (api)                      ║`);
          logger.info(`╠════════════════════════════════════════════════════════════════════╣`);
          logger.info(`║  Use Tor Browser for .onion addresses for full anonymity          ║`);
          logger.info(`║  Regular browsers work too - messages always encrypted!           ║`);
          logger.info(`╚════════════════════════════════════════════════════════════════════╝`);
          return true;
        }
        return false;
      };

      // Try immediately
      if (checkAndDisplay()) {
        return;
      }

      // If not found, retry periodically
      logger.info('Waiting for Tor to generate .onion addresses...');
      let attempts = 0;
      const maxAttempts = 12;
      const retryInterval = setInterval(() => {
        attempts++;
        if (checkAndDisplay()) {
          clearInterval(retryInterval);
        } else if (attempts >= maxAttempts) {
          logger.warn('Could not find .onion addresses after 60 seconds');
          logger.info('This may be normal if using a different Tor configuration');
          clearInterval(retryInterval);
        }
      }, 5000);
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
