FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma

RUN npm install
RUN npx prisma generate --schema=prisma/schema.prisma

COPY . .

RUN chown -R node:node /app
USER node

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npm run start:dev"]
