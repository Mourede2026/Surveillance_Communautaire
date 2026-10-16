FROM node:22-alpine
WORKDIR /app
COPY server/package.json server/
RUN cd server && npm install --omit=dev
COPY . .
ENV PORT=3000 DATA_DIR=/data TZ=Africa/Porto-Novo
VOLUME /data
EXPOSE 3000
CMD ["node", "server/server.js"]
