const rp = require('request-promise')
require('dotenv').config()

const deployData = {
    "db": process.env.DB,
    "username": process.env.USER_NAME,
    "password": process.env.PASSWORD
}

var options = {
    method: 'POST',
    uri: process.env.URL + "/api/auth/get_tokens",
    body: {
        data: deployData
    },
    json: true // Automatically stringifies the body to JSON
};



describe('flectra get elemet test', () => {

    it("should get elements", async () => {
        let parsedBody = await rp(options)
            .catch(function (err) {
                console.error(err)
            });
            console.log(parsedBody)
    });

})