var network
var actorSources = {}
var sources = []
var sourceColours = {}
var highlightActive = false
var allNodes

var nodesDataset
var edgesDataset
var getSourceId = function (source) { return '_source_' + source }

/**
 * Add a node if id doesn't already exist
 */
var addNode = function(nodes, node) {
    if(_.isUndefined(_.findWhere(nodes, {id : node.id}))) {
        var colour = colorTag(node.group)
        node.color = '#' + colour.hex()
        if(!_.includes(['dot'], node.shape)) {
            node.font = {color: '#' + readableForeground(colour.hex())}
        }
        node.label = node.label.replace('\/','\n')
        nodes.push(node)
    }
}

var addEdge = function(nodes, edges, edge) {
    var srcNode = _.findWhere(nodes, {id: edge.from})
    if(!_.isUndefined(srcNode)) {
        srcNode.value++
    }
    var destNode = _.findWhere(nodes, {id : edge.to})
    if(!_.isUndefined(destNode)) {
        destNode.value++
    }
    if(_.isUndefined(_.findWhere(edges, {from: edge.from, to: edge.to}))) {
        edges.push(edge)
    }
}

var renderData = function(data) {
    var nodes = []
    var edges = []

    addNode(nodes, {id: 'UNKNOWN', label: 'UNKNOWN', value: 1, group: 'UNKNOWN', shape: 'box', shapeProperties:{borderDashes:true}})

    _.forEach(_.keys(data.actors), function(source) {
        var sourceId = getSourceId(source)
        sources.push(source)
        addNode(nodes, {id: sourceId, label: source, value: 2, group: sourceId, shape: 'dot', borderWidth: 2})

        _.forEach(data.actors[source], function(actor) {
            actorSources[actor] = sourceId
            addNode(nodes, {id: actor, label: actor, value: 0, group: sourceId, shape: 'box', title: source + ':' + actor})
            addEdge(nodes, edges, {from: sourceId, to: actor, dashes: true})
        })
    })

    _.forEach(_.keys(data.actions), function(source) {
        var sourceId = getSourceId(source)
        _.forEach(data.actions[source], function(action) {
            // Undeclared actors get their own style
            addNode(nodes, {id: action, label: action, value: 1, group: 'UNKNOWN', shape: 'box', shapeProperties:{borderDashes:true}})
            addEdge(nodes, edges, {from: getSourceId(source), to: action, arrows: 'to'})
        })
    })

    var container = $('#senecaNetwork').get(0)

    var options = {
        autoResize: true,
        height: '100%',
        nodes: {
//                    shape: 'dot',
            scaling: {
                min: 10,
                max: 30,
                label: {
                    min: 12,
                    max: 40,
                    drawThreshold: 12
//                            maxVisible: 20
                }
            }
        },
        interaction:{
            hover: true,
            navigationButtons: true
        },
        layout:{
            randomSeed:2
        },
        physics: {
            stabilization: {
                enabled: true,
                iterations: 180, // maximum number of iteration to stabilize
                updateInterval: 10,
                onlyDynamicEdges: false,
                fit: true
            }
        }
    }
    nodesDataset = new vis.DataSet(nodes)
    edgesDataset = new vis.DataSet(edges)

    network = new vis.Network(container, {nodes: nodesDataset, edges: edgesDataset}, options)

    allNodes = nodesDataset.get({returnType:"Object"})
    network.on("click", function(params) {
        highlightNeighbours(params.nodes)
    })
    network.on("doubleClick", function(params) {
        if (params.nodes.length == 1) {
            if (network.isCluster(params.nodes[0]) == true) {
                declusterByClusterId(params.nodes[0])
            }
            else {
                clusterBySource(params.nodes[0])
            }
        }
    })
}

var applyFilter = function(filterString) {
    var excludedNodes = filterString.length === 0 ? [] : _.pick(allNodes, function(node) {
        var label = node.label || node.hiddenLabel
        return !label || label.indexOf(filterString) === -1
    })

    _.forEach(allNodes, function(node) {
        console.log('ALL', node.hiddenLabel, node.label)
        node.excluded = false
    })
    _.forEach(excludedNodes, function(node) {
        console.log('EXCLUDED', node.hiddenLabel, node.label)
        node.color = 'rgba(200,200,200,0.2)'
        node.excluded = true
        if(node.label !== undefined) {
            node.hiddenLabel = node.label
            node.label = undefined
        }
    })
    _.forEach(allNodes, function(node) {
        if(!node.excluded) {
            console.log('PRESENT', node.hiddenLabel, node.label)
            node.color = undefined // Restore default
            if(node.hiddenLabel !== undefined) {
                node.label = node.hiddenLabel
                node.hiddenLabel = undefined
            }
        }
    })
    updateNodes()
}

var highlightNeighbours = function(nodes) {
    if (nodes.length > 0) {
        highlightActive = true
        var i,j
        var selectedNode = nodes[0]
        var degrees = 2

        // Grey out distant nodes
        for (var nodeId in allNodes) {
            allNodes[nodeId].color = 'rgba(200,200,200,0.5)'
            if (allNodes[nodeId].hiddenLabel === undefined) {
                allNodes[nodeId].hiddenLabel = allNodes[nodeId].label
                allNodes[nodeId].label = undefined
            }
        }
        var connectedNodes = network.getConnectedNodes(selectedNode)
        var allConnectedNodes = []

        // get the second degree nodes
        for (i = 1; i < degrees; i++) {
            for (j = 0; j < connectedNodes.length; j++) {
                allConnectedNodes = allConnectedNodes.concat(network.getConnectedNodes(connectedNodes[j]))
            }
        }

        // all second degree nodes get a different color and their label back
        for (i = 0; i < allConnectedNodes.length; i++) {
            if(allNodes[allConnectedNodes[i]]) {
                allNodes[allConnectedNodes[i]].color = 'rgba(150,150,150,0.75)'
                if (allNodes[allConnectedNodes[i]].hiddenLabel !== undefined) {
                    allNodes[allConnectedNodes[i]].label = allNodes[allConnectedNodes[i]].hiddenLabel
                    allNodes[allConnectedNodes[i]].hiddenLabel = undefined
                }
            }
        }

        // all first degree nodes get their own color and their label back
        for (i = 0; i < connectedNodes.length; i++) {
            if(allNodes[connectedNodes[i]]) {
                allNodes[connectedNodes[i]].color = undefined
                if (allNodes[connectedNodes[i]].hiddenLabel !== undefined) {
                    allNodes[connectedNodes[i]].label = allNodes[connectedNodes[i]].hiddenLabel
                    allNodes[connectedNodes[i]].hiddenLabel = undefined
                }
            }
        }

        // the main node gets its own color and its label back.
        if(allNodes[selectedNode]) {
            allNodes[selectedNode].color = undefined
            if (allNodes[selectedNode].hiddenLabel !== undefined) {
                allNodes[selectedNode].label = allNodes[selectedNode].hiddenLabel
                allNodes[selectedNode].hiddenLabel = undefined
            }
        }
    }
    else if (highlightActive === true) {
        // reset all nodes
        for (var nodeId in allNodes) {
            allNodes[nodeId].color = undefined
            if (allNodes[nodeId].hiddenLabel !== undefined) {
                allNodes[nodeId].label = allNodes[nodeId].hiddenLabel
                allNodes[nodeId].hiddenLabel = undefined
            }
        }
        highlightActive = false
    }

    updateNodes()
}

var updateNodes = function() {
    // transform the object into an array
    var updateArray = []
    for (nodeId in allNodes) {
        if (allNodes.hasOwnProperty(nodeId)) {
            updateArray.push(allNodes[nodeId])
        }
    }
    nodesDataset.update(updateArray)
}

var clusterBySource = function(sourceId) {
    var sourceNode = network.findNode(sourceId)[0]
    var clusterId = 'cluster:' + sourceId
    clusterOptionsByData = {
        joinCondition: function (childOptions) {
            return childOptions.group === sourceId; // the color is fully defined in the node.
        },
        processProperties: function (clusterOptions, childNodes, childEdges) {
            var totalMass = 0
            for (var i = 0; i < childNodes.length; i++) {
                totalMass += childNodes[i].mass
            }
            clusterOptions.mass = totalMass
            return clusterOptions
        },
        clusterNodeProperties: {id: clusterId, borderWidth: 3, shape: 'square', label:sourceNode.options.label,
            color: sourceNode.options.color, font: {color: sourceNode.options.font.color}}
    }
    network.cluster(clusterOptionsByData)
    allNodes[clusterId] = clusterOptionsByData.clusterNodeProperties
}

var clusterAllSources = function() {
    _.forEach(sources, function(source) {
        clusterBySource(getSourceId(source))
    })
}

var declusterAllSources = function() {
    _.forEach(sources, function(source) {
        var clusterId = 'cluster:' + getSourceId(source)
        declusterByClusterId(clusterId)
    })
}

var declusterByClusterId = function(clusterId) {
    network.openCluster(clusterId)
    delete allNodes[clusterId]
}

$(document).ready(function () {
    $.getJSON('/data', function(data) {
        renderData(data)
    })
})