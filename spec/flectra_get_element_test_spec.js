'use strict';
require('dotenv').config()
const main = require('../index');

const deployData = {
    "url": process.env.URL,
    "port": process.env.PORT,
    "db": process.env.DB,
    "username": process.env.USER_NAME,
    "password": process.env.PASSWORD
}

describe('flectra get elemet test', () => {

    it("should get elements", async () => {
        let concact = await main.getElement('res.partner', [['email', '=', 'adrian.flda@gmail.com']]);
        console.log(contact)
    });

})