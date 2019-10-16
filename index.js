'use strict';
require('dotenv').config()
const Flectra = require('../flectra');

const deployData = {
    "url": process.env.URL,
    "port": process.env.PORT,
    "db": process.env.DB,
    "username": process.env.USER_NAME,
    "password": process.env.PASSWORD
}


let main = new Flectra(deployData)
console.log(main)
let leads = await main.readElement('res.partner', [['name', 'like', 'test']]);
console.log(leads.length)
