'use strict';
require('dotenv').config()
const Flectra = require('./flectra');

const deployData = {
    "url": process.env.URL,
    "port": process.env.PORT,
    "db": process.env.DB,
    "username": process.env.USER_NAME,
    "password": process.env.PASSWORD
}



const main = async () => {
    let main = new Flectra(deployData)
    console.log(main)
    let connection = await main.flectraConnect()
    console.log('connection:' ,connection)
    let leads = await main.readElement('crm.lead', [['name', 'like', 'vr-tp-mty']]);
    console.log(leads.length)
}

main()