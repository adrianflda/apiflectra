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

const updateInvoiceLine = async (id, fields) => {
    let invoice_line = { id }
    for (let field in fields) {
        invoice_line[field] = fields[field]
    }
    return await main.updateElement(ACCOUNT_INVOICE_LINE, invoice_line)
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

const getProductId = async (filter) => {
    let product = await main.readElement(PRODUCT_PRODUCT, filter, ['id'], 0, 1)
    return product && product.id
}

const workWithThis = async (model, filter = [], product_id) => {
    let start = 0
    let amount = 100
    let flag = true
    while (flag) {
        try {
            let elements = await main.readElement(model, filter, ['id', 'name', 'price_unit']) || []
            for (let { id, price_unit, name } of elements) {
                await updateInvoiceLine(id, { price_unit, product_id })
                console.log(name, product_id, price_unit)
            }
            flag = elements.length > 0
            console.log(elements.length)
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
    //let julio_user_id = await getComercial('julio.santamaria@vacancyrewards.com')
    //let user_id = await getComercial('karina.jankovsky@vacancyrewards.com')
    let product_id = await getProductId([['barcode', '=', '123456789']])
    if (!product_id)
        return

    const model = ACCOUNT_INVOICE_LINE;
    const filter = [["product_id", "=", false]];

    await workWithThis(model, filter, product_id)
})();