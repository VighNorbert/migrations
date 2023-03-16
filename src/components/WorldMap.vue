<template>
  <div id="map">
    <svg class="canvas" :viewBox="`0, 0, ${width}, ${height}`">
      <g id="basemap"></g>
      <g id="countries"></g>
      <text id="tooltip" x="150" y="150">{{displayedCountry}}</text>
    </svg>
  </div>
</template>

<script>
import json from "@/assets/world-topo-110m.json";
import { geoPath, geoEqualEarth } from "d3-geo";
import * as selection from "d3-selection";
import * as zoom from "d3-zoom";
import * as d3 from 'd3';
import { feature } from "topojson-client";
export default {
  name: "WorldMap",
  data() {
    return {
      myJson: feature(json, json.objects["countries"]),
      displayedCountry: "",
      width: 950,
      height: 550
    };
  },
  computed: {
    projection() {
      return geoEqualEarth().fitSize([this.width, this.height], this.myJson);
    },
    path() {
      return geoPath().projection(this.projection);
    },
    g() {
      return selection.select("#basemap");
    },
    svg() {
      return selection.select(".canvas");
    },
    zoom() {
      return zoom
        .zoom()
        .scaleExtent([1, 8])
        .on("zoom", this.zoomed);
    }
  },
  methods: {
    zoomed(event) {
      this.g.attr("transform", event.transform);
      this.g.attr("stroke-width", 1 / event.transform.k);
    },
    clicked(event, d) {
      const [[x0, y0], [x1, y1]] = this.path.bounds(d);
      event.stopPropagation();
      this.svg
        .transition()
        .duration(750)
        .call(
          this.zoom.transform,
          zoom.zoomIdentity
            .translate(this.width / 2, this.height / 2)
            .scale(
              Math.min(
                8,
                0.9 / Math.max((x1 - x0) / this.width, (y1 - y0) / this.height)
              )
            )
            .translate(-(x0 + x1) / 2, -(y0 + y1) / 2),
          selection.pointer(this.svg.node())
        );
    },
    reset() {
      this.svg
        .transition()
        .duration(750)
        .call(
          this.zoom.transform,
          zoom.zoomIdentity,
          zoom
            .zoomTransform(this.svg.node())
            .invert([this.width / 2, this.height / 2])
        );
    },
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

     async loadCapitals() {
      let c = await d3.json("../../data/capitals.json");
      return c;
    },

  },
  async mounted() {
    let nodes = await this.loadCapitals();
    // let links = await this.loadLinks();

    // console.log(nodes);
    // console.log(links);

    this.g
      .selectAll(".country")
      .data(this.myJson.features)
      .join("path")
      .attr("class", "country")
      .attr("d", this.path)
      .on("click", this.clicked);
    this.svg.on("click", this.reset).call(this.zoom);

    this.svg.selectAll('.cities')
		.data(nodes.features)
    .join("path")
		.attr('d', this.path.pointRadius(2))
		.attr('class', 'cities');
  }
};
</script>

<style>
.country {
  fill: WhiteSmoke;
  stroke: Gainsboro;
}
#tooltip {
  font-size: 1.5rem;
}
.active {
  stroke: black;
}

.countries {
	fill: red;
	opacity:0.7;
}
</style>