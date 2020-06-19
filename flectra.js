const Odoo = require("odoo-xmlrpc");
require("dotenv").config();

const { Sema } = require("async-sema");
const sema = new Sema(
  1, // Allow 4 concurrent async calls
  { capacity: 10000 } // Prealloc space for 1000 tokens
);

// methods
const CREATE = "create";
const SEARCH_READ = "search_read";
const WRITE = "write";
const UNLINK = "unlink";
const MERGE_OPPORTUNITY = "merge_opportunity";

/**
 * Deploy data url, port, db, username, passowrd
 */
const loadDeployData = {
  url: process.env.URL,
  port: process.env.PORT,
  db: process.env.DB,
  username: process.env.USER_NAME,
  password: process.env.PASSWORD,
};

class Flectra {
  constructor(deployData, evenListener) {
    this.deployData = deployData;
  }

  /**
   *
   * @param {Object} deployData deploy parameters
   */
  connect(deployData = loadDeployData) {
    console.log("connecting to flcetra", deployData);
    return new Promise((resolve, reject) => {
      try {
        if (this.flectra) {
          resolve(this.flectra);
          return;
        }
        this.flectra = new Odoo(deployData);
        this.flectra.connect((err, value) => {
          if (err) {
            reject(err);
            return;
          }
          console.log("user_id: ", value);
          resolve(this.flectra);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   *
   * @param {String} model Flectra model
   * @param {String} method Flectra method
   * @param {Array} params Parameters for each job
   */
  execute_kw(model, method, params) {
    return new Promise(async (resolve, reject) => {
      if (this.flectra) {
        console.log("execute_kw: ", model, method, JSON.stringify(params));
        await sema.acquire();
        this.flectra.execute_kw(model, method, params, async (err, value) => {
          sema.release();
          if (err) {
            console.log(
              "execute_kw fail: ",
              model,
              method,
              JSON.stringify(params),
              err
            );
            reject(err);
            return;
          }
          resolve(value);
        });
        return;
      } else reject("flectra is not initialized");
    });
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
        console.log("trace", "createElement", [model, element]);
        reject("not element");
        return;
      }

      context = context || {};
      let inParams = [];
      inParams.push(element);
      inParams.push(context);
      let params = [];
      params.push(inParams);

      this.execute_kw(model, CREATE, params)
        .then((result) => resolve(result))
        .catch((e) => reject(e));
    });
  }

  /**
   *
   * @param {String} model Flectra model
   * @param {Object} element Specific element to update
   */
  updateElement(model, element) {
    return new Promise((resolve, reject) => {
      if (!model || !element || !element.id) {
        console.log("error", "updateElement", [model, element]);
        reject("no element");
        return;
      }

      let id = element.id;
      delete element.id;

      let inParams = [];
      inParams.push([id]);
      inParams.push(element);
      let params = [];
      params.push(inParams);

      this.execute_kw(model, WRITE, params)
        .then((result) => resolve(result))
        .catch((e) => reject(e));
    });
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
    filter = filter || [];
    fields = fields || 0;
    limit = limit || 0;
    offset = offset || 0;

    return new Promise(async (resolve, reject) => {
      try {
        var inParams = [];
        inParams.push(filter);
        inParams.push(fields);
        inParams.push(offset);
        inParams.push(limit);
        var params = [];
        params.push(inParams);

        let result = await this.execute_kw(model, SEARCH_READ, params);

        if (fields) {
          let array = [];
          for (let elementIndex in result) {
            let element = result[elementIndex];
            let newElement = {};
            for (let fieldIndex in fields) {
              let field = fields[fieldIndex];
              newElement[field] = element[field];
            }
            array.push(newElement);
          }
          result = array;
        }
        result = limit === 1 ? result && result[0] : result;
        resolve(result);
      } catch (error) {
        console.log("error", "readElement", error);
        reject(error);
      }
    });
  }

  deleteElement(model, id) {
    let inParams = [];
    inParams.push([id]); //id to delete
    let params = [];
    params.push(inParams);
    return new Promise((resolve, reject) => {
      this.execute_kw(model, UNLINK, params)
        .then((result) => resolve(result))
        .catch((e) => reject(e));
    });
  }

  mergeOpportunity(ids = []) {
    return new Promise((resolve, reject) => {
      if (ids.length < 1) {
        console.log("trace", "mergeOpportunities", [ids]);
        reject("not element");
        return;
      }

      let context = { ids };
      let inParams = [];
      inParams.push(context);
      let params = [];
      params.push(inParams);
      try {
        this.execute_kw("crm.lead", MERGE_OPPORTUNITY, params)
          .then((result) => {
            resolve(result);
          })
          .catch((e) => {
            console.log("mergeOpportunity error: " + e);
            reject(e);
          });
      } catch (e) {
        console.log("mergeOpportunity error: " + e);
      }
    });
  }
}

module.exports = Flectra;
