'use strict';
require('dotenv').config()
const Flectra = require('../flectra');
const main = new Flectra()

const deployData = {
    "url": process.env.URL,
    "port": process.env.PORT,
    "db": process.env.DB,
    "username": process.env.USER_NAME,
    "password": process.env.PASSWORD
}

describe('flectra connection test', () => {

    it("should connect", async () => {
        let connection = await main.flectraConnect(deployData);
        console.log(connection)
    });
})
