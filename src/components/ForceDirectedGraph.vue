<template>
  <div class="map-canvas">
  </div>
</template>

<script>
import * as d3 from 'd3';
import * as bootstrap from 'bootstrap';

export default {
  name: 'ForceDirectedGraph',
  async mounted() {
    let nodes = await this.loadNodes();
    let links = await this.loadLinks();

    this.drawGraph(nodes, links);
  },
  methods: {
    async loadNodes() {
      let c = await d3.json("../../data/countries.json");
      c.map(d => {
        d.group = d.region;
      });
      // console.log(c);
      return c;
    },
    async loadLinks() {
      let c = await d3.json("../../data/migration.json");
      // console.log(c);
      c = c.filter(d => d.total[5] > 10000);
      return c;
    },
    drawGraph(nodes, links) {
      let chart = this.ForceGraph(nodes, links, undefined);

      document.querySelector(".map-canvas").appendChild(chart);

      const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
      [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl, {
        trigger: 'hover',
        delay: {show: 300, hide: 0}
      }));
    },
    ForceGraph(nodes, links, linkStrength) {
      let width = 1200, height = 600;
      let colors = d3.schemeTableau10;

      const color = d3.scaleOrdinal(d3.sort(d3.map(nodes, d => d.group)), colors);
      const forceLink = d3.forceLink(links).id(({index: i}) => d3.map(nodes, d => d.code)[i]);

      if (linkStrength !== undefined) forceLink.strength(linkStrength);

      const simulation = d3.forceSimulation(nodes)
          .force("link", forceLink)
          .force("charge", d3.forceManyBody())
          .force("center", d3.forceCenter())
          .on("tick", function () {
            link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
            node.attr("cx", d => d.x).attr("cy", d => d.y);
          });

      const svg = d3.create("svg")
          .attr("width", width)
          .attr("height", height)
          .attr("viewBox", [-width / 2, -height / 2, width, height])
          .attr("style", "width: 100%; height: 50%;");

      const link = svg.append("g")
          .attr("stroke-opacity", 0.3)
          .attr("stroke-linecap", "round")
          .attr("stroke-width", 1)
          .attr("stroke", "#000")
          .selectAll("line")
          .data(links)
          .join("line");

      const node = svg.append("g")
          .attr("fill", color)
          .attr("stroke", "#000")
          .selectAll("circle")
          .data(nodes)
          .join("circle")
          .attr("r", 4)
          .call(drag(simulation));

      node.attr("fill", d => color(d.group));
      node.attr("data-bs-toggle", "tooltip").attr("title", d => d.name);

      function drag(simulation) {
        function dragstarted(event) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
        }

        function dragged(event) {
          event.subject.fx = event.x;
          event.subject.fy = event.y;
        }

        function dragended(event) {
          if (!event.active) simulation.alphaTarget(0);
          event.subject.fx = null;
          event.subject.fy = null;
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
      }

      return Object.assign(svg.node(), {scales: {color}});
    },
  }
}
</script>
