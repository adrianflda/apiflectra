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

const deployData = {
    "url": process.env.URL,
    "port": process.env.PORT,
    "db": process.env.DB,
    "username": process.env.USER_NAME,
    "password": process.env.PASSWORD
}

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
                let new_lead = {
                    id: element.id,
                    user_id,
                    team_id: 118,
                    type: 'opportunity'
                }
                await main.deleteElement('crm.lead', element.id)
                /* let result = await main.updateElement('crm.lead', new_lead)
                console.log('update lead result: ', result)
                result = await main.execute_kw('crm-lead', 'convert_opportunity', [
                    [new_lead.id], {}
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
    console.log('element: ', element)

    let headers = {
        "LEAD/OPPORTUNITY": "name",
        "TEAM": "team",
        "AGENT_LOGIN": "agent_login",
        "CONTACT_NAME": "contact_name",
        "STREET": "street",
        "STREET2": "street2",
        "CITY": "city",
        "ZIP": "zip",
        "STATE": "state",
        "COUNTRY": "country",
        "PHONE": "phone",
        "MOBILE": "mobile",
        "EMAIL": "email",
        "EXTRA": "description"
    }

    let new_lead = {}
    for (let field in element) {
        let headersField = headers[field]
        console.log('field: ', field, headersField)
        if (headersField)
            if (headersField === 'description')
                new_lead[headersField] = !new_lead[headersField] ? element[field] + ' \n' : new_lead[headersField] + element[field] + ' \n'
            else
                new_lead[headersField] = element[field]
    }

    return new_lead
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
        country_id: country_id ? country_id[0] : country_id,
        state_id: state_id ? state_id[0] : state_id,
        state
    }

    return client
}

const processXLSXToLeads = async ({
    crm_name,
    country_name,
    state_name,
    agent_login,
    are_opportunity = false
}) => {
    try {
        let main = new Flectra(deployData)
        await main.connect()
        
        let rawLeads = await processXLSXFiles('/home') || []
        console.log('leads: ', rawLeads.length)

        let team = await main.readElement('crm.team', [['name', 'like', crm_name]], 0, 0, 1) || {}
        console.log('team: ', team && team.name)

        let user = agent_login && await main.readElement('res.users', [['login', '=', agent_login]], ['id'], 0, 1)
        let user_id = user && user.id
        let team_id = team.id
        let agents = user_id && [user_id] || team.member_ids
        console.log('agents: ', agents.length)

        let agentIndex = 0
        let index = 0
        while (agentIndex < agents.length) {
            let user_id = agents[agentIndex]
            let part = (rawLeads.length / agents.length) * (agentIndex + 1)
            while (index < part) {
                let element = rawLeads[index]
                let new_lead = processHeaders(element)


                
                country_name = new_lead.country || country_name
                let country = await main.readElement('res.country', [['name', 'ilike', country_name]], 0, 0, 1) || {}
                let country_id = country.id
                console.log('country: ', country_id)

                state_name = new_lead.state || state_name
                let state = await main.readElement('res.country.state', [['name', 'ilike', state_name]], 0, 0, 1) || {}
                let state_id = state.id
                console.log('state: ', state_id)
                
                new_lead = {
                    ...new_lead,
                    team_id,
                    user_id,
                    country_id,
                    state_id
                }

                let client = processContact(new_lead)

                let partner = client && await main.readElement('res.partner', [['mobile', '=', client.mobile], ['name', '=', client.name]], ['id'], 0, 1)
                let partner_id = partner && partner.id
                if (!partner_id)
                    partner_id = await main.createElement({}, 'res.partner', client)

                new_lead.partner_id = partner_id

                let lead = await main.readElement('crm.lead', [['name', 'like', new_lead.name]], ['id'], 0, 1)

                if (lead && !lead.partner_id) {
                    console.log('existe lead: ', lead)
                    new_lead.id = lead.id
                    await main.updateElement('crm.lead', new_lead)
                } else {
                    let result = await main.createElement({}, 'crm.lead', new_lead)
                    console.log('create lead result: ', result)
                    new_lead.id = result
                    if (are_opportunity) {
                        result = await main.execute_kw('crm.lead', 'convert_opportunity', [
                            [new_lead.id], { partner_id }
                        ])
                        console.log('convert lead result: ', result)
                    }
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
var old_flectra
var new_flectra

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
        //x_password: "Password",
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

    let new_partner = {
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

    new_partner.id = await new_flectra.createElement({}, 'res.partner', new_partner) || false
    return new_partner
}

const createUser = async (user) => {
    let {
        name,
        login
    } = user

    let new_user = {
        name,
        login,
        customer: false
    }

    new_user.id = await new_flectra.createElement({}, 'res.users', new_user) || false
    return new_user
}


const createTeam = async (team) => {
    let {
        name,
        alias_name,
        user_id,
        member_ids
    } = team

    if (Array.isArray(user_id)) {
        let user_id_login = await old_flectra.readElement('res.users', [['id', '=', user_id[0]]], ['login'], 0, 1)
        let login = user_id_login && user_id_login.login
        let new_user = await new_flectra.readElement('res.users', [['login', '=', login]], ['id'], 0, 1)
        user_id = new_user && new_user.id
    }

    if (Array.isArray(member_ids)) {
        let members = await old_flectra.readElement('res.users', [['id', 'in', member_ids]], ['login'])
        let new_members = await new_flectra.readElement('res.users', [['login', 'in', members.map(member => member.login)]])
        member_ids = new_members && new_members.map(member => member.id)
    }

    let new_team = {
        name,
        alias_name,
        user_id,
        member_ids: [[6, 0, member_ids]]
    }

    new_team.id = await new_flectra.createElement({}, 'crm.team', new_team) || false
    return new_team
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

    let new_team = team_id && await create_if_not_exist_team({ old_team_id: team_id[0] })

    let new_stage = {
        name,
        team_id: new_team && new_team.id,
        on_change: on_change,
        probability: on_change && probability,
        fold: fold,
        requirements: requirements
    }

    new_stage.id = await new_flectra.createElement({}, 'crm.stage', new_stage) || false
    return new_stage
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

    let new_user = user_id && await create_if_not_exist_user({ old_user_id: user_id[0] })
    let new_partner = partner_id && await create_if_not_exist_partner({ old_partner_id: partner_id[0] })
    let new_team = team_id && await create_if_not_exist_team({ old_team_id: team_id[0] })
    let new_stage = stage_id && await create_if_not_exist_Stage({ old_stage_id: stage_id[0] })

    let new_lead = {
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
        partner_id: new_partner.id,
        user_id: new_user && new_user.id,
        team_id: new_team && new_team.id,
        stage_id: new_stage.id,
        notes: notes + ' \n ' + x_sourse_notes,
        color,
        activity_summary,
        activity_state,
        activity_date_deadline,
        activity_type_id: activity_type_id && activity_type_id[0],
        description
    }

    new_lead.id = await new_flectra.createElement({ default_type: type }, 'crm.lead', new_lead) || false
    return new_lead
}

const createCalendarEvent = async (calendar_event_id) => {
    let event = await old_flectra.readElement('calendar.event', [['id', '=', calendar_event_id]], 0, 0, 1)
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

    let exist = await new_flectra.readElement('calendar.event', [
        ['name', '=', name],
        ['res_model', '=', res_model],
        ['start_date', '=', start_date]
    ], ['id'], 0, 1)
    if (exist && exist.id) {
        return
    }

    let partners = await new_flectra.readElement('res.partner', [['id', 'in', partner_ids]], ['id'])
    if (Array.isArray(partners)) {
        partner_ids = [[6, 0, partners.map(partner => partner.id)]]
    }

    let new_user = user_id && await create_if_not_exist_user({ old_user_id: user_id[0] })
    let new_lead = opportunity_id && await create_if_not_exist_Lead({ old_lead_id: opportunity_id[0] })
    let new_partner = partner_id && await create_if_not_exist_partner({ old_partner_id: partner_id[0] })

    let new_event = {
        res_id: new_lead && new_lead.id,
        partner_ids,
        partner_id: new_partner && new_partner.id,
        res_model_id: res_model_id[0],
        user_id: new_user && new_user.id,
        opportunity_id: new_lead && new_lead.id,
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

    new_event.id = await new_flectra.createElement({}, 'calendar.event', new_event) || false
    return new_event
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

    let new_author = author_id && await create_if_not_exist_partner({ old_partner_id: author_id[0] })
    let new_parent = parent_id && await create_if_not_exist_Message({ old_message_ids: [parent_id[0]] })
    let new_res = new_res_id && { id: new_res_id } || await create_if_not_exist_Lead({ old_lead_id: res_id })

    let new_message = {
        subject,                            //String
        date,                               //String 
        email_from,                         //String    
        author_id: new_author && new_author.id,    //Array [23], res.partner    
        record_name,                            //String
        reply_to,                               //String
        parent_id: new_parent && new_parent[0] && new_parent[0].id,      //Array [22, 'mesegae], mail.message
        model,                              //String
        res_id: new_res && new_res.id,                             //Integer
        message_type,                       //String 

        body,                               //String
        message_id,                         //String
    }

    new_message.id = await new_flectra.createElement({}, 'mail.message', new_message)
    return new_message
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

    let exist = await new_flectra.readElement('mail.activity', [
        ['res_name', '=', res_name],
        ['display_name', '=', display_name],
        ['res_model', '=', res_model]
    ], ['id'], 0, 1)
    if (exist && exist.id) {
        return
    }

    let new_activity = {
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

    new_activity.id = await new_flectra.createElement({}, 'mail.activity', new_activity) || false
    return new_activity
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

    let new_user = user_id && await create_if_not_exist_user({ old_user_id: user_id[0] })
    let new_partner = partner_id && await create_if_not_exist_partner({ old_partner_id: partner_id[0] })
    let new_lead = opportunity_id && await create_if_not_exist_Lead({ old_lead_id: opportunity_id[0] })
    let newSummary = name && await new_flectra.readElement('crm.phonecall.summary', [['name', '=', name]], 0, 0, 1)

    let new_call = old_call && old_call.name && await new_flectra.readElement('crm.phonecall', [
        ['name', '=', name],
        ['description', '=', description],
        ['summary_id', '=', newSummary && newSummary.id],
        ['partner_id', '=', new_partner && new_partner.id],
        ['opportunity_id', '=', new_lead && new_lead.id]
    ], ['id'], 0, 1)

    if (new_call && new_call.id) {
        return new_call
    }

    let new_phonecall = {
        description,
        name,
        summary_id: newSummary && newSummary.id,
        partner_id: new_partner && new_partner.id,
        opportunity_id: new_lead && new_lead.id,
        user_id: new_user && new_user.id
    }

    new_phonecall.id = await new_flectra.createElement({}, 'crm.phonecall', new_phonecall)
    return new_phonecall
}

const createOrder = async (order) => {
    let {
        date_order,
        partner_id, //cliente:
        validity_date, //fecha_caducidad: 
        //payment_term_id, //plazo_de_pago:
        user_id,
        team_id,
        //discount_method, //tipo_descuentos:
        //discount_amount, //descuento: 
        client_order_ref,
    } = order

    let new_user = user_id && await create_if_not_exist_user({ old_user_id: user_id[0] })
    let new_partner = partner_id && await create_if_not_exist_partner({ old_partner_id: partner_id[0] })
    let new_team = team_id && await create_if_not_exist_team({ old_team_id: team_id[0] })

    let new_order = {
        state: 'draft',
        date_order,
        validity_date, //fecha_caducidad: 
        user_id: new_user && new_user.id,
        team_id: new_team && new_team.id,
        partner_id: new_partner && new_partner.id, //cliente:
        //discount_method, //tipo_descuentos:
        //discount_amount, //descuento: 
        client_order_ref,
        payment_term_id: null
    }

    new_order.id = await new_flectra.createElement({}, 'sale.order', new_order)
    return new_order
}

const createOrderLine = async (orderLine) => {
    let {
        order_id,
        layout_category_id,
        name,
        product_id,
        price_unit, //precio
        product_uom_qty, //cantidad:
        qty_delivered,
    } = orderLine

    let new_product = product_id && await create_if_not_exist_product({ old_product_id: product_id[0] })
    let new_order = order_id && await create_if_not_exist_Order({ old_order_id: order_id[0] })

    let new_order_line = {
        order_id: new_order && new_order.id,
        layout_category_id: layout_category_id && layout_category_id.id,
        name,
        product_id: new_product && new_product.id,
        price_unit, //precio
        product_uom_qty, //cantidad:
        qty_delivered,
    }

    new_order_line.id = await new_flectra.createElement({}, 'sale.order.line', new_order_line)
    return new_order_line
}

const createProduct = async (product) => {
    let {
        name,
        default_code,
        sale_ok,
        purchase_ok,
        type,
        categ_id,
        lst_price, //precio_de_venta: 
        standard_price, //costo: 
        invoice_policy, //politica_facturacion: 
        sequence,
        // taxes_id: [[6, 0, [taxes_id]]], //impuestosde_cliente: 
        description, //descripcion_interna: 
        description_sale //descripcion_para_cliente: 
    } = product

    let new_product = {
        name,
        default_code,
        sale_ok,
        purchase_ok,
        type,
        categ_id: categ_id && categ_id.id,
        lst_price, //precio_de_venta: 
        standard_price, //costo: 
        invoice_policy, //politica_facturacion: 
        sequence,
        // taxes_id: [[6, 0, [taxes_id]]], //impuestosde_cliente: 
        description, //descripcion_interna: 
        description_sale //descripcion_para_cliente: 
    }

    new_product.id = await new_flectra.createElement({}, 'product.product', new_product)
    return new_product
}

const create_account_tag = async (tag) => {
    let {
        name
    } = tag

    let new_tag = {
        name
    }

    new_tag.id = await new_flectra.createElement({}, 'account.analytic.tag', new_tag)
    return new_tag
}

const create_invoice_line = async (invoice_line) => {
    let {
        account_id,
        name,
        product_id,
        layout_category_id,
        analytic_tag_ids,
        quantity,
        price_unit,
        //invoice_line_taxt_id: [[6, 0, [invoice_line_taxt_id]]]
    } = invoice_line

    let new_account = account_id && await get_account({ old_account_id: account_id[0] })
    let new_product = await get_membership_product()
    let new_tag = analytic_tag_ids && analytic_tag_ids[0] && await create_if_not_exist_account_tag({ old_account_tag_id: analytic_tag_ids[0] })

    let new_invoice_line = {
        account_id: new_account && new_account.id,
        name,
        product_id: new_product && new_product.id,
        layout_category_id: layout_category_id && layout_category_id.id,
        analytic_tag_ids: new_tag && new_tag.id && [[6, 0, [new_tag.id]]],
        quantity,
        price_unit,
        //invoice_line_taxt_id: [[6, 0, [invoice_line_taxt_id]]]
    }

    new_invoice_line.id = await new_flectra.createElement({}, 'account.invoice.line', new_invoice_line)
    return new_invoice_line
}

const create_invoice = async (invoice) => {
    let {
        currency_id,
        account_id,
        name,
        state,
        partner_id,
        date_invoice,
        date_due,
        user_id,
        team_id,
        origin,
        invoice_line_ids,
        payment_term_id,
        comment,
        x_type
    } = invoice

    let new_account = account_id && await get_account({ old_account_id: account_id[0] })
    let new_partner = account_id && await create_if_not_exist_partner({ old_partner_id: partner_id[0] })
    let new_user = user_id && await create_if_not_exist_user({ old_user_id: user_id[0] })
    let new_team = team_id && await create_if_not_exist_team({ old_team_id: team_id[0] })
    let new_payment_term = payment_term_id && await get_payment_term({ old_payment_term_id: payment_term_id[0] })
    let new_invoice_line = invoice_line_ids && await create_if_not_exist_invoice_line({ old_invoice_line_id: invoice_line_ids[0] })

    let new_invoice = {
        currency_id: currency_id && currency_id[0],
        account_id: new_account && new_account.id,
        name,
        state: 'draft',
        partner_id: new_partner && new_partner.id,
        date_invoice,
        date_due,
        user_id: new_user && new_user.id,
        team_id: new_team && new_team.id,
        //origin,
        invoice_line_ids: new_invoice_line && [
            [6, 0, [new_invoice_line.id]]
        ],
        payment_term_id: new_payment_term && new_payment_term.id,
        comment: `${state} \n ${comment || ''}`,
        x_type
    }

    new_invoice.id = new_flectra.createElement({}, 'account.invoice', new_invoice)
    return new_invoice
}

const create_account = async (account) => {
    let {
        code,
        name,
        user_type_id,
        currency_id,
        reconcile
    } = account


    let new_account = {
        code,
        name,
        user_type_id: user_type_id && user_type_id[0],
        currency_id: currency_id && currency_id[0],
        reconcile
    }

    new_account.id = new_flectra.createElement({}, 'account.account', new_account)
    return new_account
}

const create_journal = async (journal) => {
    let {
        name,
        type,
        code,
        show_on_dashboard,
        default_debit_account_id,
        default_credit_account_id,
        currency_id
    } = journal

    let new_debit_account = default_debit_account_id && await create_if_not_exist_account({ old_account_id: default_debit_account_id[0] })
    let new_credit_account = default_credit_account_id && await create_if_not_exist_account({ old_account_id: default_credit_account_id[0] })
    let same_currency = currency_id && await compare_with_company_currency(currency_id[0])

    let new_journal = {
        name,
        type,
        code,
        show_on_dashboard,
        default_debit_account_id: new_debit_account && new_debit_account.id,
        default_credit_account_id: new_credit_account && new_credit_account.id
    }

    /* if (!same_currency)
        new_journal.currency_id =  currency_id && currency_id[0] */

    new_journal.id = new_flectra.createElement({}, 'account.journal', new_journal)
    return new_journal
}

///////////////////////////////////////////////////////////// GET ///////////////////////////////////////////////////////////////////

const get_payment_term = async ({ old_payment_term, old_payment_term_id }) => {
    old_payment_term = old_payment_term || await old_flectra.readElement(
        'account.payment.term',
        [['id', '=', old_payment_term_id]],
        0, 0, 1)
    let new_element = old_payment_term && await new_flectra.readElement(
        'account.payment.term',
        [['name', '=', '30 Net Days']],
        ['id'], 0, 1)
    return new_element
}

const get_account = async ({ old_account, old_account_id }) => {
    old_account = old_account || await old_flectra.readElement('account.account', [['id', '=', old_account_id]], 0, 0, 1)
    let new_element = old_account && await new_flectra.readElement(
        'account.account',
        [
            ['code', '=', '105.01.01']
        ],
        ['id'], 0, 1)
    return new_element
}

const get_membership_product = async () => {
    let new_element = await new_flectra.readElement(
        'product.product',
        [
            ['default_code', '=', 'membresia']
        ],
        ['id'], 0, 1)
    return new_element
}

const get_currency = async (name) => {
    let currency = new_flectra.readElement(
        'res.currency',
        [
            ['name', '=', name]
        ],
        ['id'], 0, 1)

    return currency
}

const compare_with_company_currency = async (currency_id) => {
    let company = new_flectra.readElement('res.company', [['id', '=', 1]], ['currency_id'], 0, 1)
    return company && company.currency_id && company.currency_id[0] === currency_id
}

///////////////////////////////////////////////////////////// create_if_not_exist ///////////////////////////////////////////////////////////////////

const create_if_not_exist_user = async ({ old_user_id, old_user }) => {
    old_user = old_user || await old_flectra.readElement('res.users', [['id', '=', old_user_id]], ['name', 'login'], 0, 1)
    let new_user = old_user && old_user.login && await new_flectra.readElement('res.users', [
        ['login', '=', old_user.login]
    ], ['id'], 0, 1)
    if (!new_user && old_user) {
        new_user = await createUser(old_user)
    }
    return new_user
}

const create_if_not_exist_partner = async ({ old_partner_id, old_partner }) => {
    old_partner = old_partner || await old_flectra.readElement('res.partner', [
        ['id', '=', old_partner_id]
    ], 0, 0, 1)
    let new_partner = old_partner && old_partner.name && await new_flectra.readElement('res.partner', [
        ['name', '=', old_partner.name],
        ['phone', '=', old_partner.phone]
    ], ['id'], 0, 1)
    if (!new_partner && old_partner) {
        new_partner = await createClient(old_partner)
    }
    return new_partner
}

const create_if_not_exist_team = async ({ old_team_id, old_team }) => {
    old_team = old_team || await old_flectra.readElement('crm.team', [
        ['id', '=', old_team_id]
    ], 0, 0, 1)
    let new_team = old_team && await new_flectra.readElement('crm.team', [
        ['name', '=', old_team.name]
    ], 0, 0, 1)
    if (!new_team && old_team) {
        new_team = await createTeam(old_team)
    }
    return new_team
}

const create_if_not_exist_Stage = async ({ old_stage_id, old_stage }) => {
    old_stage = old_stage || await old_flectra.readElement('crm.stage', [
        ['id', '=', old_stage_id]
    ], ['name'], 0, 1)
    let new_stage = old_stage && old_stage.name && await new_flectra.readElement('crm.stage', [
        ['name', '=', old_stage.name]
    ], ['id'], 0, 1)
    if (!new_stage && old_stage) {
        new_stage = await createStage(old_stage)
    }
    return new_stage
}

const create_if_not_exist_Message = async ({ old_message_ids, old_message }) => {
    let messages = old_message && [old_message] || await old_flectra.readElement('mail.message', [
        ['id', 'in', old_message_ids]
    ])
    let new_message_ids = []
    let index = 0
    while (index < messages.length) {
        let message = messages[index]
        let new_message = await new_flectra.readElement('mail.message', [
            ['message_id', '=', message.message_id]
        ], 0, 0, 1)
        if (!new_message) {
            new_message = await createMessage(message)
        }
        new_message_ids.push(new_message.id)
        index++
    }
    return new_message_ids
}

const create_if_not_exist_Lead = async ({ old_lead_id, old_lead }) => {
    old_lead = old_lead || await old_flectra.readElement('crm.lead', [
        ['id', '=', old_lead_id]
    ], 0, 0, 1)
    let new_lead = old_lead && await new_flectra.readElement('crm.lead', [
        ['name', '=', old_lead.name]
    ], 0, 0, 1)
    if (!new_lead) {
        new_lead = await createLead(old_lead)
    }
    return new_lead
}

const create_if_not_exist_Order = async ({ old_order_id, old_order }) => {
    old_order = old_order || await old_flectra.readElement('sale.order', [['id', '=', old_order_id]], ['name', 'login'], 0, 1)
    let new_order = old_order && await new_flectra.readElement('sale.order', [
        ['client_order_ref', '=', old_order.client_order_ref]
    ], ['id'], 0, 1)
    if (!new_order && old_order) {
        new_order = await createOrder(old_order)
    }
    return new_order
}

const create_if_not_exist_product = async ({ old_product_id, old_product }) => {
    old_product = old_product || await old_flectra.readElement('sale.product', [['id', '=', old_product_id]], ['name', 'login'], 0, 1)
    let new_product = old_product && await new_flectra.readElement('sale.product', [
        ['name', '=', old_product.name]
    ], ['id'], 0, 1)
    if (!new_product && old_product) {
        new_product = await createProduct(old_product)
    }
    return new_product
}



const create_if_not_exist_account_tag = async ({ old_account_tag, old_account_tag_id }) => {
    old_account_tag = old_account_tag || await old_flectra.readElement(
        'account.analytic.tag',
        [['id', '=', old_account_tag_id]],
        0, 0, 1)
    let new_element = old_account_tag && await new_flectra.readElement(
        'account.analytic.tag',
        [['name', '=', old_account_tag.name]],
        ['id'], 0, 1)
    if (!new_element && old_account_tag) {
        new_element = await create_account_tag(old_account_tag)
    }
    return new_element
}

const create_if_not_exist_invoice_line = async ({ old_invoice_line, old_invoice_line_id }) => {
    old_invoice_line = old_invoice_line || await old_flectra.readElement(
        'account.invoice.line',
        [['id', '=', old_invoice_line_id]],
        0, 0, 1)
    let new_element = old_invoice_line && await new_flectra.readElement(
        'account.invoice.line',
        [['name', '=', old_invoice_line.name]],
        ['id'], 0, 1)
    if (!new_element && old_invoice_line) {
        new_element = await create_invoice_line(old_invoice_line)
    }
    return new_element
}

const create_if_not_exist_invoice = async ({ old_invoice, old_invoice_id }) => {
    old_invoice = old_invoice || await old_flectra.readElement(
        'account.invoice',
        [['id', '=', old_invoice_id]],
        0, 0, 1)
    let new_element = old_invoice && await new_flectra.readElement(
        'account.invoice',
        [['name', '=', old_invoice.name]],
        ['id'], 0, 1)
    if (!new_element && old_invoice) {
        new_element = await create_invoice(old_invoice)
    }
    return new_element
}

const create_if_not_exist_account = async ({ old_account, old_account_id }) => {
    old_account = old_account || await old_flectra.readElement(
        'account.account',
        [['id', '=', old_account_id]],
        0, 0, 1)
    let new_element = old_account && await new_flectra.readElement(
        'account.account',
        [['code', '=', old_account.code]],
        ['id'], 0, 1)
    if (!new_element && old_account) {
        new_element = await create_account(old_account)
    }
    return new_element
}

const create_if_not_exist_journal = async ({ old_journal, old_journal_id }) => {
    old_journal = old_journal || await old_flectra.readElement(
        'account.journal',
        [['id', '=', old_journal_id]],
        0, 0, 1)
    let new_element = old_journal && await new_flectra.readElement(
        'account.journal',
        [['name', '=', old_journal.name]],
        ['id'], 0, 1)
    if (!new_element && old_journal) {
        new_element = await create_journal(old_journal)
    }
    return new_element
}



///////////////////////////////////////////////////////////// UPDATE //////////////////////////////////////////////////////////////////////
const updateLeadActivities = async (lead = {}, activity_ids = []) => {
    let activities = await old_flectra.readElement('mail.activity', [['id', 'in', activity_ids]])
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
    let phonecalls = await old_flectra.readElement('crm.phonecall', [['id', 'in', phonecall_ids]], 0, 0, 0)
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

        let new_phonecall = await new_flectra.readElement('crm.phonecall', [
            ['name', '=', name],
            ['description', '=', description],
            ['partner_id', '=', lead.partner_id && lead.partner_id[0]],
            ['user_id', '=', lead.user_id && lead.user_id[0]],
            ['date', '=', date]
        ], 0, 0, 1)

        if (new_phonecall) {
            return new_phonecall
        }

        console.log(summary_ids, x_subject, summary_ids[x_subject], name, summary_ids[name])
        if (summary_ids[x_subject]) {
            let newSummary = await new_flectra.readElement('crm.phonecall.summary', [['name', '=', x_subject]], ['id'], 0, 1)

            let new_phonecall = {
                description,
                name: x_subject,
                summary_id: newSummary && newSummary.id,
                partner_id: lead.partner_id && lead.partner_id[0],
                opportunity_id: lead.id,
                user_id: lead.user_id[0],
                date
            }

            await new_flectra.createElement({}, 'crm.phonecall', new_phonecall)
            console.log('phonecall: ', index++, phonecall)
        }
        index++
    }
}

const updateEmptyPartnerLeads = async (leads) => {
    leads.forEach(async lead => {
        await s.acquire()
        try {
            console.log(s.nrWaiting() + ' calls to updatelead are waiting')
            let new_lead = await create_if_not_exist_Lead({ old_lead: lead })
            if (new_lead && (!new_lead.contact_name || !new_lead.partner_id)) {
                let new_partner = lead.partner_id && await create_if_not_exist_partner({ old_partner_id: lead.partner_id[0] })
                let leadForUpdate = {
                    id: new_lead.id,
                    partner_id: new_partner.id,
                    contact_name: lead.contact_name
                }
                await new_flectra.updateElement('crm.lead', leadForUpdate)
            }
        } finally {
            s.release();
        }
    })
}

const updateLeadDescriptions = async (leads) => {
    leads.forEach(async lead => {
        await s.acquire()
        try {
            console.log(s.nrWaiting() + ' calls to updatelead are waiting')
            let new_lead = await create_if_not_exist_Lead({ old_lead: lead })
            if (new_lead) {
                let leadForUpdate = {
                    id: new_lead.id,
                    description: formatNotes(lead)
                }
                await new_flectra.updateElement('crm.lead', leadForUpdate)
            }
        } finally {
            s.release();
        }
    })
}


/////////////////////////////////////////////////////////////// LOAD /////////////////////////////////////////////////////////////////////////////
const loadMessages = async (elements = []) => {
    let elementIndex = 0
    while (elementIndex < elements.length) {
        let element = elements[elementIndex]
        let message_ids = element.message_ids
        let messages = await old_flectra.readElement('mail.message', [['id', 'in', message_ids]])
        console.log(messages.length)
        try {
            let index = 0
            console.log('index: ', index)
            while (index < messages.length) {
                console.log('index: ', index)
                let message = messages[index]
                //await s.acquire()
                try {
                    console.log(s.nrWaiting() + ' calls to create_if_not_exist_Message are waiting')
                    await create_if_not_exist_Message({ old_message: message })

                } finally {
                    // s.release();
                }
                index++
                console.log('message: ', index)
            }
        } catch (error) {
            console.log(error)
        }
        elementIndex++
    }
}

const loadCRMLeads = async (leads = []) => {
    leads.forEach(async lead => {
        await s.acquire()
        try {
            console.log(s.nrWaiting() + ' calls to create_if_not_exist_Lead are waiting')
            let new_lead = await create_if_not_exist_Lead({ old_lead: lead })
            if (new_lead && new_lead.id) {
                await updatePhoneCalls(new_lead, lead.phonecall_ids)
                await updateLeadActivities(new_lead, lead.activity_ids)
            }
        } finally {
            s.release();
        }
    })
}

const loadCRMPhonecallSummary = async () => {
    let summarys = await old_flectra.readElement('crm.phonecall.summary', [], ['name'], 0, 0)
    summarys.forEach(async summary => {
        let exist = await new_flectra.readElement('crm.phonecall.summary', [['name', '=', summary.name]], ['name'], 0, 1)
        if (!exist) {
            await new_flectra.createElement({}, 'crm.phonecall.summary', { name: summary.name })
        }
    })
}

const loadPhoneCalls = async () => {
    let leads = await old_flectra.readElement('crm.lead', [])
    let index = 592
    while (index > 300) {
        let lead = leads[index]
        let new_lead = await create_if_not_exist_Lead({ old_lead: lead })
        await updatePhoneCalls(new_lead, lead.phonecall_ids)
        index--
        console.log(index)
    }
}

const loadCRMStages = async () => {
    let stages = await old_flectra.readElement('crm.stage', [], 0, 0, 0)
    stages.forEach(async stage => {
        await create_if_not_exist_Stage({ old_stage: stage })
    })
}

const loadCRMTeams = async () => {
    let teams = await old_flectra.readElement('crm.team', [], 0, 0, 0)
    teams.forEach(async team => {
        await create_if_not_exist_team({ old_team: team })
    })
}

const loadUsers = async () => {
    let users = await old_flectra.readElement('res.users', [], 0, 0, 0)
    users.forEach(async user => {
        await s.acquire()
        try {
            console.log(s.nrWaiting() + ' calls to create_if_not_exist_user are waiting')
            await create_if_not_exist_user({ old_user: user })
        } finally {
            s.release();
        }
    })
}

const loadPartners = async () => {
    let partners = await old_flectra.readElement('res.partner', [], 0, 0, 0)
    partners.forEach(async partner => {
        await s.acquire()
        try {
            console.log(s.nrWaiting() + ' calls to create_if_not_exist_partner are waiting')
            await create_if_not_exist_partner({ old_partner: partner })
        } finally {
            s.release();
        }
    })
}

const loadInvoices = async (invoices) => {
    invoices.forEach(async invoice => {
        await s.acquire()
        try {
            console.log(s.nrWaiting() + ' calls to create_if_not_exist_invoice are waiting')
            await create_if_not_exist_invoice({ old_invoice: invoice })
        } finally {
            s.release();
        }
    })
}

const loadAccounts = async (accounts) => {
    accounts.forEach(async account => {
        await s.acquire()
        try {
            console.log(s.nrWaiting() + ' calls to create_if_not_exist_account are waiting')
            await create_if_not_exist_account({ old_account: account })
        } finally {
            s.release();
        }
    })
}

const loadJournals = async (journals) => {
    journals.forEach(async journal => {
        await s.acquire()
        try {
            console.log(s.nrWaiting() + ' calls to create_if_not_exist_journal are waiting')
            await create_if_not_exist_journal({ old_journal: journal })
        } finally {
            s.release();
        }
    })
}
let fields = { stage_id: 15 }
const updateLeadFields = async (leads = []) => {
    try {
        let size = leads.length
        let index = 0
        while (index < size) {
            let lead = leads[index]
            let newLead = {
                id: lead.id
            }
            for (let fieldName in fields) {
                newLead[fieldName] = fields[fieldName]
            }
            await old_flectra.updateElement('crm.lead', lead)
            index++
        }
        await s.acquire()
    } finally {
        s.release();
    }
}

const workWithThis = async (model, filter = [], callback) => {
    let start = 0
    let amount = 100
    let flag = true
    while (flag) {
        await s.acquire()
        try {
            let elements = await old_flectra.readElement(model, filter, 0, start, amount)
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

const reservations = [
    ['name', 'like', 'RESERV:']
]


let date_start = '2019-07-01'
let date_end = '2020-01-31'
const invoicesFilter = [
    ['date', '>=', date_start],
    ['date', '<=', date_end]
]

const main = async () => {
    old_flectra = new Flectra(oldDeployData)
    new_flectra = new Flectra(newDeployData)
    await old_flectra.connect(oldDeployData)
    //await new_flectra.connect(newDeployData)
    //let filter = luisFilter
    //await loadCRMPhonecallSummary()   //1
    //await loadCRMStages()             //2
    //await loadUsers()                 //3
    //await loadCRMTeams()              //4
    //await loadPartners()              //5
    //await loadCRMLeads(filter)              //6
    //await loadPhoneCalls()
    //await loadMessages(filter)
    //await workWithThis('crm.lead', filter, loadCRMLeads)
    //await workWithThis('crm.lead', filter, loadMessages)
    //await workWithThis('crm.lead', referidosFilter, updateLeads)
    //await workWithThis('account.invoice', invoicesFilter, loadInvoices)
    //await workWithThis('account.invoice', invoicesFilter, loadMessages)
    //await workWithThis('account.journal', [], loadAccounts)
    //await workWithThis('account.journal', [], loadJournals)
    //await workWithThis('crm.lead', reservations, updateLeadDescriptions)
}

const formatDate = (date) => {
    if (!date)
        return

    date.setSeconds(0)
    date = date.toISOString()
    date = date.replace(/T/, ' ').replace(/\..+/, '')
    let time = date.split(' ')[1]
    if (time) {
        let hours = parseInt(time.split(':')[0])
        let minutes = parseInt(time.split(':')[1])
        let seconds = parseInt(time.split(':')[2])
        if (seconds > 59) {
            minutes = minutes + Math.trunc(seconds / 60)
            seconds = seconds % 60
        }

        date = date.split(' ')[0] + ` ${hours}:${minutes}:${seconds}`
    }
    return date
}

const validateDateRange = (date_invoice) => {
    if (!date_invoice) {
        return false
    }

    let invoiceDate = new Date(date_invoice)
    let finaldate = new Date()

    var months;
    months = (invoiceDate.getFullYear() - finaldate.getFullYear()) * 12;
    months -= finaldate.getMonth() + 1;
    months += invoiceDate.getMonth();
    return months <= 6
}

module.exports = {
    processXLSXToLeads,
    updateLeadFields,
    workWithThis,
    main
}