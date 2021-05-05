const Flectra = require("./flectra");
const main = new Flectra();

const PRODUCT_PRODUCT = "product.product";
const SALE_ORDER = "sale.order";
const SALE_LAYOUT_CATEGORY = "sale.layout_category";
const ACCOUNT_INVOICE = "account.invoice";
const ACCOUNT_INVOICE_LINE = "account.invoice.line";
const ACCOUNT_PAYMENT = "account.payment";
const ACCOUNT_PAYMENT_TERM = "account.payment.term";
const ACCOUNT_ACCOUNT = "account.account";
const RES_CURRENCY = "res.currency";
const CRM_TEAM = "crm.team";
const ACCOUNT_ANALYTIC_TAG = "account.analytic.tag";
const RES_USERS = "res.users";

const cancel = (invoice) => {
  try {
    main.cancelInvoice({ invoice });
  } catch (error) {
    console.log(error);
  }
};

const paid = (invoice) => {
  try {
    invoice.state = "paid";
    main.updateInvoice({ invoice });
  } catch (error) {
    console.log(error);
  }
};

const search = async (model, filter, fields, limit) => {
  return await main.readElement(model, filter, fields, 0, limit);
};

const updateInvoiceLine = async (id, fields) => {
  let invoice_line = { id };
  for (let field in fields) {
    invoice_line[field] = fields[field];
  }
  return await main.updateElement(ACCOUNT_INVOICE_LINE, invoice_line);
};

const updateInvoice = async (id, fields) => {
  let invoice = { id };
  for (let field in fields) {
    invoice[field] = fields[field];
  }
  main.updateInvoice({ invoice });
};

const getComercial = async (email) => {
  let user = await main.readElement(
    "res.users",
    [["login", "=", email], "|", ["active", "=", false], ["active", "=", true]],
    ["id"],
    0,
    1
  );
  return user && user.id;
};

const getProductId = async (filter) => {
  let product = await main.readElement(PRODUCT_PRODUCT, filter, ["id"], 0, 1);
  return product && product.id;
};

const unlinkPayment = async ({ id, name }) => {
  const filter = id ? [["id", "=", id]] : [["name", "=", name]];
  const payment = await main.readElement(ACCOUNT_PAYMENT, filter, ["id"], 0, 1);
  payment && (await main.deleteElement(ACCOUNT_PAYMENT, payment.id));
};

const updatePayment = async (payment) => {
  return await main.updateElement(ACCOUNT_PAYMENT, payment);
};

const statePaid = ["state", "=", "paid"];
const stateOpen = ["state", "=", "open"];
const stateDraft = ["state", "=", "draft"];
const stateCanceled = ["state", "=", "canceled"];
const stateUnReconciled = ["reconciled", "=", false];
const stateReconciled = ["reconciled", "=", true];
const statePayments = ["payment_ids", "!=", false];
const stateNoPayments = ["payment_ids", "=", false];
const stateNoPaymentsWidget = ["payments_widget", "like", "false"];
const statePaymentsWidget = ["payments_widget", "not like", "false"];
const payments_widget =
  '{"content": [{"invoice_id": false, "position": "before", "name": "Customer Payment: INV/2020/0629", "move_id": 1429, "date": "2020-09-21", "amount": 1059.29, "journal_name": "TPV BBVA Astuto", "digits": [69, 2], "account_payment_id": 1192, "currency": "$", "payment_id": 2865, "ref": "TPVAS/2020/0277 (MTYVR000337: (MENSUALIDAD => 5)INV/2020/0629)"}], "outstanding": false, "title": "Less Payment"}';

const workWithThis = async (model, filter = [], fields) => {
  let start = 0;
  let amount = 100;
  let flag = true;
  let result = [];
  while (flag) {
    try {
      let elements =
        (await main.readElement(model, filter, fields, start, amount)) || [];
      console.log(
        `******************* ${model} Elements: `,
        elements && elements.length,
        "******************************"
      );
      if (elements.length) result = result.concat([...elements]);
      console.log(
        `-----------------------  ${model} result: `,
        result && result.length,
        "-----------------------"
      );
      flag = elements.length > 0;
      start += amount;
    } catch (error) {
      console.error(error);
    }
  }
  return result;
};

const init = async () => {
  await main.connect();
};

const changeAccountId = async () => {
  const model = ACCOUNT_INVOICE;
  const filter = [["account_id", "!=", 3]];
  const fields = ["id", "name"];

  await workWithThis(model, filter, fields, async ({ id, name }) => {
    //await updateInvoice(id, { account_id: 3 })
    console.log(name);
  });
};

const addProduct = async (id) => {
  let product_id = await getProductId([["barcode", "=", "123456789"]]);
  if (!product_id) return;

  const model = ACCOUNT_INVOICE_LINE;
  const filter = id
    ? [["invoice_id", "=", id]]
    : [
        ["account_id", "!=", 27],
        ["name", "like", "MTYVR000053"],
      ];
  const fields = ["id", "name", "price_unit"];

  let elements = await workWithThis(model, filter, fields);
  for (let { id, price_unit, name } of elements) {
    await updateInvoiceLine(id, { price_unit, product_id, account_id: 27 });
    console.log(name, product_id, price_unit);
  }
};

const toDraft = async (filter) => {
  const model = ACCOUNT_INVOICE;
  filter = filter || [stateDraft, statePayments];
  const fields = ["id", "name", "number", "payments_widget"];

  let elements = await workWithThis(model, filter, fields);
  for (let element of elements) {
    let { id, name, number, payments_widget } = element;
    // await updateInvoice(id, { state: "draft" });
    //await addProduct(id);
    console.log(element);
  }
};

(async () => {
  await init();
  let elements =
    (await main.readElement(
      ACCOUNT_INVOICE,
      [["name", "ilike", "mty"]],
      ["id", "invoice_ids", "state"]
    )) || [];
  elements.map((e) => {
    console.log(e);
    e.state = "cancelled";
    e.invoice_ids = false;
    //updatePayment(e);
  });
})();
