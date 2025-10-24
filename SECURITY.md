# Security Policy

## Security Features

TOR Chat implements multiple layers of security:

### 1. End-to-End Encryption (E2EE)

- **Algorithm**: ChaCha20-Poly1305 via libsodium
- **Key Exchange**: X25519 (Elliptic Curve Diffie-Hellman)
- **Authentication**: Poly1305 MAC
- **Room Encryption**: AES-256-GCM (symmetric)

All messages are encrypted on the client side before transmission. The server never has access to unencrypted message content.

### 2. TOR Integration

- All traffic can be routed through the TOR network
- Backend can run as a TOR hidden service (.onion)
- No IP address logging
- Censorship-resistant communication

### 3. Authentication & Authorization

- **Password Hashing**: bcrypt with 12 rounds
- **JWT Tokens**: Secure token-based authentication
- **Session Management**: Short-lived tokens with refresh capability
- **Rate Limiting**: Protection against brute force attacks

### 4. Transport Security

- HTTPS/TLS 1.3 for production deployments
- WebSocket Secure (WSS) for real-time communication
- Strict CORS policy
- Security headers (CSP, X-Frame-Options, etc.)

### 5. Database Security

- Prepared statements (SQL injection prevention)
- Encrypted password storage
- No plain-text sensitive data
- Regular security audits

## Security Best Practices

### For Users

1. **Strong Passwords**
   - Minimum 12 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Use a password manager
   - Never reuse passwords

2. **Verify .onion Address**
   - Always verify the .onion address through a trusted channel
   - Bookmark the correct address
   - Watch for phishing attempts

3. **Keep Software Updated**
   - Update desktop/mobile apps regularly
   - Update TOR browser
   - Enable auto-updates when possible

4. **Device Security**
   - Use full-disk encryption
   - Lock your device when not in use
   - Use biometric authentication where available

### For Administrators

1. **Change Default Credentials**
   ```bash
   # Generate strong JWT secret
   openssl rand -base64 48
   ```

2. **Use Environment Variables**
   - Never commit `.env` files
   - Use secrets management (Vault, AWS Secrets Manager)
   - Rotate secrets regularly

3. **Enable HTTPS**
   ```bash
   # Get free SSL certificate
   sudo certbot --nginx -d yourdomain.com
   ```

4. **Configure Firewall**
   ```bash
   # Allow only necessary ports
   ufw allow 22/tcp   # SSH
   ufw allow 80/tcp   # HTTP
   ufw allow 443/tcp  # HTTPS
   ufw enable
   ```

5. **Regular Backups**
   ```bash
   # Automated daily backups
   0 2 * * * /opt/backup-script.sh
   ```

6. **Monitor Logs**
   ```bash
   # Set up log monitoring
   tail -f /var/log/torchat/*.log | grep -i error
   ```

7. **Database Security**
   ```sql
   -- Restrict database user permissions
   REVOKE ALL ON DATABASE torchat FROM PUBLIC;
   GRANT CONNECT ON DATABASE torchat TO toruser;
   ```

8. **Update Dependencies**
   ```bash
   # Regular security updates
   npm audit fix
   npm update
   ```

## Threat Model

### What TOR Chat Protects Against

✅ **Network Surveillance**
- TOR routing hides IP addresses
- E2EE prevents content inspection

✅ **Man-in-the-Middle Attacks**
- TLS/SSL encryption
- Certificate pinning (optional)

✅ **Server Compromise**
- E2EE ensures server can't read messages
- Minimal data retention

✅ **Password Attacks**
- Strong bcrypt hashing
- Rate limiting on login attempts

### What TOR Chat Does NOT Protect Against

❌ **Compromised Endpoints**
- If user's device is compromised, messages can be read
- Keyloggers can capture passwords

❌ **Social Engineering**
- Users can be tricked into revealing information
- Phishing attacks on credentials

❌ **Metadata Analysis**
- TOR provides anonymity, not invisibility
- Traffic patterns may be analyzed

❌ **Quantum Computing (Future)**
- Current encryption may be vulnerable to future quantum computers
- Plan for post-quantum cryptography migration

## Vulnerability Reporting

### Responsible Disclosure

We take security vulnerabilities seriously. If you discover a security issue:

1. **Do NOT** create a public GitHub issue
2. **Do NOT** disclose the vulnerability publicly
3. **Do** email security details to: security@example.com
4. **Do** allow us 90 days to address the issue

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information

### Response Timeline

- **24 hours**: Initial response acknowledging receipt
- **7 days**: Assessment and severity classification
- **30-90 days**: Fix development and testing
- **After fix**: Public disclosure and credit (if desired)

## Security Checklist

### Pre-Deployment

- [ ] All dependencies updated to latest versions
- [ ] Security audit completed (`npm audit`)
- [ ] Environment variables configured securely
- [ ] Strong JWT_SECRET generated (min 32 characters)
- [ ] Database credentials changed from defaults
- [ ] TOR properly configured
- [ ] HTTPS/SSL certificates installed
- [ ] Firewall rules configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers implemented
- [ ] Logging and monitoring configured
- [ ] Backup system in place

### Post-Deployment

- [ ] Regular security updates scheduled
- [ ] Log monitoring active
- [ ] Backup verification working
- [ ] Incident response plan documented
- [ ] Access control reviewed
- [ ] Security testing performed
- [ ] Documentation updated

## Known Limitations

1. **WebRTC Leaks**: Disable WebRTC in browser for full anonymity
2. **DNS Leaks**: Use TOR's DNS resolver
3. **Browser Fingerprinting**: Use TOR Browser for best anonymity
4. **Timing Attacks**: Large-scale adversaries may correlate traffic patterns

## Compliance

TOR Chat is designed with privacy in mind, but administrators are responsible for:

- GDPR compliance (if applicable)
- Data retention policies
- User consent management
- Legal jurisdiction requirements

## Additional Resources

- **TOR Project**: https://www.torproject.org/
- **libsodium**: https://doc.libsodium.org/
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Security Headers**: https://securityheaders.com/

## Security Updates

We recommend subscribing to:
- GitHub Security Advisories
- Node.js Security Releases
- PostgreSQL Security
- TOR Project announcements

## Contact

For security concerns: security@example.com

For general questions: support@example.com

---

**Last Updated**: 2024-10-24

**Security Version**: 1.0.0
