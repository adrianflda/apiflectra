const Odoo = require('odoo-xmlrpc')
require('dotenv').config()

const loadDeployData = () => {
    return {
        "url": process.env.URL,
        "port": process.env.POSRT,
        "db": process.env.DB,
        "username": process.env.USER_NAME,
        "password": process.env.PASSWORD
    }
}

const flectraConnect = (deployData = loadDeployData()) => new Promise((resolve, reject) => {
    try {
        let flectra = new Odoo(deployData)
        console.log(flectra);
        
        flectra.connect((err, value) => {
            if (err) {
                console.log('error', 'Connection to Flectra error: ', err)
                reject()
                return
            }
            console.log('log', 'Connection to Flectra.', ['start'])
            resolve(flectra);
        })

    } catch (error) {
        reject(error)
    }

})


module.exports = {
    flectraConnect
}
