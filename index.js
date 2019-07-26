const Odoo = require('odoo-xmlrpc')
require('dotenv').config()

// methods
const CREATE = 'create'
const WRITE = 'write'
const SEARCH_READ = 'search_read'

/**
 * Deploy data url, port, db, username, passowrd
 */
const loadDeployData = {
    "url": process.env.URL,
    "port": process.env.PORT,
    "db": process.env.DB,
    "username": process.env.USER_NAME,
    "password": process.env.PASSWORD
}

/**
 * 
 * @param {Object} deployData deploy parameters
 */
const flectraConnect = (deployData = loadDeployData) => new Promise((resolve, reject) => {
    try {
        let flectra = new Odoo(deployData)
        flectra.connect((err, value) => {
            if (err) {
                reject(err)
                return
            }
            resolve(flectra);
        })
    } catch (error) {
        reject(error)
    }

})

/**
 * 
 * @param {String} model Flectra model 
 * @param {String} method Flectra method 
 * @param {Array} params Parameters for each job 
 */
const execute_kw = async (model, method, params) => new Promise(async (resolve, reject) => {
    let flectra = await flectraConnect()
        .catch(err => {
            reject(err)
        })

    if (flectra) {
        flectra.execute_kw(model, method, params, (err, value) => {
            if (err) {
                reject(err)
                return
            }
            resolve(value)
        })
        return
    }
    reject(flectra)
})

/**
 * 
 * @param {Object} context Context for flectra enviroment 
 * @param {String} model Flectra model 
 * @param {Object} element Specific element to create
 */
const createElement = (context, model, element) => new Promise((resolve, reject) => {
    if (!model || !element) {
        console.log('trace', 'createElement', [model, element])
        reject('not element')
        return
    }

    context = context || {}
    let inParams = [];
    inParams.push(element);
    inParams.push(context);
    let params = [];
    params.push(inParams);

    execute_kw(model, CREATE, params)
        .then(result => resolve(result))
        .catch(e => reject(e))

})

/**
 * 
 * @param {String} model Flectra model
 * @param {Object} element Specific element to update
 */
const updateElement = (model, element) => new Promise(async (resolve, reject) => {
    if (!model || !element || !element.id) {
        console.log('error', 'updateElement', [model, element])
        reject('no element')
        return
    }

    let inParams = [];
    inParams.push([element.id]);
    inParams.push(element)
    let params = [];
    params.push(inParams);

    execute_kw(model, WRITE, params)
        .then(result => resolve(result))
        .catch(e => reject(e))

})


/**
 * 
 * @param {String} model Flectra model
 * @param {Array} filter Filter
 * @param {Array} fields Fields
 * @param {Number} offset Offset
 * @param {Number} limit Limit
 */
const getElement = async (model, filter, fields, offset, limit) => {
    filter = filter || []
    fields = fields || 0
    limit = limit || 0
    offset = offset || 0

    return new Promise(async (resolve, reject) => {
        try {
            var inParams = [];
            inParams.push(filter)
            inParams.push(fields)
            inParams.push(offset)
            inParams.push(limit)
            var params = []
            params.push(inParams)

            let result = await execute_kw(model, SEARCH_READ, params)

            if (fields) {
                let array = []
                for (let elementIndex in result) {
                    let element = result[elementIndex]
                    let newElement = {}
                    for (let fieldIndex in fields) {
                        let field = fields[fieldIndex]
                        newElement[field] = element[field]
                    }
                    array.push(newElement)
                }
                result = array
            }
            result = (limit === 1) ? result && result[0] : result
            resolve(result)

        } catch (error) {
            console.log('error', 'getElement', [error])
            reject(error)
        }

    })
}


module.exports = {
    flectraConnect,
    execute_kw,
    createElement,
    getElement,
    updateElement
}
