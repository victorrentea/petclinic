FROM --platform=linux/amd64 mcr.microsoft.com/playwright:v1.51.1-jammy

RUN apt-get update && apt-get install -y wget gnupg \
 && wget -q https://packages.microsoft.com/keys/microsoft.asc -O- | apt-key add - \
 && echo "deb [arch=amd64] https://packages.microsoft.com/repos/edge stable main" \
      > /etc/apt/sources.list.d/microsoft-edge.list \
 && apt-get update && apt-get install -y microsoft-edge-stable \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json .
RUN npm install
COPY screenshots.mjs .
