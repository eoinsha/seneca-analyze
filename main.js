var path = require('path')

var argv = require('yargs').argv
var _ = require('lodash')
var globby = require('globby')

var findSenecaUsages = require('./find_seneca_usages')

var projectRoot = process.cwd()
if(argv._.length > 0) projectRoot = argv._[0]

var usages = {actors: {}, actions: {}}
globby(['**/*.js', '!node_modules/**', '!e2e-tests/**', '!tests/**', '!test/**', '!Gruntfile.js', '!Gulpfile.js', '!grunt/**', '!web/**', '!*/public/**', '!scripts/**'],
    { cwd: projectRoot },
    function(err, files) {
        _.forEach(files, function(file) {
            console.log('Finding in', file)
            _.merge(usages, findSenecaUsages(projectRoot, file))
        })
        console.log(JSON.stringify(usages, null, ' '))
    })

var express = require('express')
var app = express()
app.get('/data', function(req, res) {
    res.json(usages)
}).use('/', express.static(path.resolve(__dirname, 'web')))

var port = process.env.PORT || 8000
app.listen(port)
console.log("Listening on port", port)



