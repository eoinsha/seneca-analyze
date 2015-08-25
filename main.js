var fs = require('fs')

var esprima = require('esprima')
var walk = require( 'esprima-walk' )
var argv = require('yargs').argv
var _ = require('lodash')

var jsFile = argv._[0]
var source = fs.readFileSync(jsFile, 'UTF-8')
var ast = esprima.parse(source)

var stringifyExpression = function(expr) {
    switch(expr.type) {
        case "Literal": return expr.raw
        case "Identifier": return expr.name
        case "MemberExpression" : return expr.object.name + '.' + expr.property.name
            return null
    }
}

walk(ast, function(node) {
    if(node.type === "CallExpression" && _.get(node, 'callee.object.name') === "seneca") {
        var argProperties = _.chain(node.arguments).pluck('properties').flatten().value()
        var callArgSummary = _.reduce(argProperties, function(acc, property) {
            if(_.isUndefined(property)) return acc
            var key = stringifyExpression(property.key)
            var value = stringifyExpression(property.value)
            if(key != null && value != null && _.includes(['role', 'cmd'], key)) {
                return acc + (acc === "" ? "" : ',' ) + key + '=' + value
            }
            else return acc
        }, '')
        console.log(callArgSummary)
    }
})