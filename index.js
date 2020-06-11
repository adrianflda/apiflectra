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

const updateElement = async (model, element) => {
  await main.updateElement(model, element);
};

const updateElements = async (model, elements, doSomeThing) => {
  let index = 0;
  for (let element of elements) {
    await doSomeThing(element);
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

(async () => {
  await init();
  const model = "crm.lead";
  const filter = [["name", "ilike", "agentleads-mty-monterrey"]];
  const fields = ["id", "name"];

  const elements = await search("crm.lead", filter, fields);
  console.log(elements && elements.length);

  await updateElements(model, elements, changeName);
})();
