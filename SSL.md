# TLS/HTTPS Configuration

GitLab MCP Server supports two approaches for secure HTTPS connections:

1. **Direct TLS Termination** - Server handles TLS with certificate files
2. **Reverse Proxy** - External proxy (nginx, Envoy, Caddy, Traefik) handles TLS

## Quick Reference

| Approach | Best For | HTTP/2 | Auto-Renewal |
|----------|----------|--------|--------------|
| Direct TLS | Development, simple deployments | No | Manual |
| Reverse Proxy | Production, enterprise | Yes | Yes (Let's Encrypt) |

---

## Option 1: Direct TLS Termination

The server can directly handle TLS/HTTPS using certificate files. This is suitable for simple deployments or development environments.

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SSL_CERT_PATH` | Path to PEM certificate file | Yes |
| `SSL_KEY_PATH` | Path to PEM private key file | Yes |
| `SSL_CA_PATH` | Path to CA certificate chain (for client cert validation) | No |
| `SSL_PASSPHRASE` | Passphrase for encrypted private keys | No |

### Example - Self-Signed Certificate (Development)

```bash
# Generate self-signed certificate (for testing only)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key -out server.crt \
  -subj "/CN=gitlab-mcp.local"
```

### Example - Direct HTTPS with Docker

```bash
docker run -d \
  -e PORT=3000 \
  -e SSL_CERT_PATH=/certs/server.crt \
  -e SSL_KEY_PATH=/certs/server.key \
  -e GITLAB_TOKEN=your_token \
  -e GITLAB_API_URL=https://gitlab.com \
  -v $(pwd)/certs:/certs:ro \
  -p 3000:3000 \
  ghcr.io/structured-world/gitlab-mcp:latest
```

### MCP Client Configuration (HTTPS)

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "streamable-http",
      "url": "https://your-server.com:3000/mcp"
    }
  }
}
```

---

## Option 2: Reverse Proxy (Recommended for Production)

For production deployments, use a reverse proxy to handle TLS termination. This provides:

- **HTTP/2 support** with proper ALPN negotiation
- **Automatic certificate renewal** (Let's Encrypt via Certbot, Caddy, etc.)
- **Load balancing** capabilities
- **Better security** (proxy filters traffic before reaching application)
- **Centralized TLS management** for multiple services

### Trust Proxy Configuration

When behind a reverse proxy, configure `TRUST_PROXY` to properly handle `X-Forwarded-*` headers:

| Variable | Description |
|----------|-------------|
| `TRUST_PROXY` | Enable Express trust proxy for X-Forwarded-* headers |

**Trust Proxy Values:**

| Value | Description |
|-------|-------------|
| `true` or `1` | Trust all proxies (use only if you control all proxies) |
| `false` or `0` | Disable trust proxy |
| `loopback` | Trust loopback addresses (127.0.0.1, ::1) |
| `linklocal` | Trust link-local addresses (169.254.0.0/16, fe80::/10) |
| `uniquelocal` | Trust unique-local addresses (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7) |
| Number (e.g., `1`) | Trust the nth hop from the front-facing proxy |
| IP addresses | Trust specific proxy IPs (comma-separated) |

---

## Nginx Configuration

Full nginx configuration with HTTP/2 and SSE support.

### nginx.conf

```nginx
upstream gitlab_mcp {
    server 127.0.0.1:3002;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name gitlab-mcp.example.com;

    # TLS configuration
    ssl_certificate /etc/letsencrypt/live/gitlab-mcp.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gitlab-mcp.example.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS (optional, recommended)
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Proxy settings for MCP
    location / {
        proxy_pass http://gitlab_mcp;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # SSE support (critical for MCP)
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        chunked_transfer_encoding off;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name gitlab-mcp.example.com;
    return 301 https://$server_name$request_uri;
}
```

### Docker Compose with Nginx

```yaml
version: '3.8'

services:
  gitlab-mcp:
    image: ghcr.io/structured-world/gitlab-mcp:latest
    environment:
      - PORT=3002
      - HOST=0.0.0.0
      - TRUST_PROXY=true
      - GITLAB_TOKEN=${GITLAB_TOKEN}
      - GITLAB_API_URL=https://gitlab.com
    expose:
      - "3002"
    networks:
      - internal

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/letsencrypt:ro
    depends_on:
      - gitlab-mcp
    networks:
      - internal

networks:
  internal:
```

---

## Envoy Configuration

Envoy proxy with HTTP/2 and TLS support.

### envoy.yaml

```yaml
static_resources:
  listeners:
    - name: listener_https
      address:
        socket_address:
          address: 0.0.0.0
          port_value: 443
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                stat_prefix: ingress_http
                codec_type: AUTO
                http2_protocol_options:
                  max_concurrent_streams: 100
                route_config:
                  name: local_route
                  virtual_hosts:
                    - name: gitlab_mcp
                      domains: ["*"]
                      routes:
                        - match:
                            prefix: "/"
                          route:
                            cluster: gitlab_mcp_cluster
                            timeout: 0s  # Disable timeout for SSE
                http_filters:
                  - name: envoy.filters.http.router
                    typed_config:
                      "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
          transport_socket:
            name: envoy.transport_sockets.tls
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
              common_tls_context:
                tls_certificates:
                  - certificate_chain:
                      filename: /etc/envoy/certs/server.crt
                    private_key:
                      filename: /etc/envoy/certs/server.key
                alpn_protocols: ["h2", "http/1.1"]

  clusters:
    - name: gitlab_mcp_cluster
      connect_timeout: 30s
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      load_assignment:
        cluster_name: gitlab_mcp_cluster
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: gitlab-mcp
                      port_value: 3002
```

### Docker Compose with Envoy

```yaml
version: '3.8'

services:
  gitlab-mcp:
    image: ghcr.io/structured-world/gitlab-mcp:latest
    environment:
      - PORT=3002
      - HOST=0.0.0.0
      - TRUST_PROXY=true
      - GITLAB_TOKEN=${GITLAB_TOKEN}
      - GITLAB_API_URL=https://gitlab.com
    expose:
      - "3002"
    networks:
      - internal

  envoy:
    image: envoyproxy/envoy:v1.28-latest
    ports:
      - "443:443"
    volumes:
      - ./envoy.yaml:/etc/envoy/envoy.yaml:ro
      - ./certs:/etc/envoy/certs:ro
    depends_on:
      - gitlab-mcp
    networks:
      - internal

networks:
  internal:
```

---

## Caddy Configuration

Caddy automatically obtains and renews TLS certificates via Let's Encrypt.

### Caddyfile

```
gitlab-mcp.example.com {
    reverse_proxy gitlab-mcp:3002 {
        flush_interval -1  # Required for SSE
    }
}
```

### Docker Compose with Caddy

```yaml
version: '3.8'

services:
  gitlab-mcp:
    image: ghcr.io/structured-world/gitlab-mcp:latest
    environment:
      - PORT=3002
      - HOST=0.0.0.0
      - TRUST_PROXY=true
      - GITLAB_TOKEN=${GITLAB_TOKEN}
      - GITLAB_API_URL=https://gitlab.com
    expose:
      - "3002"
    networks:
      - internal

  caddy:
    image: caddy:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
    depends_on:
      - gitlab-mcp
    networks:
      - internal

volumes:
  caddy_data:

networks:
  internal:
```

---

## Traefik Configuration

Traefik with automatic Let's Encrypt certificates.

### traefik.yml (Static Configuration)

```yaml
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"
    http2:
      maxConcurrentStreams: 250

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@example.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

### Dynamic Configuration (File or Labels)

```yaml
http:
  routers:
    gitlab-mcp:
      rule: "Host(`gitlab-mcp.example.com`)"
      entryPoints:
        - websecure
      service: gitlab-mcp
      tls:
        certResolver: letsencrypt

  services:
    gitlab-mcp:
      loadBalancer:
        servers:
          - url: "http://gitlab-mcp:3002"
```

### Docker Compose with Traefik

```yaml
version: '3.8'

services:
  gitlab-mcp:
    image: ghcr.io/structured-world/gitlab-mcp:latest
    environment:
      - PORT=3002
      - HOST=0.0.0.0
      - TRUST_PROXY=true
      - GITLAB_TOKEN=${GITLAB_TOKEN}
      - GITLAB_API_URL=https://gitlab.com
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.gitlab-mcp.rule=Host(`gitlab-mcp.example.com`)"
      - "traefik.http.routers.gitlab-mcp.entrypoints=websecure"
      - "traefik.http.routers.gitlab-mcp.tls.certresolver=letsencrypt"
      - "traefik.http.services.gitlab-mcp.loadbalancer.server.port=3002"
    networks:
      - internal

  traefik:
    image: traefik:v2.10
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./traefik.yml:/etc/traefik/traefik.yml:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
    networks:
      - internal

volumes:
  letsencrypt:

networks:
  internal:
```

---

## HTTP/2 Support

**HTTP/2 is best supported via reverse proxy** for several reasons:

| Feature | Direct TLS | Reverse Proxy |
|---------|-----------|---------------|
| HTTP/2 | Limited | Full support |
| ALPN Negotiation | Manual | Automatic |
| Connection Multiplexing | Basic | Optimized |
| HTTP/1.1 Fallback | Manual | Automatic |
| SSE Compatibility | Works | Works |

### Why Reverse Proxy for HTTP/2?

1. **ALPN Negotiation** - Reverse proxies handle HTTP/2 protocol negotiation properly
2. **Connection Multiplexing** - Proxies optimize HTTP/2 stream management
3. **Fallback Support** - Automatic fallback to HTTP/1.1 for incompatible clients
4. **SSE Compatibility** - Server-Sent Events work over HTTP/2 when properly configured

**Note:** Direct HTTP/2 support from Node.js Express requires additional setup and may have compatibility issues with some MCP clients. Using a reverse proxy is the recommended approach.

---

## Security Best Practices

### TLS Configuration

1. **Use TLS 1.2+ only** - Disable TLS 1.0 and 1.1
2. **Modern cipher suites** - Prefer ECDHE with AES-GCM
3. **Enable HSTS** - `Strict-Transport-Security` header
4. **Certificate chain** - Include full chain in certificate file

### Network Security

1. **Bind to localhost** when using reverse proxy - `HOST=127.0.0.1`
2. **Configure TRUST_PROXY correctly** - Only trust proxies you control
3. **Use firewall rules** - Restrict direct access to backend port
4. **Separate networks** - Use Docker networks to isolate services

### Certificate Management

1. **Use Let's Encrypt** for automatic renewal (Caddy, Certbot)
2. **Monitor expiration** - Set up alerts for certificate expiry
3. **Rotate certificates** - Don't use certificates beyond their validity
4. **Secure private keys** - Restrict file permissions (chmod 600)

### Production Checklist

- [ ] TLS 1.2+ only, modern cipher suites
- [ ] HSTS header enabled
- [ ] Certificate auto-renewal configured
- [ ] Backend bound to localhost or internal network
- [ ] TRUST_PROXY set appropriately
- [ ] Firewall rules in place
- [ ] Monitoring and alerting configured

---

## Troubleshooting

### Certificate Issues

**"Certificate not trusted"**
- Ensure full certificate chain is included
- Check certificate matches domain name
- Verify certificate is not expired

**"Unable to read certificate"**
- Check file permissions (readable by server process)
- Verify paths are correct and absolute
- Ensure certificate is in PEM format

### Connection Issues

**"Connection refused"**
- Check server is running and listening on correct port
- Verify firewall allows traffic
- Check HOST binding (0.0.0.0 vs 127.0.0.1)

**"SSE connection drops"**
- Disable proxy buffering (`proxy_buffering off`)
- Set long read timeout (`proxy_read_timeout 86400s`)
- Clear connection header (`proxy_set_header Connection ''`)

### Trust Proxy Issues

**"req.ip shows proxy IP instead of client IP"**
- Ensure TRUST_PROXY is set correctly
- Verify proxy sends X-Forwarded-For header
- Check proxy hop count if using numeric value

---

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `SSL_CERT_PATH` | PEM certificate file path | - |
| `SSL_KEY_PATH` | PEM private key file path | - |
| `SSL_CA_PATH` | CA certificate chain path | - |
| `SSL_PASSPHRASE` | Private key passphrase | - |
| `TRUST_PROXY` | Trust proxy setting | - |
| `HOST` | Server bind address | `0.0.0.0` |
| `PORT` | Server listen port | `3002` |
