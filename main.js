var fs = require('fs')

var esprima = require('esprima')
var walk = require( 'esprima-walk' )
var argv = require('yargs').argv
var _ = require('lodash')

var jsFile = argv._[0]
var source = fs.readFileSync(jsFile, 'UTF-8')
var ast = esprima.parse(source)

walk(ast, function(node) {
    if(node.type === "CallExpression" && _.get(node, 'callee.object.name') === "seneca") {
        console.log(node)
    }
})






