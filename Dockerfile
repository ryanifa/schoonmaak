# Kleine, afhankelijkheidsvrije image. Node 22 heeft SQLite ingebouwd.
FROM node:22-alpine

# su-exec om na het goedzetten van het volume rechten te laten vallen.
RUN apk add --no-cache su-exec

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# De database komt in een volume, zodat gegevens een herstart overleven.
ENV DATA_DIR=/data
ENV PORT=3000
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=4s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
