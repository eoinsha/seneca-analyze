var path = require('path')

var argv = require('yargs').argv
var _ = require('lodash')
var globStream = require('glob-stream')

var express = require('express')
var app = express()

var findSenecaUsages = require('./find_seneca_usages')


app.get('/data', function(req, res) {
    res.json(usages)
}).use('/', express.static(path.resolve(__dirname, 'web')))

var projectRoot = process.cwd()
if(argv._.length > 0) projectRoot = argv._[0]

var usages = {actors: {}, actions: {}}

var fileStream = globStream.create(['**/*.js', '!node_modules/**', '!e2e-tests/**', '!tests/**', '!test/**', '!Gruntfile.js', '!Gulpfile.js', '!grunt/**', '!web/**', '!*/public/**', '!scripts/**'], { cwd: projectRoot });

fileStream.on('data', function(file) {
            console.log('Finding in', file.path)
            _.merge(usages, findSenecaUsages(file.path))
        })

fileStream.on('end', function() {
	console.log(JSON.stringify(usages, null, ' '))

        var port = process.env.PORT || 8000
        app.listen(port)
        console.log("Listening on port", port)
})



