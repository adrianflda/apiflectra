const excelToJson = require('convert-excel-to-json');
const csv = require('csvtojson')
const filesList = require('files-list');
const _ = require('lodash');


const xlsx2json = async (file) => {
    return excelToJson({
        sourceFile: file,
        header: {
            rows: 1
        },
        columnToKey: {
            '*': '{{columnHeader}}'
        }
    })
}

const csvtToJSON = async (file) => {
    return await csv().fromFile(file)
}

const files = async (folder) => {
    return filesList(folder)
}

const convertDate = (date) => {
    var { hour } = getTime(date)
    var all_date = date.split(' ')[0].split('/')
    return {
        hour,
        year: all_date[2],
        month: all_date[1],
        day: all_date[0]
    }
}

const getTime = (date) => {
    let time = date.split(' ')[1].split(':')
    time[0] = parseInt(time[0])
    if (date.indexOf('p') > -1 && time[0] != 12)
        time[0] += 12
    else if (date.indexOf('p') === -1 && time[0] === 12)
        time[0] = 0
    return { hour: time.join(':') }
}

const processXLSXFiles = async (path = '/home/storage') => {
    return new Promise(async (resolve, reject) => {
        let list = await files(path)
        list = (list && list.length > 0) ? list : [list]
        let fileIndex = 0;
        let result = []
        while (fileIndex < list.length) {
            let file = list[fileIndex]

            console.log('File: ', file)
            if (typeof file === 'string') {
                let json = await xlsx2json(file)
                //console.log('json: ', json)
                if (json instanceof Object) {
                    for (let sheetIndex in json) {
                        //console.log('sheet', sheetIndex)
                        let sheet = json[sheetIndex]
                        if (sheet && sheet.length > 0) {
                            for (let row of sheet) {
                                //console.log('row: ', row)
                                result.push(row)
                            }
                        }
                    }
                }
            }

            fileIndex++
        }

        resolve(result)
    })
}

const processSCVFiles = (path = '/home/storage') =>
    new Promise(async (resolve, reject) => {
        let list = await files(path)
        list = (list && list.length > 0) ? list : [list]
        let fileIndex = 0;

        while (fileIndex < list.length) {
            let file = list[fileIndex]

            console.log('File: ', file)
            if (typeof file === 'string') {
                let array = await csvtToJSON(file)
                if (array && Array.isArray(array) && array.length > 0) {
                    resolve(array)
                }
            }

            fileIndex++
        }

        resolve()
    })


const moveReadedFiles = async (path = '/home/storage') => {
    return new Promise(async (resolve, reject) => {
        let list = await files(path)
        list = (list && list.length > 0) ? list : [list];
        let index = 0;
        while (index < list.length) {
            let file = list[index];
            if (_.isString(file)) {
                const shell = require('shelljs')
                shell.mv('-f', file, file.replace('storage', 'processed'))
                console.log(`The file ${file} has been moved`);
            }
            index++;
        }
        resolve()
    })
}

module.exports = {
    processXLSXFiles,
    processSCVFiles,
    moveReadedFiles
}

