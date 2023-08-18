FROM node:12-alpine

WORKDIR /web

ADD . .
RUN yarn install
RUN yarn build

CMD [ "yarn", "start" ]
