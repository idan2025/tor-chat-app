FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    tor \
    && rm -rf /var/lib/apt/lists/*

# Copy Tor configuration
COPY torrc /etc/tor/torrc

# Create hidden service directory with correct ownership
RUN mkdir -p /var/lib/tor/hidden_service/service1 && \
    chown -R debian-tor:debian-tor /var/lib/tor/hidden_service && \
    chmod 700 /var/lib/tor/hidden_service /var/lib/tor/hidden_service/service1

USER debian-tor

CMD ["tor", "-f", "/etc/tor/torrc"]
