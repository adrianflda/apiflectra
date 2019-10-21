'use strict';
require('dotenv').config()
const Flectra = require('./flectra');
const { processXLSXFiles } = require('./file')



const crudLeads = async () => {
    try {
        let main = new Flectra(deployData)
        await main.connect()
        let team = await main.readElement('crm.team', [['name', 'like', 'Parejeros-MTY-TP']], 0, 0, 1)
        let agents = team && team.x_agent_ids
        console.log('agents: ', agents && agents.length)
        let leads = await main.readElement('crm.lead', [['type', '=', 'lead'], ['name', 'ilike', 'vr-tp-mty']]);
        console.log('elements: ', leads.length)
        let agentIndex = 0
        while (agentIndex < agents.length) {
            let user_id = agents[agentIndex]
            let part = leads.length / agents.length
            let index = 0
            while (index < part) {
                let element = leads[index]
                let newLead = {
                    id: element.id,
                    user_id,
                    team_id: 118,
                    type: 'opportunity'
                }
                await main.deleteElement('crm.lead', element.id)
                /* let result = await main.updateElement('crm.lead', newLead)
                console.log('update lead result: ', result)
                result = await main.execute_kw('crm-lead', 'convert_opportunity', [
                    [newLead.id], {}
                ])
                console.log('convert lead result: ', result) */
                console.log(index)
                index++
            }
            agentIndex++
            console.log('agent: ', agentIndex)
        }
    } catch (error) {
        console.log('main error: ', error)
    }
}

const processHeaders = (element) => {
    let headers = {
        "INICIATIVA": "name",
        "CANAL DE VENTAS": "team",
        "CONTACT NAME": "contact_name",
        "DOMICILIO": "street",
        "ADDRESS": "street2",
        "CITY": "city",
        "STATE": "state",
        "COUNTRY": "country",
        "PHONE": "phone",
        "MOBILE": "mobile",
        "EMAIL": "email",
        "RANGO INGRESOS": "x_sources_note",
        "BANCO": "x_sources_note",
        "NOTAS DE FUENTE": "x_sources_note"
    }

    let newLead = {}
    for (let field in element) {
        let headersField = headers[field]
        if (headersField === 'x_sources_note')
            newLead[headersField] = (!newLead[headersField]) ? 'Notas: ' : newLead[headersField] + element[field] + '\n'
        else
            newLead[headersField] = element[field]
    }

    return newLead
}

const processContact = (data) => {
    let {
        email = 'empty field',
        phone = 'empty field',
        contact_name = 'empty field',
        street = 'empty field',
        street2 = 'empty field',
        city = 'empty field',
        country,
        mobile = 'empty field',
        country_id,
        state_id,
        state
    } = data

    let client = {
        email,
        phone,
        name: contact_name,
        street,
        street2,
        city,
        country,
        mobile,
        country_id: (Array.isArray(country_id)) ? country_id[0] : country_id,
        state_id: (Array.isArray(state_id)) ? state_id[0] : state_id,
        state
    }

    return client
}

const processXLSXToLeads = async () => {
    try {
        let main = new Flectra(deployData)
        await main.connect()
        let team = (await main.readElement('crm.team', [['name', 'like', 'Parejeros-MTY-TP']], 0, 0, 1)) || {}
        let team_id = team.id
        let agents = team.x_agent_ids || []
        console.log('agents: ', agents.length)

        let country = await main.readElement('res.country', [['name', 'ilike', 'Mexico']], 0, 0, 1) || {}
        let country_id = country.id
        console.log('country: ', country_id)

        let state = await main.readElement('res.country.state', [['name', 'ilike', 'Nuevo Leon']], 0, 0, 1) || {}
        let state_id = state.id
        console.log('state: ', state_id)

        let rawLeads = await processXLSXFiles('/home') || []
        console.log('leads: ', rawLeads.length)
        let agentIndex = 0
        let index = 0
        while (agentIndex < agents.length) {
            let user_id = agents[agentIndex]
            let part = (rawLeads.length / agents.length) * (agentIndex + 1)
            while (index < part) {
                let element = rawLeads[index]
                let newLead = processHeaders(element)
                newLead = {
                    ...newLead,
                    team_id,
                    user_id,
                    country_id,
                    state_id
                }
                let lead = await main.readElement('crm.lead', [['name', 'like', newLead.name]], ['id'], 0, 1)

                let client = processContact(lead)
                let partner = await main.readElement('res.partner', [['mobile', '=', client.mobile], ['name', '=', client.name]], ['id'], 0, 1)
                let partner_id = partner && partner.id
                if (!partner_id)
                    partner_id = await main.createElement({}, 'res.partner', client)
                newLead.partner_id = partner_id

                if (lead && !lead.partner_id) {
                    console.log('existe lead: ', lead)
                    await main.updateElement('crm.lead', { id: lead.id, partner_id })
                } else {
                    let result = await main.createElement({}, 'crm.lead', newLead)
                    console.log('create lead result: ', result)
                    newLead.id = result
                    result = await main.execute_kw('crm.lead', 'convert_opportunity', [
                        [newLead.id], { partner_id }
                    ])
                    console.log('convert lead result: ', result)
                }
                index++
                console.log(index)
            }
            agentIndex++
            console.log('agent: ', agentIndex)
        }
    } catch (error) {
        console.log(error)
    }
}

const updateClient = async (main, lead) => {
    let client = processContact(lead)
    let partner = await main.readElement('res.partner', [['mobile', '=', client.mobile], ['name', '=', client.name]], ['id'], 0, 1)
    let partner_id = partner && partner.id
    if (!partner_id)
        partner_id = await main.createElement({}, 'res.partner', client)
    await main.updateElement('crm.lead', { id: lead.id, partner_id })
}

const getLeadWithBadClient = async () => {
    let main = new Flectra(deployData)
    await main.connect()
    let leads = await main.readElement('crm.lead', [
        [
            'name',
            'ilike',
            'test-VR-TP-MTY']
    ], [
        'id',
        'partner_id',
        'email',
        'phone',
        'name',
        'contact_name',
        'street',
        'street2',
        'city',
        'country',
        'mobile',
        'country_id',
        'state_id'], 0, 0)
    let index = 0
    let badIndex = 1
    console.log(leads.length)
    while (index < leads.length) {
        let lead = leads[index]
        if (Array.isArray(lead.partner_id) && lead.partner_id[1] === '') {
            console.log(badIndex++, 'bad client: ', lead.name, lead.partner_id)
            await updateClient(main, lead)
        }
        index++
    }
}

const assignLeadsToAgent = async (from, to) => {
    let main = new Flectra(deployData)
    await main.connect()
    let leads = await main.readElement('crm.lead', [
        [
            'name',
            'like',
            'VR-TP-MTY']
    ], [
        'id',
        'name',
        'stage_id',
        'user_id',
        'team_id'
    ], 0, 0)

    console.log(leads.length)
    let index = leads.length - 80
    console.log(leads.length)
    while (index < leads.length) {
        let lead = leads[index]
        if (lead.team_id[0] !== 118) {
            console.log(lead)
            await main.updateElement('crm.lead', { id: lead.id, team_id: 118 })
        }
        index++
    }
}


const getLeads = async () => {
    let main = new Flectra(deployData)
    await main.connect()
    let leads = await main.readElement('crm.lead', [['name', 'ilike', 'VR-TP-MTY']], 0, 0, 0)
    let index = 0
    while (index < leads.length && index < 10) {
        let lead = leads[index]
        console.log(lead.name)
        let result = await main.updateElement('crm.lead', { id: lead.id, team_id: false, user_id: false })
        console.log(result)
        index++
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const newDeployData = {
    "url": process.env.URL,
    "port": process.env.PORT,
    "db": process.env.DB,
    "username": process.env.USER_NAME,
    "password": process.env.PASSWORD
}

/**
 * Deploy data url, port, db, username, passowrd
 */
const oldDeployData = {
    "url": process.env.oldURL,
    "port": process.env.oldPORT,
    "db": process.env.oldDB,
    "username": process.env.oldUSER_NAME,
    "password": process.env.oldPASSWORD
}
const oldFlectra = new Flectra(oldDeployData)
const newFlectra = new Flectra(newDeployData)

const formatClient = (partner) => {
    let {
        name,
        email,
        phone,
        mobile,
        street,
        street2,
        city,
        country_id
    } = partner

    let newPartner = {
        name: name || 'empty field',
        email,
        phone,
        mobile,
        street,
        street2,
        city,
        country_id: country_id && country_id[0],
        employee: false,
        customer: true,
        type: 'contact',
        company_type: 'person'
    }

    return newPartner
}

const formatLead = (lead) => {
    let {
        name,
        partner_id,
        user_id,
        mobile,
        phone,
        email_from,
        priority,
        x_sourse_notes,
        street,
        street2,
        city,
        country_id,
    } = lead

    let newLead = {
        name,
        partner_id,
        user_id,
        mobile,
        phone,
        email_from,
        priority,
        x_sourse_notes,
        street,
        street2,
        city,
        country_id: country_id && country_id[0],
        notes: x_sourse_notes
    }

    return newLead
}

const getCustomers = async (oldFlectra, newFlectra) => {
    let leads = await oldFlectra.readElement('crm.lead', [['name', 'ilike', 'VR-TP-MTY']], ['id', 'partner_id'], 0, 0)
    let index = 0
    while (index < leads.length) {
        let lead = leads[index]
        console.log(lead.partner_id)
        let partner_id = lead.partner_id[0]
        if (partner_id) {
            let partner = await oldFlectra.readElement('res.partner', [['id', '=', partner_id]], 0, 0, 1)
            let newPartner = formatClient(partner)
            let result = await newFlectra.createElement({}, 'res.partner', newPartner)
            console.log(result)
        }
        index++
    }
}

// assignLeadsToAgent('laura.mendoza@vacancyrewards.com', 'darani.espinosa@vacancyrewards.com')

const main = async () => {
    await oldFlectra.connect(oldDeployData)
    await newFlectra.connect(newDeployData)
    getCustomers(oldFlectra, newFlectra)
}

main()
