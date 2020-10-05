"use strict";

//original source https://gist.github.com/stella-yc/49a7b96679ab3bf06e26421fc81b5636

//sample graph for testing bugfixing 
const problem = {
  S: {A: 5, B: 2},
  A: {C: 4, D: 2},
  B: {A: 8, D: 7},
  C: {D: 6, F: 3},
  D: {F: 1},
  F: {}
};

const lowestCostNode = (costs, processed) => {
  return Object.keys(costs).reduce((lowest, node) => {
    if (lowest === null || costs[node] < costs[lowest]) {
      if (!processed.includes(node)) {
        lowest = node;
      }
    }
    return lowest;
  }, null);
};

// function that returns the minimum cost and path to reach Finish
const dijkstra = (graph,S,F) => {

  // track lowest cost to reach each node
  const costs = Object.assign({finish: Infinity}, graph.S);

  // track paths
  const parents = {finish: null};
  for (let child in graph.S) {
   // console.log(parents[child]);
    parents[child] = 'start';
  }

  // track nodes that have already been processed
  const processed = [];

  let node = lowestCostNode(costs, processed);

  while (node) {
    let cost = costs[node];
    let children = graph[node];
    for (let n in children) {
      let newCost = cost + children[n];
      if (!costs[n]) {
        costs[n] = newCost;
        parents[n] = node;
      }
      if (costs[n] > newCost) {
        costs[n] = newCost;
        parents[n] = node;
      }
    }
    processed.push(node);
    node = lowestCostNode(costs, processed);
  }

  let optimalPath = ['finish'];
  let parent = parents.F;
  while (parent) {
    optimalPath.push(parent);
    parent = parents[parent];
  }
  optimalPath.reverse();

  const results = {
    distance: costs.F,
    path: optimalPath
  };
  //console.log("From ",S," to ",F)
  results.path[0]=S;
  results.path[results.path.length-1]=F;
  return results;
};

//console.log(dijkstra(problem));
