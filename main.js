var argv = require('yargs').argv
var _ = require('lodash')
var globby = require('globby')

var findSenecaUsages = require('./find_seneca_usages')

var projectRoot = process.cwd()
if(argv._.length > 0) projectRoot = argv._[0]

var usages = {actors: {}, actions: {}}
globby(['**/*.js', '!node_modules/**', '!e2e-tests/**', '!tests/**', '!test/**', '!Gruntfile.js', '!Gulpfile.js', '!grunt/**', '!web/**', '!scripts/**'],
    { cwd: projectRoot },
    function(err, files) {
        _.forEach(files, function(file) {
            console.log('Finding in', file)
            _.merge(usages, findSenecaUsages(projectRoot, file))
        })
        console.log(JSON.stringify(usages, null, ' '))
    })
