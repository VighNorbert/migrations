<template>
    <div class="map-canvas">
    </div>
</template>

<script>
import * as d3 from 'd3';
import * as jsnx from 'jsnetworkx';
import * as bootstrap from 'bootstrap';
import * as zoom from 'd3-zoom';

// TODO implement sliders for forces
// TODO implement force presets
// TODO add legend

export default {
  name: 'ForceDirectedGraph',
  data() {
    return {
      layout: 'force',
      nodesData: null,
      regionsData: [],
      linksData: null,
      differenceLinksData: null,
      nodes: null,
      links: null,
      allLinksData: null,
      allDifferenceLinksData: null,
      G: null,
      forceLink: null,
      simulationRunning: true,
      simulation: null,
      svg: null,
      root: null
    };
  },
  props: {
    direction: String,
    selection: String,
    startYearId: Number,
    endYearId: Number,
    migrationThreshold: Number
  },
  computed: {
    zoom() {
      return zoom
          .zoom()
          .scaleExtent([0.25, 8])
          .on("zoom", this.zoomed);
    }
  },
  watch: {
    direction() {
      this.updateMap();
      this.nodeClicked(this.root, false);
    },
    selection() {
      if (this.selection !== this.root && this.selection !== 'default') {
        this.nodeClicked(this.selection);
      }
      if (this.selection === 'default') {
        this.switchToForce();
      }
    },
    startYearId() {
      this.filterLinks();
      this.updateMap();
    },
    endYearId() {
      this.filterLinks();
      this.updateMap();
    },
    migrationThreshold() {
      this.filterLinks();
      this.updateMap();
    }
  },
  async mounted() {

    this.nodesData = await this.loadNodes();
    let l = await this.loadLinks();
    this.allLinksData = l.links;
    this.allDifferenceLinksData = l.diffs;

    this.filterLinks();
    this.updateMap();
  },
  methods: {
    zoomed(event) {
      this.svg
          .selectAll("g.apply-zoom")
          .attr("transform", event.transform);
    },

    async loadNodes() {
      let c = await d3.json("../../data/countries.json");
      c.map(d => {
        d.group = d.region;
      });
      this.regionsData = [
        ...new Set(
            c.map(d => d.region)
        )
      ];
      return c;
    },

    async loadLinks() {
      let linksData = await d3.json("../../data/migration.json");

      let diffs = [];
      linksData.forEach(d => {
        if (diffs[d.source + "-" + d.target] !== undefined) {
          diffs[d.source + "-" + d.target].females = d.females.map((v, i) => v + diffs[d.source + "-" + d.target][i]);
          diffs[d.source + "-" + d.target].males = d.males.map((v, i) => v + diffs[d.source + "-" + d.target][i]);
          diffs[d.source + "-" + d.target].total = d.total.map((v, i) => v + diffs[d.source + "-" + d.target][i]);
        } else {
          diffs[d.source + "-" + d.target] = d;
        }
        if (diffs[d.target + "-" + d.source] !== undefined) {
          diffs[d.target + "-" + d.source].females = d.females.map((v, i) => diffs[d.source + "-" + d.target][i] - v);
          diffs[d.target + "-" + d.source].males = d.males.map((v, i) => diffs[d.source + "-" + d.target][i] - v);
          diffs[d.target + "-" + d.source].total = d.total.map((v, i) => diffs[d.source + "-" + d.target][i] - v);
        } else {
          diffs[d.target + "-" + d.source] = {
            "source": d.target,
            "target": d.source,
            "females": d.females.map(e => -e),
            "males": d.males.map(e => -e),
            "total": d.total.map(e => -e)
          };
        }
      });

      return {links: linksData, diffs: Object.values(diffs)};
    },

    filterLinks() {
      this.differenceLinksData = this.allDifferenceLinksData.filter(d => this.getData(d) > this.migrationThreshold);
      this.linksData = this.allLinksData.filter(d => this.getData(d) > this.migrationThreshold);
    },

    updateMap() {
      this.G = new jsnx.DiGraph();
      this.G.addNodesFrom(this.nodesData.map(d => [d.code, d]));
      this.G.addEdgesFrom(this.linksData.map(d => [d.source, d.target, d]));

      this.diffG = new jsnx.DiGraph();
      this.diffG.addNodesFrom(this.nodesData.map(d => [d.code, d]));
      this.diffG.addEdgesFrom(this.differenceLinksData.map(d => [d.source, d.target, d]));

      document.querySelector(".map-canvas").innerHTML = "";

      this.drawGraph();
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

    getData(d) {
      return d.total
          .filter((v, i) => i >= this.startYearId && i <= this.endYearId && v > 0)
          .reduce((a, b) => a + b, 0);
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

      let colors = d3.schemeTableau10;
      const color = d3.scaleOrdinal(d3.sort(d3.map(this.nodesData, d => d.group)), colors);

      let p = defs.selectAll("pattern")
          .data(this.nodesData)
          .join("pattern")
          .attr("height", "100%")
          .attr("width", "100%")
          .attr("patternContentUnits", "objectBoundingBox")
          .attr("id", d => `flag-${d.iso3316}`);
      p.append("rect")
          .attr("x", "0")
          .attr("y", "0")
          .attr("height", "1")
          .attr("width", "1")
          .attr("fill", d => color(d.group));
      p.append("image")
          .attr("x", "0")
          .attr("y", "0")
          .attr("preserveAspectRatio", "xMidYMid meet")
          .attr("height", "1")
          .attr("width", "1")
          .attr("xlink:href", d => require('@/assets/img/w20/' + d.iso3316.toString().toLowerCase() + '.png'));

    },

    showLegend(width, height) {
        let colors = d3.schemeTableau10;
        const color = d3.scaleOrdinal(d3.sort(d3.map(this.nodesData, d => d.group)), colors);

        let uniqueGroups = [...new Set(this.nodesData.map(d => d.group))];

        let legend = this.svg.append("g")
            .attr("transform", `translate(${-width / 2 + 5}, ${-height / 2 + 5})`)
            .attr("class", "legend");

        legend.append("rect")
            .attr("x", 0)
            .attr("y", 20)
            .attr("width", 150)
            .attr("height", uniqueGroups.length * 25 + 40)
            .attr("fill", "#ffffffaa")
            .attr("stroke", "black")
            .attr("stroke-width", 1)
            .attr("rx", 4)
            .attr("ry", 4);

        legend.append("text")
            .attr("x", 10)
            .attr("y", 40)
            .text("Legend:")
            .attr("font-weight", "bold")
            .attr("alignment-baseline", "middle");

        let legendItems = legend.selectAll("g")
            .data(uniqueGroups)
            .enter().append("g")
            .attr("transform", (d, i) => `translate(10, ${i * 25 + 55})`);

        legendItems.append("circle")
            .attr("cx", 10)
            .attr("cy", 10)
            .attr("r", 8)
            .attr("fill", d => color(d))
            .attr("stroke", d => color(d))
            .attr("stroke-width", 2);

        legendItems.append("text")
            .attr("x", 25)
            .attr("y", 10)
            .text(d => d)
            .attr("alignment-baseline", "middle");
    },


    ForceGraph() {
      let width = 1200, height = 800;
      let colors = d3.schemeTableau10;

      const color = d3.scaleOrdinal(d3.sort(d3.map(this.nodesData, d => d.group)), colors);
      this.forceLink = d3.forceLink(this.direction === 'd' ? this.differenceLinksData : this.linksData).id(({index: i}) => d3.map(this.nodesData, d => d.code)[i]);

      this.forceLink.strength(d => Math.log10(this.getData(d)) / 100);

      this.createSvg(width, height);

      this.svg.call(this.zoom);

      const links = this.svg.append("g")
          .attr("class", "apply-zoom")
          .attr("fill", "none")
          .attr("stroke-width", 1.5)
          .selectAll("path")
          .data(this.direction === 'd' ? this.differenceLinksData : this.linksData)
          .join("path")
          .attr("stroke", "#000")
          .attr("stroke-opacity", 0.2)
          .attr("stroke-width", d => Math.log10(this.getData(d)) - 3)
          .attr("marker-end", `url(${new URL(`#arrow`, location)})`);
      this.links = links;

      const nodes = this.svg.append("g")
          .attr("class", "apply-zoom")
          .attr("stroke", "#000")
          .attr("stroke-width", 1.5)
          .selectAll("circle")
          .data(this.nodesData)
          .join("circle");
      this.nodes = nodes;

      // TODO fix when radial layout is selected

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
          .attr("fill", d => `url(#flag-${d.iso3316})`)
          .attr("stroke", d => color(d.group))
          .attr("data-bs-toggle", "tooltip").attr("title", d => d.name)
          .attr("r", d => Math.log10(d.population))
          .call(drag(this.simulation, this.layout === "force"))
          .on("click", (event, node) => this.nodeClicked(node.code));

      this.showLegend(width, height);

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

      if (this.selection !== 'default') {
        this.nodeClicked(this.selection);
      }

      return Object.assign(this.svg.node(), {scales: {color}});
    },

    switchToForce() {
      this.root = null;
      this.links.attr("stroke-opacity", 0.2)
          .attr("marker-end", `url(${new URL(`#arrow`, location)})`);
      this.simulation
          .force("link", this.forceLink)
          .force("x", d3.forceX().strength(0.05))
          .force("y", d3.forceY().strength(0.05))
          .force("radial", null);
      this.simulation.restart();
    },

    switchToRadial(nodeCode) {
      this.root = nodeCode;
      let {layers, tree} = this.buildTree(nodeCode);
      this.links
          .attr("stroke-opacity", i => (
                  (this.direction === 'e' && tree.has(i.source.code) && tree.get(i.source.code).includes(i.target.code))
                  || (this.direction === 'i' && tree.has(i.target.code) && tree.get(i.target.code).includes(i.source.code))
              ) ? 1 : 0.05
          )
          .attr("marker-end", i => {
            if (
                (this.direction === 'e' && tree.has(i.source.code) && tree.get(i.source.code).includes(i.target.code))
                || (this.direction === 'i' && tree.has(i.target.code) && tree.get(i.target.code).includes(i.source.code))
            ) {
              return `url(${new URL(`#arrow-full`, location)})`;
            }
            return `url(${new URL(`#arrow-faded`, location)})`;
          });
      this.simulation
          .force("link", d3.forceLink(this.direction === 'd' ? this.differenceLinksData : this.linksData)
              .id(({index: i}) => d3.map(this.nodesData, d => d.code)[i])
              .strength(link => (
                      (this.direction === 'e' && tree.has(link.source.code) && tree.get(link.source.code).includes(link.target.code))
                      || (this.direction === 'i' && tree.has(link.target.code) && tree.get(link.target.code).includes(link.source.code))
                  ) ? 0.2 : 0
              ))
          .force("x", d3.forceX().strength(i => (i.code === nodeCode) ? .5 : 0))
          .force("y", d3.forceY().strength(i => (i.code === nodeCode) ? .5 : 0))
          .force("radial", d3.forceRadial().strength(3).radius(i => {
            let n = layers.findIndex(e => e.includes(i.code));
            (n === -1) ? n = layers.length : n;
            return n * 100;
          }));
      this.simulation.restart().alpha(0.7);
    },

    nodeClicked(nodeCode, changeLayout = true) {
      if (changeLayout && (nodeCode === this.root || this.layout === "force")) {
        this.toggleLayout();
      }
      if (this.layout === "force") {
        this.$emit("node-clicked", 'default');
        this.switchToForce();
      } else {
        this.$emit("node-clicked", nodeCode);
        this.switchToRadial(nodeCode);
      }
    },

    getNeighbors(node) {
      let neighbors = [];
      if (this.direction === 'd') {
        for (let link of this.diffG.edges()) {
          if (link[0] === node) {
            neighbors.push(link[1]);
          }
        }
      } else {
        for (let link of this.G.edges()) {
          if (this.direction === 'i' && link[1] === node) {
            neighbors.push(link[0]);
          } else if (this.direction === 'e' && link[0] === node) {
            neighbors.push(link[1]);
          }
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

<style>
circle {
    cursor: pointer;
}
</style>
