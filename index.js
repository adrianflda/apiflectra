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
    try {
        let main = new Flectra(deployData)
        await main.connect()
        //let team = await main.readElement('crm.team', [['name', '=', 'Parejeros-MTY-TP']])
       // let agents = team && team.x_agent_ids
        let leads = await main.readElement('crm.lead', [['user_id', '=', 18]]);
        console.log('elements: ', leads.length)
        leads.forEach(async element => {
            let newLead = {
                id: element.id,
                user_id: 80,
                team_id: 118
            }
            await main.updateElement('crm.lead',newLead)
        });
    } catch (error) {
        console.log('main error: ', error)
    }
}

main()