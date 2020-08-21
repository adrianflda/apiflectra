const Flectra = require("./flectra");
const main = new Flectra();

const PRODUCT_PRODUCT = "product.product";
const SALE_ORDER = "sale.order";
const SALE_LAYOUT_CATEGORY = "sale.layout_category";
const ACCOUNT_INVOICE = "account.invoice";
const ACCOUNT_INVOICE_LINE = "account.invoice.line";
const ACCOUNT_PAYMENT_TERM = "account.payment.term";
const ACCOUNT_ACCOUNT = "account.account";
const RES_CURRENCY = "res.currency";
const CRM_TEAM = "crm.team";
const ACCOUNT_ANALYTIC_TAG = "account.analytic.tag";
const RES_USERS = "res.users";

const cancel = (invoice) => {
    try {
        main.cancelInvoice({ invoice })
    } catch (error) {
        console.log(error)
    }
}

const paid = (invoice) => {
    try {
        invoice.state = 'paid'
        main.updateInvoice({ invoice })
    } catch (error) {
        console.log(error)
    }
}

const search = async (model, filter, fields, limit) => {
    return await main.readElement(model, filter, fields, 0, limit);
};

const updateInvoiceLine = async (invoice_id) => {
    let invoice_line = await main.readElement(ACCOUNT_INVOICE_LINE, [['invoice_id', '=', invoice_id]], ['id', 'account_id']) || []
    for (let { id } of invoice_line) {
        await main.updateElement(ACCOUNT_INVOICE_LINE, { id, account_id: 27 })
    }
}

const updateInvoice = async (id, fields) => {
    let invoice = { id }
    for (let field in fields) {
        invoice[field] = fields[field]
    }
    main.updateInvoice({ invoice })
}

const getComercial = async (email) => {
    let user = await main.readElement('res.users', [['login', '=', email], '|', ['active', '=', false], ['active', '=', true]], ['id'], 0, 1)
    return user && user.id
}

const workWithThis = async (model, filter = [], callback) => {
    let start = 0
    let amount = 100
    let flag = true
    while (flag) {
        try {
            let elements = await main.readElement(model, filter, ['id', 'name'], start, amount)
            await callback(elements)
            flag = elements.length > 0
            start += amount
        } catch (error) {
            console.error(error)
        }
    }
}

const init = async () => {
    await main.connect();
};

(async () => {
    await init();
    let julio_user_id = await getComercial('julio.santamaria@vacancyrewards.com')
    let user_id = await getComercial('karina.jankovsky@vacancyrewards.com')

    const model = "account.invoice";
    const filter = [["user_id", "=", julio_user_id], '|', ['state', '=', 'open'], ['state', '=', 'draft']];

    workWithThis(model, filter, async (elements) => {
        for (let { id, name } of elements) {
            console.log(name, 'begin')
            await updateInvoice(id, { user_id, account_id: 3 })
            await updateInvoiceLine(id)
            console.log(name, 'end.......................')
        }
    })
})();