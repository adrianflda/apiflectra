'use strict';
require('dotenv').config()
const { Sema } = require('async-sema');
const s = new Sema(
    1, // Allow 4 concurrent async calls
    {
        capacity: 10000 // Prealloc space for 1000 tokens
    }
);
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

String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

const formatNotes = (lead) => {
    lead.x_currency_reservations = (lead.x_currency_reservations === 0 || lead.x_currency_reservations === '0') ? 'MX' : 'USD'

    let oldLead = {
        x_login_id: "Login",
        x_email1: "Email1",
        x_email2: "Email2",
        x_office_phone: "Office phone",
        x_membership: "Membresia",
        x_club_name: "Club name",
        x_lang: "Languaje",
        x_password: "Password",
        x_first_name_cotitular: "Cootitular's firt name",
        x_last_name_cotitular: "Cootitular's last name",
        x_date_purchased: "Purchased date",
        x_currency_reservations: "Currency of reservation",
        x_last_visit: "Last visit",
        x_first_visit_system: "First visit",
        x_date_acceptance_terms_conditions: "Date of acceptance terms and conditions",
        x_update_month_renovation: "Month of renovation",
        x_registration: "Date of registration",
        x_terms_conditions: "Terms and conditions",
        x_club_active: "Club active",
        x_sources_note: "Source's notes",
        x_membership_active: "Membership active",
        x_comments: "Comments",
        x_years_purchased: "Purchased years",
        x_sales_person: "Sales person",
        x_purchased_price: "Purchased price",
        x_number_weeks_year: "Number of weeks for year",
        x_vacancy_rewards_dr: "Rewards DR",
        x_condo_rewards: "Condo",
        x_tours_traslados_rewards: "Tours",
        x_yates_rewards: "Yates",
        x_currency_reservations: "Currency",
        x_hot_weeks: "Hot weeks",
        x_club_399: "Club399",
        x_vacancy_rewards: "Vacancy rewards",
        x_cruises: "Cruises",
        x_cars: "Cars",
        x_air: "Air",
        x_mexico: "In Mexico",
        x_golf: "Golf",
        description: "Description",
        comment: "Comment"
    }
    let x_sources_note = ''

    for (let field in oldLead) {
        x_sources_note += (lead[field] && lead[field] !== 'undefined') ? `${oldLead[field]}: ${lead[field]}` + '\n' : ''
    }
    return x_sources_note.replaceAll('undefined', ' empty field ')
}

///////////////////////////////////////////////////////////////////// CREATE ////////////////////////////////////////////////////////////////

const createClient = async (partner) => {
    let {
        name,
        email,
        phone,
        mobile,
        street,
        street2,
        city,
        country_id,
        comment
    } = partner

    comment = '\n\n' + formatNotes(partner)

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
        company_type: 'person',
        comment
    }

    newPartner.id = await newFlectra.createElement({}, 'res.partner', newPartner) || false
    return newPartner
}

const createUser = async (user) => {
    let {
        name,
        login
    } = user

    let newUser = {
        name,
        login,
        customer: false
    }

    newUser.id = await newFlectra.createElement({}, 'res.users', newUser) || false
    return newUser
}


const createTeam = async (team) => {
    let {
        name,
        alias_name,
        user_id,
        member_ids
    } = team

    if (Array.isArray(user_id)) {
        let user_id_login = await oldFlectra.readElement('res.users', [['id', '=', user_id[0]]], ['login'], 0, 1)
        let login = user_id_login && user_id_login.login
        let new_user = await newFlectra.readElement('res.users', [['login', '=', login]], ['id'], 0, 1)
        user_id = new_user && new_user.id
    }

    if (Array.isArray(member_ids)) {
        let members = await oldFlectra.readElement('res.users', [['id', 'in', member_ids]], ['login'])
        let new_members = await newFlectra.readElement('res.users', [['login', 'in', members.map(member => member.login)]])
        member_ids = new_members && new_members.map(member => member.id)
    }

    let newTeam = {
        name,
        alias_name,
        user_id,
        member_ids: [[6, 0, member_ids]]
    }

    newTeam.id = await newFlectra.createElement({}, 'crm.team', newTeam) || false
    return newTeam
}

const createStage = async (stage) => {
    let {
        name,
        team_id,
        on_change,
        probability,
        fold,
        requirements
    } = stage

    let newTeam = await createIfNotExistTeam({ old_team_id: team_id[0] })

    let newStage = {
        name,
        team_id: newTeam && newTeam.id,
        on_change: on_change,
        probability: on_change && probability,
        fold: fold,
        requirements: requirements
    }

    newStage.id = await newFlectra.createElement({}, 'crm.stage', newStage) || false
    return newStage
}

const createLead = async (lead) => {
    if (!lead) {
        return
    }

    let {
        name,
        mobile,
        phone,
        email_from,
        priority,
        x_sourse_notes,
        notes,
        street,
        street2,
        city,
        country_id,
        partner_id,
        partner_name,
        contact_name,
        user_id,
        team_id,
        stage_id,
        color,
        activity_summary,
        activity_state,
        activity_date_deadline,
        activity_type_id,
        type,
        description
    } = lead

    description = '\n\n' + formatNotes(lead)

    let newUser = Array.isArray(user_id) && await createIfNotExistUser({ old_user_id: user_id[0] })
    let newPartner = Array.isArray(partner_id) && await createIfNotExistPartner({ old_partner_id: partner_id[0] })
    let newTeam = Array.isArray(team_id) && await createIfNotExistTeam({ old_team_id: team_id[0] })
    let newStage = Array.isArray(stage_id) && await createIfNotExistStage({ old_stage_id: stage_id[0] })

    let newLead = {
        name,
        mobile,
        phone,
        email_from,
        contact_name: contact_name.replaceAll('undefined', ''),
        partner_name,
        priority,
        street,
        street2,
        city,
        country_id: country_id && country_id[0],
        partner_id: newPartner.id,
        user_id: newUser && newUser.id,
        team_id: newTeam && newTeam.id,
        stage_id: newStage.id,
        notes: notes + ' \n ' + x_sourse_notes,
        color,
        activity_summary,
        activity_state,
        activity_date_deadline,
        activity_type_id: activity_type_id && activity_type_id[0],
        description
    }

    newLead.id = await newFlectra.createElement({ default_type: type }, 'crm.lead', newLead) || false
    return newLead
}

const createCalendarEvent = async (calendar_event_id) => {
    let event = await oldFlectra.readElement('calendar.event', [['id', '=', calendar_event_id]], 0, 0, 1)
    //console.log('calendar event: ', JSON.stringify(event))

    let {
        //rrule_type: false,
        //categ_ids: [],
        //message_unread: false,
        //message_needaction: false,
        //recurrent_id_date,
        //website_message_ids: [],
        //phonecall_id,
        //message_needaction_counter: 0,
        //recurrent_id,
        //message_channel_ids,               ///Array [],
        //recurrency: false,
        //byday: false,
        //message_unread_counter: 0,
        //week_list,
        //message_last_post: false,
        //attendee_ids,                       // Array [21], res.partner acepted or not list
        start,                              //String "2019-10-19 16:00:00"
        res_model_id,                       //Array 
        start_date,
        alarm_ids: [],
        activity_ids,                       ///Array [46,47],
        interval,
        state,
        name,                               // String "VR-TP-MTY-00291 Georgina Rodriguez ",
        description,
        display_start,                      //String "2019-10-19 16:00:00"
        stop_date,
        display_name,                       //"VR-TP-MTY-00291 Georgina Rodriguez ",
        attendee_status,                    //String "accepted", 
        stop_datetime,                      //String "2019-10-19 16:00:00"
        month_by,                           //String "date"
        count,
        user_id,                            // Array [9,"DARANI ESPINOSA"],
        message_is_follower,                // Boolean true,
        mo,
        tu,
        we,
        th,
        fr,
        sa,
        su,
        da,
        create_date,                         //String "2019-10-19 16:00:00"
        location,
        stop,                               //String "2019-10-19 16:00:00"
        message_ids,                        // Array [9292,9291], model=mail.message
        final_date,
        message_follower_ids,               // Array [6914],
        res_id,                             // Int 2004,
        is_attendee,
        start_datetime,                     //String "2019-10-19 16:00:00"
        opportunity_id,                     // Array: [2004,"VR-TP-MTY-00291"],
        display_time,                       //String: "October-19-2019 at (04-00 PM To 04-00 PM) (UTC)",
        active,
        duration,
        privacy,                            //String: "public",
        partner_id,                         //Array [10,"DARANI ESPINOSA"],
        allday,
        res_model,                          //String: "crm.lead",
        is_highlighted,
        end_type,                           //String : "count",
        show_as,                            // String: "busy",
        partner_ids                         // Array [12, 65] res.partner
    } = event

    let exist = await newFlectra.readElement('calendar.event', [
        ['name', '=', name],
        ['res_model', '=', res_model],
        ['start_date', '=', start_date]
    ], ['id'], 0, 1)
    if (exist && exist.id) {
        return
    }

    let partners = await newFlectra.readElement('res.partner', [['id', 'in', partner_ids]], ['id'])
    if (Array.isArray(partners)) {
        partner_ids = [[6, 0, partners.map(partner => partner.id)]]
    }

    let newUser = user_id && await createIfNotExistUser({ old_user_id: user_id[0] })
    let newLead = opportunity_id && await createIfNotExistLead({ old_lead_id: opportunity_id[0] })
    let newPartner = partner_id && await createIfNotExistPartner({ old_partner_id: partner_id[0] })

    let newEvent = {
        res_id: newLead && newLead.id,
        partner_ids,
        partner_id: newPartner && newPartner.id,
        res_model_id: res_model_id[0],
        user_id: newUser && newUser.id,
        opportunity_id: newLead && newLead.id,
        //message_ids,                        // Array [9292,9291], model=mail.message

        start,                              //String "2019-10-19 16:00:00"
        start_date,
        interval,
        state,
        name,                               // String "VR-TP-MTY-00291 Georgina Rodriguez ",
        description,
        display_start,                      //String "2019-10-19 16:00:00"
        stop_date,
        display_name,                       //"VR-TP-MTY-00291 Georgina Rodriguez ",
        attendee_status,                    //String "accepted", 
        stop_datetime,                      //String "2019-10-19 16:00:00"
        month_by,                           //String "date"
        count,
        message_is_follower,                // Boolean true,
        mo,
        tu,
        we,
        th,
        fr,
        sa,
        su,
        da,
        create_date,                         //String "2019-10-19 16:00:00"
        location,
        stop,                               //String "2019-10-19 16:00:00"
        final_date,
        is_attendee,
        start_datetime,                     //String "2019-10-19 16:00:00"
        display_time,                       //String: "October-19-2019 at (04-00 PM To 04-00 PM) (UTC)",
        active,
        duration,
        privacy,                            //String: "public",
        allday,
        is_highlighted,
        end_type,                           //String : "count",
        show_as,                            // String: "busy",
    }

    newEvent.id = await newFlectra.createElement({}, 'calendar.event', newEvent) || false
    return newEvent
}

const createMessage = async (message, new_res_id) => {
    let {
        subject,        //String
        date,           //String 
        email_from,     //String    
        author_id,      //Array [23], res.partner    
        record_name,    //String
        reply_to,       //String
        parent_id,      //Array [22, 'mesegae], mail.message
        model,          //String
        res_id,         //Integer
        message_type,   //String 

        body,           //String
        message_id,     //String

    } = message

    let newAuthor = Array.isArray(author_id) && await createIfNotExistPartner({ old_partner_id: author_id[0] })
    let newParent = Array.isArray(parent_id) && await createIfNotExistMessage({ old_message_ids: [parent_id[0]] })
    let new_res = new_res_id && { id: new_res_id } || await createIfNotExistLead({ old_lead_id: res_id })

    let newMessage = {
        subject,                            //String
        date,                               //String 
        email_from,                         //String    
        author_id: newAuthor && newAuthor.id,    //Array [23], res.partner    
        record_name,                            //String
        reply_to,                               //String
        parent_id: newParent && newParent[0] && newParent[0].id,      //Array [22, 'mesegae], mail.message
        model,                              //String
        res_id: new_res && new_res.id,                             //Integer
        message_type,                       //String 

        body,                               //String
        message_id,                         //String
    }

    newMessage.id = await newFlectra.createElement({}, 'mail.message', newMessage)
    return newMessage
}

const createActivity = async (lead, activity = {}) => {

    let {
        calendar_event_id,
        note,
        res_model_id,
        activity_type_id,
        icon,
        feedback,
        user_id,
        state,
        summary,
        activity_category,
        has_recommended_activities,
        display_name,
        res_name,
        res_model,
        date_deadline
    } = activity

    let exist = await newFlectra.readElement('mail.activity', [
        ['res_name', '=', res_name],
        ['display_name', '=', display_name],
        ['res_model', '=', res_model]
    ], ['id'], 0, 1)
    if (exist && exist.id) {
        return
    }

    let newActivity = {
        res_id: lead.id,
        calendar_event_id,
        note,
        res_model_id: res_model_id[0],
        activity_type_id: activity_type_id[0],
        icon,
        feedback,
        user_id: lead.user_id[0],
        state,
        summary,
        activity_category,
        has_recommended_activities,
        display_name,
        res_name,
        res_model,
        date_deadline
    }

    newActivity.id = await newFlectra.createElement({}, 'mail.activity', newActivity) || false
    return newActivity
}

const createPhonecall = async (call) => {
    let {
        description,
        name,
        partner_id,
        user_id,
        opportunity_id,
        summary_id
    } = call

    let newUser = user_id && await createIfNotExistUser({ old_user_id: user_id[0] })
    let newPartner = partner_id && await createIfNotExistPartner({ old_partner_id: partner_id[0] })
    let newLead = opportunity_id && await createIfNotExistLead({ old_lead_id: opportunity_id[0] })
    let newSummary = name && await newFlectra.readElement('crm.phonecall.summary', [['name', '=', name]], 0, 0, 1)

    let newCall = old_call && old_call.name && await newFlectra.readElement('crm.phonecall', [
        ['name', '=', name],
        ['description', '=', description],
        ['summary_id', '=', newSummary && newSummary.id],
        ['partner_id', '=', newPartner && newPartner.id],
        ['opportunity_id', '=', newLead && newLead.id]
    ], ['id'], 0, 1)

    if (newCall && newCall.id) {
        return newCall
    }

    let newPhonecall = {
        description,
        name,
        summary_id: newSummary && newSummary.id,
        partner_id: newPartner && newPartner.id,
        opportunity_id: newLead && newLead.id,
        user_id: newUser && newUser.id
    }

    newPhonecall.id = await newFlectra.createElement({}, 'crm.phonecall', newPhonecall)
    return newPhonecall
}

///////////////////////////////////////////////////////////// GET ///////////////////////////////////////////////////////////////////

const createIfNotExistUser = async ({ old_user_id, old_user }) => {
    old_user = old_user || await oldFlectra.readElement('res.users', [['id', '=', old_user_id]], ['name', 'login'], 0, 1)
    let newUser = old_user && old_user.login && await newFlectra.readElement('res.users', [
        ['login', '=', old_user.login]
    ], ['id'], 0, 1)
    if (!newUser && old_user) {
        newUser = await createUser(old_user)
    }
    return newUser
}

const createIfNotExistPartner = async ({ old_partner_id, old_partner }) => {
    old_partner = old_partner || await oldFlectra.readElement('res.partner', [
        ['id', '=', old_partner_id]
    ], 0, 0, 1)
    let newPartner = old_partner && old_partner.name && await newFlectra.readElement('res.partner', [
        ['name', '=', old_partner.name],
        ['phone', '=', old_partner.phone]
    ], ['id'], 0, 1)
    if (!newPartner && old_partner) {
        newPartner = await createClient(old_partner)
    }
    return newPartner
}

const createIfNotExistTeam = async ({ old_team_id, old_team }) => {
    old_team = old_team || await oldFlectra.readElement('crm.team', [
        ['id', '=', old_team_id]
    ], 0, 0, 1)
    let newTeam = old_team && await newFlectra.readElement('crm.team', [
        ['name', '=', old_team.name]
    ], 0, 0, 1)
    if (!newTeam && old_team) {
        newTeam = await createTeam(old_team)
    }
    return newTeam
}

const createIfNotExistStage = async ({ old_stage_id, old_stage }) => {
    old_stage = old_stage || await oldFlectra.readElement('crm.stage', [
        ['id', '=', old_stage_id]
    ], ['name'], 0, 1)
    let newStage = old_stage && old_stage.name && await newFlectra.readElement('crm.stage', [
        ['name', '=', old_stage.name]
    ], ['id'], 0, 1)
    if (!newStage && old_stage) {
        newStage = await createStage(old_stage)
    }
    return newStage
}

const createIfNotExistMessage = async ({ old_message_ids, old_message }) => {
    let messages = old_message && [old_message] || await oldFlectra.readElement('mail.message', [
        ['id', 'in', old_message_ids]
    ])
    let new_message_ids = []
    let index = 0
    while (index < messages.length) {
        let message = messages[index]
        let newMessage = await newFlectra.readElement('mail.message', [
            ['message_id', '=', message.message_id]
        ], 0, 0, 1)
        if (!newMessage) {
            newMessage = await createMessage(message)
        }
        new_message_ids.push(newMessage.id)
        index++
    }
    return new_message_ids
}

const createIfNotExistLead = async ({ old_lead_id, old_lead }) => {
    old_lead = old_lead || await oldFlectra.readElement('crm.lead', [
        ['id', '=', old_lead_id]
    ], 0, 0, 1)
    let newLead = old_lead && await newFlectra.readElement('crm.lead', [
        ['name', '=', old_lead.name]
    ], 0, 0, 1)
    if (!newLead) {
        newLead = await createLead(old_lead)
    }
    return newLead
}

///////////////////////////////////////////////////////////// UPDATE //////////////////////////////////////////////////////////////////////
const updateLeadActivities = async (lead = {}, activity_ids = []) => {
    let activities = await oldFlectra.readElement('mail.activity', [['id', 'in', activity_ids]])
    let index = 0
    while (index < activities.length) {
        let activity = activities[index]
        console.log(index++, activity)
        if (activity.calendar_event_id) {
            let event = await createCalendarEvent(activity.calendar_event_id[0])
            activity.calendar_event_id = event && event.id
        }
        console.log(activity)
        await createActivity(lead, activity)
    }
}

const summary_ids = {
    'Sin Contacto': 1,
    'Reservado': 2,
    'No Interesado': 3,
    'Interesado': 4,
    'Desea Cancelar Su Membresia': 5,
    'No Contactar': 6,
    'Empty summary': 7
}

const updatePhoneCalls = async (lead, phonecall_ids, isFisrtFlectra) => {
    let phonecalls = await oldFlectra.readElement('crm.phonecall', [['id', 'in', phonecall_ids]], 0, 0, 0)
    let index = 0
    while (index < phonecalls.length) {
        let phonecall = phonecalls[index]
        let {
            name,
            description,
            x_subject,
            date,
        } = phonecall

        x_subject = (isFisrtFlectra) ? x_subject : name

        let newPhonecall = await newFlectra.readElement('crm.phonecall', [
            ['name', '=', name],
            ['description', '=', description],
            ['partner_id', '=', lead.partner_id && lead.partner_id[0]],
            ['user_id', '=', lead.user_id && lead.user_id[0]],
            ['date', '=', date]
        ], 0, 0, 1)

        if (newPhonecall) {
            return newPhonecall
        }

        console.log(summary_ids, x_subject, summary_ids[x_subject], name, summary_ids[name])
        if (summary_ids[x_subject]) {
            let newSummary = await newFlectra.readElement('crm.phonecall.summary', [['name', '=', x_subject]], ['id'], 0, 1)

            let newPhonecall = {
                description,
                name: x_subject,
                summary_id: newSummary && newSummary.id,
                partner_id: lead.partner_id && lead.partner_id[0],
                opportunity_id: lead.id,
                user_id: lead.user_id[0],
                date
            }

            await newFlectra.createElement({}, 'crm.phonecall', newPhonecall)
            console.log('phonecall: ', index++, phonecall)
        }
        index++
    }
}

const updateLeads = async (leads) => {
    leads.forEach(async lead => {
        await s.acquire()
        try {
            console.log(s.nrWaiting() + ' calls to updatelead are waiting')
            let newLead = await createIfNotExistLead({ old_lead: lead })
            if (newLead && (!newLead.contact_name || !newLead.partner_id)) {
                let newPartner = await createIfNotExistPartner({ old_partner_id: lead.partner_id && lead.partner_id[0] })
                let leadForUpdate = {
                    id: newLead.id,
                    partner_id: newPartner.id,
                    contact_name: lead.contact_name
                }
                await newFlectra.updateElement('crm.lead', leadForUpdate)
            }
        } finally {
            s.release();
        }
    })
}


/////////////////////////////////////////////////////////////// LOAD /////////////////////////////////////////////////////////////////////////////
const loadMessages = async (leads = []) => {
    let leadIndex = 0
    while (leadIndex < leads.length) {
        let lead = leads[leadIndex]
        let message_ids = lead.message_ids
        let messages = await oldFlectra.readElement('mail.message', [['id', 'in', message_ids]])

        let index = 0
        while (index < messages.length) {
            let message = messages[index]
            await s.acquire()
            try {
                console.log(s.nrWaiting() + ' calls to createIfNotExistMessage are waiting')
                await createIfNotExistMessage({ old_message: message })

            } finally {
                s.release();
            }
            index++
            console.log('message: ', index)
        }
        leadIndex++
    }
}

const loadCRMLeads = async (leads = []) => {
    leads.forEach(async lead => {
        await s.acquire()
        try {
            console.log(s.nrWaiting() + ' calls to createIfNotExistLead are waiting')
            let newLead = await createIfNotExistLead({ old_lead: lead })
            if (newLead && newLead.id) {
                await updatePhoneCalls(newLead, lead.phonecall_ids)
                await updateLeadActivities(newLead, lead.activity_ids)
            }
        } finally {
            s.release();
        }
    })
}

const loadCRMPhonecallSummary = async () => {
    let summarys = await oldFlectra.readElement('crm.phonecall.summary', [], ['name'], 0, 0)
    summarys.forEach(async summary => {
        let exist = await newFlectra.readElement('crm.phonecall.summary', [['name', '=', summary.name]], ['name'], 0, 1)
        if (!exist) {
            await newFlectra.createElement({}, 'crm.phonecall.summary', { name: summary.name })
        }
    })
}

const loadPhoneCalls = async () => {
    let leads = await oldFlectra.readElement('crm.lead', [])
    let index = 592
    while (index > 300) {
        let lead = leads[index]
        let newLead = await createIfNotExistLead({ old_lead: lead })
        await updatePhoneCalls(newLead, lead.phonecall_ids)
        index--
        console.log(index)
    }
}

const loadCRMStages = async () => {
    let stages = await oldFlectra.readElement('crm.stage', [], 0, 0, 0)
    stages.forEach(async stage => {
        await createIfNotExistStage({ old_stage: stage })
    })
}

const loadCRMTeams = async () => {
    let teams = await oldFlectra.readElement('crm.team', [], 0, 0, 0)
    teams.forEach(async team => {
        await createIfNotExistTeam({ old_team: team })
    })
}

const loadUsers = async () => {
    let users = await oldFlectra.readElement('res.users', [], 0, 0, 0)
    users.forEach(async user => {
        await s.acquire()
        try {
            console.log(s.nrWaiting() + ' calls to createIfNotExistUser are waiting')
            await createIfNotExistUser({ old_user: user })
        } finally {
            s.release();
        }
    })
}

const loadPartners = async () => {
    let partners = await oldFlectra.readElement('res.partner', [], 0, 0, 0)
    partners.forEach(async partner => {
        await s.acquire()
        try {
            console.log(s.nrWaiting() + ' calls to createIfNotExistPartner are waiting')
            await createIfNotExistPartner({ old_partner: partner })
        } finally {
            s.release();
        }
    })
}

const workWithThis = async (model, filter = [], callback) => {
    let start = 0
    let amount = 100
    let flag = true
    while (flag) {
        await s.acquire()
        try {
            let elements = await oldFlectra.readElement(model, filter, 0, start, amount)
            console.log(s.nrWaiting() + ` calls to workWithThis ${model} filter: ${filter} are waiting`)
            await callback(elements)
            flag = elements.length > 0
            start += amount
        } finally {
            s.release();
        }
    }
}

const luisFilter = [
    ['team_id', 'in', [3, 19, 14, 18, 17]]
]

const certopiaFilter = [
    ['name', 'like', 'CERTIFICADO']
]

const referidosFilter = [
    ['name', 'like', 'REFERIDO']
]

const main = async () => {
    await oldFlectra.connect(oldDeployData)
    await newFlectra.connect(newDeployData)
    let filter = luisFilter
    //await loadCRMPhonecallSummary()   //1
    //await loadCRMStages()             //2
    //await loadUsers()                 //3
    //await loadCRMTeams()              //4
    //await loadPartners()              //5
    //await loadCRMLeads(filter)              //6
    //await loadPhoneCalls()
    //await loadMessages(filter)
    await workWithThis('crm.lead', filter, loadCRMLeads)
    await workWithThis('crm.lead', filter, loadMessages)
    await workWithThis('crm.lead', referidosFilter, updateLeads)
}

main()
