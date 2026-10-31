# Mock API for the Chat AI demo (no dependencies)
FROM node:22-alpine
WORKDIR /usr/src/app
COPY package.json *.mjs ./
ENV MOCK_PORT=8090
EXPOSE 8090
CMD ["node", "server.mjs"]
