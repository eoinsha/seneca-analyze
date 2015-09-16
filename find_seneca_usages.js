var fs = require('fs')
var path = require ('path')
var esprima = require('esprima')
var _ = require('lodash')

module.exports = function(jsFile) {
    var source = fs.readFileSync(jsFile, 'UTF-8')
    var ast = esprima.parse(source)

    var scope = { seneca: undefined, globals: {}, stack: []}

    var UNKNOWN = {}
    var SENECA_INSTANCE = {}

    /**
     * @param paramNames Array of declared function parameter names
     * @param bodyAst The function body's BlockExpression AST
     * @constructor
     */
    var FunctionDeclaration = function(paramNames, bodyAst) {
        this.paramNames = paramNames
        this.bodyAst = bodyAst
        this.evaluated = false
    }

    var CallExecution = function(func) {
        this.func = func
    }

    var ApplyExecution = function(func) {
        this.func = func
    }

    var BindExecution = function(func) {
        this.func = func
    }

    var Scope = function() {
        this.seneca = undefined
        this.globals = {}
        this.stack = [{}]

        this.declareVar = function(name, value) {
            this.stack[this.stack.length - 1][name] = value
        }

        this.assign = function(name, value) {
            var frame = this.stack[this.stack.length - 1]
            if(frame.hasOwnProperty(name)) {
                frame[name] = value
            }
            else {
                this.globals[name] = value
            }
        }

        this.pop = function() {
            var top = this.stack.length - 1
            if(top > 0) {
                this.stack = this.stack.slice(0, top)
            }
        }

        this.findValue = function(name) {
            var top = this.stack.length - 1
            if (top >= 0) {
                return this.stack[top][name] || this.globals[name]
            }
            throw "Attempt to read past bottom of stack"
        }

        this.push = function() {
            this.stack.push({})
        }
    }

    var evaluate = function(value, scope) {
        if(value instanceof FunctionDeclaration) {
            scope.push()
            var result = walk(value.bodyAst, scope)
            scope.pop()
            return result
        }
        return value
    }

    var walk = function(node, scope) {
        console.log("WALK", node, scope)
        switch(node.type) {
            case 'Literal': return node.value
            case 'UnaryExpression':
                var val = walk(node.argument, scope)
                switch(node.operator) {
                    case '+': return +evaluate(val)
                    case '-': return -evaluate(val)
                    case '~': return ~evaluate(val)
                    case '!': return !evaluate(val)
                    return UNKNOWN
                }
            case 'ArrayExpression':
                return _.map(node.elements, function(el) {
                    return evaluate(walk(el, scope))
                })
            case 'ObjectExpression':
                var obj = {}
                _.forEach(node.properties, function(prop) {
                    obj[prop.key.value || prop.key.name] = prop.value === null ? null : evaluate(walk(prop.value, scope))
                })
                return obj
            case 'BinaryExpression':case 'LogicalExpression':
                var opLeft = evaluate(walk(node.left))
                if(opLeft === UNKNOWN) return UNKNOWN
                var opRight = evaluate(walk(node.right))
                if(opRight === UNKNOWN) return UNKNOWN
                switch(node.operator) {
                    case '==': return opLeft == opRight
                    case '===': return opLeft === opRight
                    case '!=': return opLeft != opRight
                    case '!==': return opLeft !== opRight
                    case '+': return opLeft + opRight
                    case '-': return opLeft - opRight
                    case '*': return opLeft * opRight
                    case '/': return opLeft / opRight
                    case '%': return opLeft % opRight
                    case '<': return opLeft < opRight
                    case '<=': return opLeft <= opRight
                    case '>': return opLeft > opRight
                    case '>=': return opLeft >= opRight
                    case '|': return opLeft | opRight
                    case '&': return opLeft & opRight
                    case '^': return opLeft ^ opRight
                    case '&&': return opLeft && opRight
                    case '||': return opLeft || opRight
                }
            case 'Identifier': return scope.findValue(node.name) || UNKNOWN
            case 'CallExpression':
                var callee = walk(node.callee, scope)
                if(callee === UNKNOWN) return UNKNOWN
                if(callee instanceof FunctionDeclaration) {
                    return executeFunction(callee, scope, callee.paramNames, node.arguments)
                }
                if(callee instanceof CallExecution) {
                    // TODO - 'this' is ignored for now
                    return executeFunction(callee, scope, callee.paramNames, node.arguments.splice(1))
                }
                if(callee instanceof ApplyExecution) {
                    // TODO - 'this' is ignored for now
                    return executeFunction(callee, scope, callee.paramNames, node.arguments[1] || [])
                }
                if(callee instanceof BindExecution) {
                    return _.cloneDeep(callee)
                }
                if(!node.callee.object && node.callee.name === "require") {
                    if(node.arguments.length > 0 && node.arguments[0].value === "seneca") {
                        return SENECA_INSTANCE
                    }
                    return UNKNOWN
                }
                throw "I don't know what to call - TODO"
            case 'MemberExpression':
                var obj = walk(node.object, scope)
                if(obj === UNKNOWN) return UNKNOWN
                if(node.property.type === 'Identifier') {
                    var memberValue = obj[node.property.name]
                    if(memberValue === undefined) {
                        switch(node.property.name) {
                            case 'call':
                                return new CallExecution(obj)
                            case 'apply':
                                return new ApplyExecution(obj)
                            case 'bind':
                                return new BindExecution(obj)
                            default:
                                console.error("Don't know what to do with unknown member", node.property.type, "of", obj)
                                return UNKNOWN
                        }
                    }
                }
                var prop = walk(node.property)
                if(prop === UNKNOWN) return UNKNOWN
                return obj[prop]
            case 'ConditionalExpression':
                var val = evaluate(walk(node.test, scope))
                if(val === UNKNOWN) return UNKNOWN
                return val ? walk(node.consequent, scope) : walk(node.alternate, scope)
            case 'FunctionExpression':
                var paramNames = _.map(node.params, function(param) {
                    return param.name
                })
                return new FunctionDeclaration(paramNames, node.body)
            case 'AssignmentExpression':
                scope.assign(node.left.name, evaluate(walk(node.right, scope), scope))
                return;
            case 'VariableDeclaration':
                _.forEach(node.declarations, function(decl) {
                    scope.declareVar(decl.id.name, walk(decl.init, scope))
                })
                return;
            case 'ExpressionStatement':
                return walk(node.expression, scope)
            case 'SequenceExpression':
                var result
                _.forEach(node.expressions, function(expr) {
                    result = walk(expr, scope)
                })
                return result;
            case 'Program':
                _.forEach(node.body, function(expr) {
                    walk(expr, scope)
                })
                return
            return UNKNOWN
        }
    }

    var executeFunction = function(callee, scope, paramNames, argNodes) {
        var argValues = _.map(argNodes, function(arg) {
            return evaluate(walk(arg, scope), scope)
        })
        return evaluate(callee, scope, _.zipObject(paramNames, argValues))
    }

    var sourceName = path.basename(jsFile, '.js')
    var literals = {}
    var usages = {actors: {}, actions: {}}

    var scope = new Scope()
    walk(ast, scope)

    /**
    walk(ast, function(node) {
        // Remember declarations of string literals which my be referenced later in (crude with no regard for scope!)
        if(node.type === 'VariableDeclaration') {
            _.forEach(node.declarations.filter(function(dec) {
                return _.get(dec, 'init.type') === 'Literal'
            }),
                function(dec) {
                    literals[dec.id.name] = dec.init.value
                })
        }

        if(node.type === 'CallExpression' && _.get(node, 'callee.object.name') === 'seneca') {
            var actionLabel = ''
            if(node.arguments.length > 0 && node.arguments[0].type === 'Literal') { // String seneca pattern
                var elements = node.arguments[0].value.split(',')
                // Limit to first 2
                if(elements.length > 2) elements = elements.slice(0, 2)
                actionLabel = _.reduce(elements, function(acc, element){
                    var sepIdx = element.indexOf(':')
                    var part = sepIdx < 1 ? element : element.substr(sepIdx + 1)
                    return acc + (acc === '' || part.length === 0 ? '' : '/' ) + part
                }, '')
            }
            else { // Object style seneca pattern
                var argProperties = _.chain(node.arguments).pluck('properties').flatten().value()
                actionLabel = _.reduce(argProperties, function (acc, property) {
                    if (_.isUndefined(property)) return acc
                    var key = stringifyExpression(property.key)
                    var value = stringifyExpression(property.value, literals)
                    if (key != null && value != null && _.includes(['role', 'cmd'], key)) {
                        //return acc + (acc === '' ? '' : ',' ) + key + '=' + value
                        return acc + (acc === '' ? '' : '/' ) + value
                    }
                    else return acc
                }, '')
            }
            if(actionLabel.length > 0 && _.includes(['add', 'act'], node.callee.property.name)) {
                switch (node.callee.property.name) {
                    case 'add':
                        if(!usages.actors[sourceName]) usages.actors[sourceName] = []
                        usages.actors[sourceName].push(actionLabel)
                        break
                    case 'act':
                        if(!usages.actions[sourceName]) usages.actions[sourceName] = []
                        usages.actions[sourceName].push(actionLabel)
                        break
                }
            }
        }
    })
     */
    return usages
}
