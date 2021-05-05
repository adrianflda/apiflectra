const { processXLSXToLeads, updateLeadFields, workWithThis } = require("./api");
const crm_name = "B2C";
const country_name = "Mexico";
const state_name = "";
const agent_login = "erik.cruz@vacancyrewards.com";

// processXLSXToLeads({ crm_name, country_name, state_name, agent_login });

//API.workWithThis('crm.lead', [['stage', '=', false]], updateLeadFields) //for update some fields valuess

const Flectra = require("./flectra");
const main = new Flectra();

const changeName = (element) => {
  const regex = /-MTY/gi;
  element.name = element.name.replace(regex, "");
  return element;
};

const mergeOpportunity = async (ids) => {
  return await main.mergeOpportunity(ids);
};

const mergeOpportunities = (allduplicates) => {
  allduplicates.forEach((element) => {
    mergeOpportunity(element);
  });
};

const findDuplicated = (leads, name) => {
  return leads.find((lead) => {
    return lead.name === name;
  });
};

const loadAllduplicates = (leads = []) => {
  const allduplicates = [];
  leads.forEach((lead) => {
    let duplicates = findDuplicated(leads, lead) || [];
    allduplicates.push(duplicates.map((element) => element.id));
  });
  return allduplicates;
};

const updateElement = async (model, element) => {
  await main.updateElement(model, element);
};

const updateElements = async (model, elements, doSomeThing) => {
  let index = 0;
  for (let element of elements) {
    element = doSomeThing(element);
    await updateElement(model, element);
    console.log(index++, elements.length - index);
  }
};

const search = async (model, filter, fields, limit) => {
  return await main.readElement(model, filter, fields, 0, limit);
};

const init = async () => {
  await main.connect();
};

/* (async () => {
  await init();
  const model = "crm.lead";
  const filter = [
    ["name", "ilike", "AGENTLEADS-MONTERREY"],
    ["stage_id", "=", 15],
  ];
  const fields = ["id", "name", "stage_id"];

  const elements = await search(model, filter, fields);
  console.log(elements && elements.length);

  const duplicates = loadAllduplicates(elements);

  mergeOpportunities(duplicates);
})(); */

(async () => {
  await init();
  const model = "crm.lead";
  //const filter = ['&', ["name", "ilike", "MEMB.WCALL"], ['active', '=', false]]
  const filter = [
    ["write_uid", "=", 243],
    ["type", "=", "opportunity"],
    ["active", "!=", true],
    ["write_date", ">", "2021-05-01T00:00:00.000Z"],
  ];

  const fields = ["id", "name"];

  const elements = (await search(model, filter, fields)) || [];
  console.log(elements.length);

  await updateElements(model, elements, (element) => ({
    ...element,
    active: true,
  }));
})();
