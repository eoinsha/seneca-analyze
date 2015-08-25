module.exports = function(root, jsFile) {
    var fs = require('fs')
    var path = require ('path')
    var esprima = require('esprima')
    var walk = require( 'esprima-walk' )
    var _ = require('lodash')

    var source = fs.readFileSync(path.join(root, jsFile), 'UTF-8')
    var ast = esprima.parse(source)

    var stringifyExpression = function(expr, literals) {
        switch(expr.type) {
            case "Literal": return expr.value
            case "Identifier": return (literals && literals[expr.name]) || expr.name
            case "MemberExpression" : return expr.object.name + '.' + expr.property.name
                return null
        }
    }

    var literals = {}
    walk(ast, function(node) {
        // Remember declarations of string literals which my be referenced later in (crude with no regard for scope!)
        if(node.type === "VariableDeclaration") {
            _.forEach(node.declarations.filter(function(dec) {
                return _.get(dec, 'init.type') === 'Literal'
            }),
                function(dec) {
                    literals[dec.id.name] = dec.init.value;
                })
        }

        if(node.type === "CallExpression" && _.get(node, 'callee.object.name') === 'seneca') {
            var argProperties = _.chain(node.arguments).pluck('properties').flatten().value()
            var callArgSummary = _.reduce(argProperties, function(acc, property) {
                if(_.isUndefined(property)) return acc
                var key = stringifyExpression(property.key)
                var value = stringifyExpression(property.value, literals)
                if(key != null && value != null && _.includes(['role', 'cmd'], key)) {
                    //return acc + (acc === "" ? "" : ',' ) + key + '=' + value
                    return acc + (acc === "" ? "" : '/' ) + value
                }
                else return acc
            }, '')

            if(callArgSummary.length > 0 && _.includes(['add', 'act'], node.callee.property.name))
                console.log(path.basename(jsFile, '.js') + ':' + node.callee.property.name + ':' + callArgSummary)
        }
    })
}