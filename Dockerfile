FROM node:8.15.0-alpine

WORKDIR /src
ADD package.json .
RUN npm install --verbose

COPY . .

CMD [ "npm", "start" ]