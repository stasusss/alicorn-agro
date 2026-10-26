#!/usr/bin/env bash
# Run once on a fresh Ubuntu 24.04 Hetzner VPS as root.
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl gnupg ufw unattended-upgrades fail2ban

install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

arch="$(dpkg --print-architecture)"
codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
echo "deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${codename} stable" \
  >/etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

dpkg-reconfigure -f noninteractive unattended-upgrades

if ! id -u deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
fi
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
if [[ -f /root/.ssh/authorized_keys ]]; then
  install -m 600 -o deploy -g deploy /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
fi

install -d -m 755 -o deploy -g deploy /opt/alicorn

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

systemctl enable --now docker fail2ban

echo
echo "Bootstrap done."
echo "Next:"
echo "  1. ssh deploy@$(hostname -I | awk '{print $1}')"
echo "  2. Place .env at /opt/alicorn/.env (chmod 600)"
echo "  3. From your laptop: ./scripts/deploy/sync-to-server.sh deploy@HOST"
echo "  4. ssh deploy@HOST 'cd /opt/alicorn && docker compose up -d --build'"
