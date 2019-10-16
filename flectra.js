const Odoo = require('odoo-xmlrpc')
require('dotenv').config()


// methods
const CREATE = 'create'
const SEARCH_READ = 'search_read'
const WRITE = 'write'
const UNLINK = 'unlink'

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

class Flectra {
    constructor(deployData, evenListener) {
        this.deployData = deployData

        if (evenListener) {
            const cote = require('cote');
            const listener = new cote.Responder({ name: 'API Flectra Listener', envairoment: 'production', key: 'flectra' });

            listener.on('createElement', async (req = {}, cb) => {
                console.log('apiflectra createElement: ', req)
                let { context = {}, model, element } = req
                let result = await this.createElement(context, model, element)
                cb(null, result)
            });

            listener.on('readElement', async (req = {}, cb) => {
                console.log('apiflectra readElement: ', req)
                let { model, filter, fields, offset, limit } = req
                let result = await this.readElement(model, filter, fields, offset, limit)
                cb(null, result)
            });

            listener.on('updateElement', async (req = {}, cb) => {
                console.log('apiflectra updateElement: ', req)
                let { model, element } = req
                let result = await this.updateElement(model, element)
                cb(null, result)
            });

            listener.on('deleteElement', async (req = {}, cb) => {
                console.log('apiflectra deleteElement: ', req)
                let { model, id } = req
                let result = await this.deleteElement(model, id)
                cb(null, result)
            });
        }
    }


    /**
     * 
     * @param {Object} deployData deploy parameters
     */
    connect(deployData = loadDeployData) {
        console.log('connecting to flcetra', deployData)
        return new Promise((resolve, reject) => {
            try {
                this.flectra = new Odoo(deployData)
                this.flectra.connect((err, value) => {
                    if (err) {
                        reject(err)
                        return
                    }
                    console.log('user_id: ', value)
                    resolve(this.flectra);
                })
            } catch (error) {
                reject(error)
            }
        })
    }

    /**
     * 
     * @param {String} model Flectra model 
     * @param {String} method Flectra method 
     * @param {Array} params Parameters for each job 
     */
    execute_kw(model, method, params) {
        return new Promise((resolve, reject) => {
            if (this.flectra) {
                this.flectra.execute_kw(model, method, params, (err, value) => {
                    if (err) {
                        reject(err)
                        return
                    }
                    resolve(value)
                })
                return
            }
            reject(this.flectra)
        })
    }

    /**
     * 
     * @param {Object} context Context for flectra enviroment 
     * @param {String} model Flectra model 
     * @param {Object} element Specific element to create
     */
    createElement(context, model, element) {
        return new Promise((resolve, reject) => {
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

            this.execute_kw(model, CREATE, params)
                .then(result => resolve(result))
                .catch(e => reject(e))

        })
    }

    /**
     * 
     * @param {String} model Flectra model
     * @param {Object} element Specific element to update
     */
    updateElement(model, element) {
        return new Promise(async (resolve, reject) => {
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

            this.execute_kw(model, WRITE, params)
                .then(result => resolve(result))
                .catch(e => reject(e))

        })
    }


    /**
     * 
     * @param {String} model Flectra model
     * @param {Array} filter Filter
     * @param {Array} fields Fields
     * @param {Number} offset Offset
     * @param {Number} limit Limit
     */
    readElement(model, filter, fields, offset, limit) {
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

                let result = await this.execute_kw(model, SEARCH_READ, params)

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
                console.log('error', 'readElement', error)
                reject(error)
            }

        })
    }

    deleteElement(model, id) {
        let inParams = [];
        inParams.push([id]); //id to delete
        let params = [];
        params.push(inParams);
        return new Promise((resolve, reject) => {
            this.execute_kw(model, UNLINK, params)
                .then(result => resolve(result))
                .catch(e => reject(e))
        })
    }
}

module.exports = Flectra