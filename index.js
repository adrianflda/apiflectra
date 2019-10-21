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

const createActivity = async (activity) => {
    let {
        activity_type_id,
        summary,
        date_deadline,
        user_id,
        note,
        res_id
    } = activity

    let user = user_id && user_id[0] && await oldFlectra.readElement('res.users', [['id', '=', user_id[0]]], ['login'], 0, 1)
    let newUser = user && user.login && await newFlectra.readElement('res.users', [['login', '=', user.login]], ['id'], 0, 1)

    let newActivity = {
        activity_type_id: activity_type_id && activity_type_id[0],
        summary,
        date_deadline,
        user_id: newUser.id,
        note,
        res_model: 'crm-lead',
        res_model_id: 166,
        res_id
    }

    return await newFlectra.createElement({}, 'mail.activity', newActivity)
}

const createLead = async (lead) => {
    let {
        name,
        mobile,
        phone,
        email_from,
        priority,
        x_sourse_notes,
        street,
        street2,
        city,
        country_id,
        partner_id,
        user_id,
        team_id,
        stage_id,
        color,
        activity_date_deadline,
        activity_ids,
        activity_state,
        activity_summary,
        activity_type_id,
        activity_user_id
    } = lead

    let user = user_id && user_id[0] && await oldFlectra.readElement('res.users', [['id', '=', user_id[0]]], ['login'], 0, 1)
    let newUser = user && user.login && await newFlectra.readElement('res.users', [['login', '=', user.login]], ['id'], 0, 1)

    let partner = partner_id && partner_id[0] && await oldFlectra.readElement('res.partner', [['id', '=', partner_id[0]]], ['name', 'phone'], 0, 1)
    let newPartner = partner && partner.name && await newFlectra.readElement('res.partner', [['name', '=', partner.name], ['phone', '=', partner.phone]], ['id'], 0, 1)

    let stage = stage_id && stage_id[0] && await oldFlectra.readElement('crm.stage', [['id', '=', stage_id[0]]], ['name'], 0, 1)
    let newStage = stage && stage.name && await newFlectra.readElement('crm.stage', [['name', '=', stage.name]], ['id'], 0, 1)

    let newLead = {
        name,
        mobile,
        phone,
        email_from,
        priority,
        x_sourse_notes,
        street,
        street2,
        city,
        country_id: country_id && country_id[0],
        partner_id: newPartner.id,
        user_id: newUser.id,
        team_id,
        stage_id: newStage.id,
        notes: x_sourse_notes,
        color,
        activity_summary,
        activity_state,
        activity_date_deadline,
        activity_type_id: activity_type_id && activity_type_id[0]
    }

    let res_id = await newFlectra.createElement({default_type: 'opportunity'}, 'crm.lead', newLead)
    newLead.id = res_id

    await createActivity({ activity_date_deadline, activity_summary, activity_type_id, activity_user_id, res_id })
    return newLead
}

const getCustomers = async () => {
    let leads = await oldFlectra.readElement('crm.lead', [['name', 'ilike', 'VR-TP-MTY']], ['id', 'partner_id'], 0, 0)
    let index = leads.length - 1
    while (index > 0) {
        let lead = leads[index]
        console.log(lead.partner_id)
        let partner_id = lead.partner_id[0]
        if (partner_id) {
            let partner = await oldFlectra.readElement('res.partner', [['id', '=', partner_id]], 0, 0, 1)
            let newPartner = formatClient(partner)
            let exist = await oldFlectra.readElement('res.partner', [['name', '=', newPartner.name], ['phone', '=', newPartner.phone]], ['id', 'name', 'phone'], 0, 1)
            console.log('exist:', exist)
            if (!exist) {
                let result = await newFlectra.createElement({}, 'res.partner', newPartner)
                console.log(result)
            }
        }
        index--
    }
}

const migrateLeads = async () => {
    let leads = await oldFlectra.readElement('crm.lead', [['name', 'ilike', 'VR-TP-MTY']], 0, 0, 0)
    let index = 0
    while (index < leads.length) {
        let lead = leads[index]
        let exist = await newFlectra.readElement('crm.lead', [['name', '=', lead.name]], ['id'], 0, 1)
        if (!exist || !exist.id) {
            let newLead = await createLead(lead)
            console.log('new opportunity: ', newLead && newLead.name)
        }
        index++
    }
}

const main = async () => {
    await oldFlectra.connect(oldDeployData)
    await newFlectra.connect(newDeployData)
    await getCustomers()
    migrateLeads()
}

main()
