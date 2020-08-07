const Flectra = require("./flectra");
const main = new Flectra();


(async () => {
    await main.connect()
    const elements = await main.readElement(
        'res.partner',
        [['name', 'ilike', 'adrian test']],
        ['opportunity_ids', 'invoice_ids']
    ) || []



    console.log(JSON.stringify(elements[0]))


})()
