const { processXLSXToLeads, updateLeadFields, workWithThis } = require('./api')
const crm_name = 'B2C'
const country_name = 'Mexico'
const state_name = ''
const agent_login = 'erik.cruz@vacancyrewards.com'

processXLSXToLeads({
    crm_name,
    country_name, 
    state_name, 
    agent_login })

//API.workWithThis('crm.lead', [['stage', '=', false]], updateLeadFields) //for update some fields valuess
