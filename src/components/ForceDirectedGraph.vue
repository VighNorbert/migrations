<template>
    <div class="btn-group mb-4">
        <button :disabled="layout === 'force'"
                :class="'btn btn-primary ' + (direction ? 'active' : '')"
                @click="changeDirection(true)">
            Show Emigration
        </button>
        <button :disabled="layout === 'force'"
                :class="'btn btn-primary ' + (!direction ? 'active' : '')"
                @click="changeDirection(false)">
            Show Immigration
        </button>
    </div>
    <div class="map-canvas">
    </div>
</template>

<script>
import * as d3 from 'd3';
import * as jsnx from 'jsnetworkx';
import * as bootstrap from 'bootstrap';

export default {
  name: 'ForceDirectedGraph',
  data() {
    return {
      layout: 'force',
      direction: false,
      nodesData: null,
      linksData: null,
      nodes: null,
      links: null,
      G: null,
      forceLink: null,
      simulationRunning: true,
      simulation: null,
      svg: null,
      root: null
    };
  },
  async mounted() {
    this.G = new jsnx.DiGraph();

    this.nodesData = await this.loadNodes();
    this.linksData = await this.loadLinks();

    this.G.addNodesFrom(this.nodesData.map(d => [d.code, d]));
    this.G.addEdgesFrom(this.linksData.map(d => [d.source, d.target, d]));

    this.drawGraph();
  },
  methods: {
    async loadNodes() {
      let c = await d3.json("../../data/countries.json");
      c.map(d => {
        d.group = d.region;
      });
      return c;
    },

    async loadLinks() {
      let c = await d3.json("../../data/migration.json");
      c = c.filter(d => d.total[5] > 10000);
      return c;
    },

    drawGraph() {
      let chart = this.ForceGraph();

      document.querySelector(".map-canvas").appendChild(chart);

      const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
      [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl, {
        trigger: 'hover',
        delay: {show: 300, hide: 0}
      }));
    },

    toggleLayout() {
      if (this.layout === 'force') {
        this.layout = 'radial';
      } else {
        this.layout = 'force';
      }
    },

    createSvg(width, height) {
      this.svg = d3.create("svg")
          .attr("width", width)
          .attr("height", height)
          .attr("viewBox", [-width / 2, -height / 2, width, height])
          .attr("style", "width: 100%; height: 50%;");

      const defs = this.svg.append("defs");
      defs.append("marker")
          .attr("id", "arrow")
          .attr("viewBox", "0 -5 10 10")
          .attr("refX", 15)
          .attr("refY", -0.5)
          .attr("markerWidth", 5)
          .attr("markerHeight", 5)
          .attr("orient", "auto")
          .append("path")
          .attr("fill", "#000")
          .attr("fill-opacity", 0.2)
          .attr("d", "M0,-5L10,0L0,5");

      defs.append("marker")
          .attr("id", "arrow-faded")
          .attr("viewBox", "0 -5 10 10")
          .attr("refX", 15)
          .attr("refY", -0.5)
          .attr("markerWidth", 5)
          .attr("markerHeight", 5)
          .attr("orient", "auto")
          .append("path")
          .attr("fill", "#000")
          .attr("fill-opacity", 0.05)
          .attr("d", "M0,-5L10,0L0,5");

      defs.append("marker")
          .attr("id", "arrow-full")
          .attr("viewBox", "0 -5 10 10")
          .attr("refX", 15)
          .attr("refY", -0.5)
          .attr("markerWidth", 5)
          .attr("markerHeight", 5)
          .attr("orient", "auto")
          .append("path")
          .attr("fill", "#000")
          .attr("fill-opacity", 1)
          .attr("d", "M0,-5L10,0L0,5");
    },

    ForceGraph() {
      let width = 1200, height = 800;
      let colors = d3.schemeTableau10;

      const color = d3.scaleOrdinal(d3.sort(d3.map(this.nodesData, d => d.group)), colors);
      this.forceLink = d3.forceLink(this.linksData).id(({index: i}) => d3.map(this.nodesData, d => d.code)[i]);

      this.forceLink.strength(link => Math.log10(link.total[5]) / 100);

      this.createSvg(width, height);

      const links = this.svg.append("g")
          .attr("fill", "none")
          .attr("stroke-width", 1.5)
          .selectAll("path")
          .data(this.linksData)
          .join("path")
          .attr("stroke", "#000")
          .attr("stroke-opacity", 0.2)
          .attr("stroke-width", d => Math.log10(d.total[5]) - 3)
          .attr("marker-end", `url(${new URL(`#arrow`, location)})`);
      this.links = links;

      const nodes = this.svg.append("g")
          .attr("fill", color)
          .attr("stroke", "#000")
          .attr("stroke-width", .5)
          .selectAll("circle")
          .data(this.nodesData)
          .join("circle");
      this.nodes = nodes;

      this.simulation = d3.forceSimulation(this.nodesData)
          .force("link", this.forceLink)
          .force("charge", d3.forceManyBody().strength(-50))
          .force("x", d3.forceX().strength(0.05))
          .force("y", d3.forceY().strength(0.05))
          .on("tick", function () {
            links
                .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x).attr("y2", d => d.target.y)
                .attr("d", linkArc);
            nodes
                .attr("cx", d => d.x).attr("cy", d => d.y);
          });

      this.nodes
          .attr("fill", d => color(d.group))
          .attr("data-bs-toggle", "tooltip").attr("title", d => d.name)
          .attr("r", d => Math.log10(d.population) - 1)
          .call(drag(this.simulation, this.layout === "force"))
          .on("click", (event, node) => this.nodeClicked(node.code));

      function linkArc(d) {
        const r = 2 * Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y);
        return `M${d.source.x},${d.source.y}
                A${r},${r} 0 0,1 ${d.target.x},${d.target.y}`;
      }

      function drag(simulation, enabled) {
        function dragstarted(event) {
          if (enabled) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
          }
        }

        function dragged(event) {
          if (enabled) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
          }
        }

        function dragended(event) {
          if (enabled) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
          }
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
      }

      return Object.assign(this.svg.node(), {scales: {color}});
    },

    nodeClicked(nodeCode, changeLayout = true) {
        if (changeLayout && (nodeCode === this.root || this.layout === "force")) {
            this.toggleLayout();
        }
        if (this.layout === "force") {
            this.root = null;
            this.links.attr("stroke-opacity", 0.2)
                .attr("marker-end", `url(${new URL(`#arrow`, location)})`);
            this.simulation
                .force("link", this.forceLink)
                .force("x", d3.forceX().strength(0.05))
                .force("y", d3.forceY().strength(0.05))
                .force("radial", null);
        } else {
            this.root = nodeCode;
            let {layers, tree} = this.buildTree(nodeCode);
            this.links
                .attr("stroke-opacity", i => (
                        (this.direction && tree.has(i.source.code) && tree.get(i.source.code).includes(i.target.code))
                        || (!this.direction && tree.has(i.target.code) && tree.get(i.target.code).includes(i.source.code))
                    ) ? 1 : 0.05
                )
                .attr("marker-end", i => {
                    if (
                        (this.direction && tree.has(i.source.code) && tree.get(i.source.code).includes(i.target.code))
                        || (!this.direction && tree.has(i.target.code) && tree.get(i.target.code).includes(i.source.code))
                    ) {
                        return `url(${new URL(`#arrow-full`, location)})`;
                    }
                    return `url(${new URL(`#arrow-faded`, location)})`;
                });
            this.simulation
                .force("link", d3.forceLink(this.linksData)
                    .id(({index: i}) => d3.map(this.nodesData, d => d.code)[i])
                    .strength(link => (
                            (this.direction && tree.has(link.source.code) && tree.get(link.source.code).includes(link.target.code))
                            || (!this.direction && tree.has(link.target.code) && tree.get(link.target.code).includes(link.source.code))
                        ) ? 0.5 : 0
                    ))
                .force("x", d3.forceX().strength(i => (i.code === nodeCode) ? 1 : 0))
                .force("y", d3.forceY().strength(i => (i.code === nodeCode) ? 1 : 0))
                .force("radial", d3.forceRadial().strength(5).radius(i => {
                    let n = layers.findIndex(e => e.includes(i.code));
                    (n === -1) ? n = layers.length : n;
                    return n * 100;
                }));
        }
    },

    changeDirection(direction) {
      this.direction = direction;
      this.nodeClicked(this.root, false);
    },

    getNeighbors(node) {
      let neighbors = [];
      for (let link of this.G.edges()) {
        if (!this.direction && link[1] === node) {
          neighbors.push(link[0]);
        } else if (this.direction && link[0] === node) {
          neighbors.push(link[1]);
        }
      }
      return neighbors;
    },

    buildTree(root) {
      let tree = new Map();
      let layers = [];
      let visited = new Set();
      let queue = [root];
      let currentLayer = 0;
      while (queue.length > 0) {
        let nextQueue = [];
        layers[currentLayer] = [];
        for (let node of queue) {
          visited.add(node);
          layers[currentLayer].push(node);
          for (let neighbor of this.getNeighbors(node)) {
            if (!visited.has(neighbor) && !nextQueue.includes(neighbor) && !queue.includes(neighbor)) {
              if (tree.has(node)) {
                tree.get(node).push(neighbor);
              } else {
                tree.set(node, [neighbor]);
              }
              nextQueue.push(neighbor);
            }
          }
        }
        queue = nextQueue;
        currentLayer++;
      }
      return {
        layers,
        tree
      };
    },
  }
}
</script>
