var argv = require('yargs').argv
var _ = require('lodash')
var globby = require('globby')

var findSenecaUsages = require('./find_seneca_usages')

var projectRoot = process.cwd()
if(argv._.length > 0) projectRoot = argv._[0]


globby(['**/*.js', '!node_modules/**', '!e2e-tests/**', '!tests/**', '!test/**', '!Gruntfile.js', '!Gulpfile.js', '!grunt/**', '!web/**', '!scripts/**'],
    { cwd: projectRoot },
    function(err, files) {
        console.log('PATHS', JSON.stringify(files))
        _.forEach(files, function(file) {
            findSenecaUsages(projectRoot, file)
        })
    })