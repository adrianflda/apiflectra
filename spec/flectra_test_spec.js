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

describe('flectra test', () => {

    it("should connect", async () => {
        let completed = false;
        completed = await main.flectraConnect(deployData);
        
    });

})
