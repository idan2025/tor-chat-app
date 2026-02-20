FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    tor \
    && rm -rf /var/lib/apt/lists/*

# Copy entrypoint that resolves Docker hostnames before starting Tor
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create hidden service directory with correct ownership
RUN mkdir -p /var/lib/tor/hidden_service/service1 && \
    chown -R debian-tor:debian-tor /var/lib/tor/hidden_service && \
    chmod 700 /var/lib/tor/hidden_service /var/lib/tor/hidden_service/service1

USER debian-tor

ENTRYPOINT ["/entrypoint.sh"]
